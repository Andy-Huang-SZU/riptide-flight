"""Register newly painted detail with the source, retain the source's large shapes and ink colours."""
import argparse
import json
from pathlib import Path
import cv2 as cv
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'assets'
E=ROOT/'evidence'
E.mkdir(exist_ok=True)
SCALE=4
cv.setNumThreads(5)
cv.setRNGSeed(371)

def rgb(path):
    return np.asarray(Image.open(path).convert('RGB'))

def blur(image,radius):
    return cv.GaussianBlur(image,(0,0),radius,borderType=cv.BORDER_REFLECT101)

def mono(image):
    return cv.cvtColor(image,cv.COLOR_RGB2GRAY)

def smooth(x):
    u=np.clip(x,0.,1.)
    return u*u*(3.-2.*u)

def align(reference,original_detail):
    height,width=reference.shape[:2]
    candidate=cv.resize(original_detail,(width,height),interpolation=cv.INTER_AREA)
    grid_x,grid_y=np.meshgrid(np.arange(width,dtype='float32'),np.arange(height,dtype='float32'))
    clahe=cv.createCLAHE(clipLimit=1.8,tileGridSize=(10,9))
    def guide(img): return clahe.apply(mono(blur(img,.66)))
    target=guide(reference);guide_detail=guide(candidate)
    sift=cv.SIFT_create(nfeatures=2600,contrastThreshold=.012)
    tpoints,td=sift.detectAndCompute(target,None);cpoints,cd=sift.detectAndCompute(guide_detail,None)
    affine=np.eye(2,3,dtype=np.float32);ninliers=0
    if td is not None and cd is not None:
        pairs=cv.BFMatcher().knnMatch(td,cd,k=2)
        good=[a for pair in pairs if len(pair)==2 for a,b in [pair] if a.distance<.79*b.distance]
        if len(good)>=12:
            first=np.float32([tpoints[m.queryIdx].pt for m in good]);second=np.float32([cpoints[m.trainIdx].pt for m in good])
            fit,mask=cv.estimateAffinePartial2D(first,second,method=cv.RANSAC,ransacReprojThreshold=4.2,maxIters=3200)
            if fit is not None and mask.sum()>=9 and np.max(np.abs(fit[:,:2]-affine[:,:2]))<.16 and np.max(np.abs(fit[:,2]))<.13*width:
                affine=fit.astype('float32');ninliers=int(mask.sum())
    def project(x,y):
        return affine[0,0]*x+affine[0,1]*y+affine[0,2],affine[1,0]*x+affine[1,1]*y+affine[1,2]
    x,y=project(grid_x,grid_y)
    initial=cv.remap(guide_detail,x,y,cv.INTER_LINEAR,borderMode=cv.BORDER_REFLECT101)
    flow_engine=cv.DISOpticalFlow_create(cv.DISOPTICAL_FLOW_PRESET_MEDIUM)
    flow_engine.setFinestScale(1);flow_engine.setVariationalRefinementIterations(8)
    flow=blur(flow_engine.calc(target,initial,None),2.8)
    # Fine discontinuities belong to the paint. Large registration drift should not reshape them.
    flow*=np.minimum(1.,31./np.maximum(np.linalg.norm(flow,axis=2,keepdims=True),.01))
    x,y=project(grid_x+flow[:,:,0],grid_y+flow[:,:,1])
    registered=cv.remap(candidate,x,y,cv.INTER_CUBIC,borderMode=cv.BORDER_REFLECT101)
    broad_err=np.abs(blur(reference.astype('float32'),2.8)-blur(registered.astype('float32'),2.8)).mean(axis=2)
    confidence=blur((.18+.82*np.exp(-(broad_err/26.)**2)).astype('float32'),1.8)
    report={'landmarkInliers':ninliers,'medianResidualFlowSourcePx':round(float(np.median(np.linalg.norm(flow,axis=2))),2),
            'coarseColourMAE':round(float(broad_err.mean()),2),'confidenceMean':round(float(confidence.mean()),3)}
    return x-grid_x,y-grid_y,confidence,report

def overlap(box,full,boxes,scale):
    x0,y0,x1,y1=box;w,h=full
    def axis(a,b,limit,sections):
        p=(np.arange((b-a)*scale,dtype='float32')+.5)/scale+a
        mask=np.ones_like(p)
        for lo,hi in set(sections):
            if lo<a<hi<b:mask*=smooth((p-a-.12*(hi-a))/(.76*(hi-a)))
            if a<lo<b<hi:mask*=smooth((b-p-.12*(b-lo))/(.76*(b-lo)))
        return mask
    return axis(y0,y1,h,[(b[1],b[3]) for b in boxes])[:,None]*axis(x0,x1,w,[(b[0],b[2]) for b in boxes])[None,:]

