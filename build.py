"""Build the GitHub Pages entry or a self-contained offline film using Python only."""
import argparse
import base64
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'
SRC=ROOT/'src'
MIMES={'.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'}
SCRIPTS=['surface','flight','traces','stamps','printworks','paper','tide','film','play']
TOKENS=['SURFACE','FLIGHT','TRACES','STAMPS','PRINT','PAPER','TIDE','FILM','PLAY']

def build(standalone,studio=None):
    if studio and not standalone:raise ValueError('External studio assets require --standalone')
    def uri(name):
        path=ASSETS/name
        if not path.is_file():raise FileNotFoundError(path)
        if not standalone:return 'assets/'+name
        return 'data:'+MIMES[path.suffix]+';base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
    page=(SRC/'shell.html.in').read_text()
    sources={'THREE':'three-r186.js','LOADER':'three-gltf-r186.js'}
    for token,name in sources.items():
        key='<script>@@'+token+'@@</script>'
        replacement='<script>'+(ASSETS/name).read_text()+'</script>' if standalone else '<script src="assets/'+name+'"></script>'
        page=page.replace(key,replacement)
    tex={k:uri(k+'-master.jpg') if standalone else {'full':uri(k+'-master.jpg'),'screen':uri('web/'+k+'.webp')} for k in ('dawn','strata','tide')}
    tex['micro']=uri('material-relief.png')
    slots={'FONT':uri('instrument-sans.woff2'),'AUDIO':uri(studio/'score.mp3' if studio else 'score.mp3'),'RIG':uri(studio/'swallow-tripo-rig.glb' if studio else 'studio-swallow.glb'),
           'SCORE':(ROOT/'beat-grid.json').read_text(),'ASSETS':json.dumps(tex)}
    for k,s in zip(TOKENS,SCRIPTS):
        if standalone:slots[k]=(SRC/(s+'.js')).read_text()
        else:page=page.replace('<script>@@'+k+'@@</script>','<script src="src/'+s+'.js"></script>')
    for key,value in slots.items():page=page.replace('@@'+key+'@@',value)
    if '@@' in page:raise ValueError('Unresolved template slot')
    if standalone:
        page=page.replace('href="making-of.html"','href="https://andy-huang-szu.github.io/riptide-flight/making-of.html"')
        page=page.replace('href="docs/riptide.mp4"','href="https://andy-huang-szu.github.io/riptide-flight/docs/riptide.mp4"')
    target=ROOT/('riptide-offline.html' if standalone else 'index.html')
    target.write_text(page); print(target.name,target.stat().st_size)

if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('--standalone',action='store_true');cli.add_argument('--studio-assets',type=Path)
    args=cli.parse_args();build(args.standalone,args.studio_assets.resolve() if args.studio_assets else None)
