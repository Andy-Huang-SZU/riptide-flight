"""Restore the lossless source paintings at 4x. The established x4v3 weight stays outside the project."""
import argparse
import hashlib
from pathlib import Path
from time import perf_counter
import numpy as np
from PIL import Image
import torch
from torch import nn
from torch.nn import functional as F

ROOT=Path(__file__).resolve().parents[1]
# Official Real-ESRGAN v0.2.5.0 general x4v3 release.
CHECKSUM='8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292'
class Upscaler(nn.Module):
    def __init__(self,weights):
        super().__init__()
        layers=[]
        for i in range(67):
            w=weights[f'body.{i}.weight']
            layers.append(nn.PReLU(w.shape[0]) if w.ndim==1 else nn.Conv2d(w.shape[1],w.shape[0],3,padding=1))
        self.body=nn.Sequential(*layers)
        self.load_state_dict(weights)
    def forward(self,x):
        return F.pixel_shuffle(self.body(x),4)+F.interpolate(x,scale_factor=4,mode='nearest')

@torch.inference_mode()
def restore(net,im,device):
    src=np.asarray(im.convert('RGB'));h,w=src.shape[:2];pad=40;step=320
    padded=np.pad(src,((pad,pad),(pad,pad),(0,0)),mode='reflect')
    result=Image.new('RGB',(w*4,h*4))
    for y in range(0,h,step):
        for x in range(0,w,step):
            ny=min(step,h-y);nx=min(step,w-x)
            a=np.ascontiguousarray(padded[y:y+ny+2*pad,x:x+nx+2*pad])
            a=torch.from_numpy(a).to(device=device,dtype=torch.float32).permute(2,0,1).unsqueeze(0)/255
            pred=net(a)[0,:,4*pad:4*(pad+ny),4*pad:4*(pad+nx)]
            block=(pred.clamp(0,1).permute(1,2,0)*255).round().to(torch.uint8).cpu().numpy()
            result.paste(Image.fromarray(block),(4*x,4*y))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('weight',type=Path);parser.add_argument('stage',type=Path)
    parser.add_argument('--repaints',action='store_true',help='Also prepare the registered full-size repainted patches')
    args=parser.parse_args();args.stage.mkdir(exist_ok=True,parents=True)
    assert hashlib.sha256(args.weight.read_bytes()).hexdigest()==CHECKSUM
    device='mps' if torch.backends.mps.is_available() else 'cpu';torch.set_num_threads(8)
    model=Upscaler(torch.load(args.weight,weights_only=True,map_location='cpu')['params']).eval().to(device=device,memory_format=torch.channels_last)
    print('Restoration device',device,flush=True)
    inputs=[ROOT/'assets/original'/(name+'.png') for name in ['strata','dawn','tide']]
    if args.repaints:
        inputs.extend(p for p in sorted((ROOT/'assets/detail-paint').glob('*.png')) if p.stem!='print-relief')
    for source in inputs:
        name=source.stem
        p=args.stage/(name+'-sr.tif')
        im=Image.open(source)
        if p.exists() and Image.open(p).size==(im.width*4,im.height*4):continue
        start=perf_counter()
        result=restore(model,im,device);partial=p.with_suffix('.part.tif');result.save(partial,compression='raw');partial.replace(p)
        print(name,result.size,round(perf_counter()-start,2),flush=True)