def correct_tile(ref,base,detail,restored,box,kind):
    x0,y0,x1,y1=box;w=x1-x0;h=y1-y0
    dx,dy,conf,report=align(ref,detail);out_w,out_h=w*SCALE,h*SCALE
    factor=(out_w,out_h)
    native=cv.resize(detail,factor,interpolation=cv.INTER_LANCZOS4)
    improved=cv.resize(restored,factor,interpolation=cv.INTER_AREA)
    canvas=cv.addWeighted(improved,.78,native,.22,0)
    del native,improved
    x,y=np.meshgrid(np.arange(out_w,dtype='float32'),np.arange(out_h,dtype='float32'))
    x+=SCALE*cv.resize(dx,factor,interpolation=cv.INTER_CUBIC)
    y+=SCALE*cv.resize(dy,factor,interpolation=cv.INTER_CUBIC)
    candidate=cv.remap(canvas,x,y,cv.INTER_CUBIC,borderMode=cv.BORDER_REFLECT101).astype('float32')
    del canvas,x,y
    # Keep decisions larger than the local brushwork on the original colour plate.
    # Deriving this offset at source scale also keeps the operation tractable on big plates.
    delta=candidate-base.astype('float32')
    offset=blur(cv.resize(delta,(w,h),interpolation=cv.INTER_AREA),4.2 if kind=='tide' else 3.1)
    delta-=cv.resize(offset,factor,interpolation=cv.INTER_CUBIC)
    magnitude={'tide':.94,'strata':.85,'dawn':.80}[kind]
    weight=magnitude*conf
    if kind=='dawn':
        vertical=(y0+np.arange(h,dtype=np.float32)[:,None])
        weight*=smooth((vertical-170.)/59.)
    # Soft limit on very large differences at rebuilt boundaries.
    delta=np.clip(delta,-72.,72.)*cv.resize(weight,factor,interpolation=cv.INTER_LINEAR)[:,:,None]
    return delta,report

def make_plate(name,stage,all_regions):
    original=rgb(A/'original'/(name+'.png'));h,w=original.shape[:2]
    base_sr=rgb(stage/(name+'-sr.tif'));size=(w*SCALE,h*SCALE)
    natural=cv.resize(original,size,interpolation=cv.INTER_LANCZOS4)
    base=cv.addWeighted(base_sr,.84,natural,.16,0);del natural,base_sr
    boxes={n:b for n,b in all_regions.items() if n.startswith(name+'-')}
    coverage=np.zeros(base.shape[:2],np.float32);accum=np.zeros(base.shape,np.float32);stats={}
    for n,box in boxes.items():
        x0,y0,x1,y1=box;sl=np.s_[y0*SCALE:y1*SCALE,x0*SCALE:x1*SCALE]
        patch=rgb(A/'detail-paint'/(n+'.png'));rest=rgb(stage/(n+'-sr.tif'))
        correction,stats[n]=correct_tile(original[y0:y1,x0:x1],base[sl],patch,rest,box,name);del rest
        mask=overlap(box,(w,h),list(boxes.values()),SCALE)
        accum[sl]+=correction*mask[:,:,None];coverage[sl]+=mask
        print(n,stats[n],flush=True)
    # Work by strips to bound peak memory without a second full float image.
    for y0 in range(0,size[1],300):
        s=slice(y0,y0+300);base[s]=np.clip(base[s]+accum[s]/np.maximum(1.,coverage[s])[:,:,None],0,255).astype(np.uint8)
    del accum,coverage
    # 4:4:4 avoids subsampling the edge of vermilion, turquoise and gold within the renderer.
    target=A/(name+'-master.jpg');Image.fromarray(base).save(target,quality=98,subsampling=0,optimize=True)
    coarse=cv.resize(base,(w,h),interpolation=cv.INTER_AREA)
    back=rgb(target)
    psnr=float(cv.PSNR(base,back));del back
    return {'size':size,'sourceSize':[w,h],'repaints':stats,'jpeg444PSNR':round(psnr,2),
            'lowFrequencyMAE':round(float(np.abs(blur(original.astype('float32'),5)-blur(coarse.astype('float32'),5)).mean()),3)}

def make_relief():
    print_scan=mono(rgb(A/'detail-paint/print-relief.png')).astype('float32')
    oil_scan=mono(rgb(A/'detail-paint/tide-10.png'));h,w=oil_scan.shape
    oil=cv.resize(oil_scan[int(h*.64):int(h*.99),int(w*.20):int(w*.92)],(1254,1254),interpolation=cv.INTER_CUBIC).astype('float32')
    def channel(im,a,b,spread):
        detail=blur(im,a)-blur(im,b) if a>.01 else im-blur(im,b)
        rms=np.sqrt(blur(detail*detail,15.)+spread**2)
        return np.clip(128.+42.*detail/rms,8.,247.).astype('uint8')
    layer=np.stack([channel(print_scan,.0,3.3,2.5),channel(print_scan,1.6,15.,3.8),channel(oil,0.,6.1,3.4)],axis=2)
    Image.fromarray(layer).save(A/'material-relief.png',optimize=True)

if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('stage',type=Path);cli.add_argument('names',nargs='*',default=[])
    opts=cli.parse_args();regions=json.loads((A/'detail-paint/regions.json').read_text());make_relief()
    report=E/'art-restoration.json'
    results=json.loads(report.read_text()) if report.exists() else {}
    for kind in opts.names or ['tide','strata','dawn']:
        results[kind]=make_plate(kind,opts.stage,regions)
        report.write_text(json.dumps(results,indent=2));print(kind,results[kind]['size'],flush=True)
