"""Print the HTML sheets as native PNG pixels using the browser's text and canvas engine."""
import argparse
import hashlib
import os
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZIP_STORED
from PIL import Image
from playwright.sync_api import sync_playwright

NAMES = ['01-workflow', '02-geometry', '03-flight', '04-textures', '05-prompt', '06-render']
ROOT = Path(__file__).resolve().parent.parent
CHROME = next((p for p in [os.environ.get('CHROME_PATH'), shutil.which('google-chrome'),
    shutil.which('chromium'), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] if p and Path(p).is_file()), None)
def isolate(page, n):
    page.evaluate('''index=>{
      [...document.querySelectorAll('#book>article')].forEach((el,j)=>{el.hidden=j!==index;});
      document.getElementById('paper-size').style.height='1000px';
      for(const el of [document.scrollingElement,document.getElementById('paper-size'),document.getElementById('scroll-area')])el.scrollTop=0;
    }''',n)
    page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
def print_sheets(browser, source, directory, width, lang):
    directory.mkdir(parents=True, exist_ok=True)
    page=browser.new_page(viewport={'width':800,'height':1000},device_scale_factor=width/800,offline=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(source.as_uri()+'?export=1&lang='+lang, timeout=120000)
    page.evaluate('window.posterReady')
    for i,name in enumerate(NAMES):
        isolate(page,i)
        sheet=page.locator('#book>article').nth(i)
        assert sheet.bounding_box()=={'x':0,'y':0,'width':800,'height':1000}
        assert sheet.locator('footer').count()==0
        assert sheet.locator('.page-num').inner_text().strip().startswith(f'{i+1:02}')
        last=sheet.locator('.platebody > :last-child, .stack').last.bounding_box()
        assert last['y']+last['height']<=1001,(name,last)
        dest=directory/(name+'.png')
        page.screenshot(path=str(dest),type='png',animations='disabled')
        with Image.open(dest) as pic:
            assert pic.size==(width,5*width//4) and pic.format=='PNG'
            # Check the actual raster for the upper-right folio, independent of DOM layout.
            box=(round(width*.84), round(width*.012), round(width*.978), round(width*.058))
            ink=sum(max(pixel[:3])<200 for pixel in pic.convert('RGB').crop(box).getdata())
            assert ink>width//3,(name,'folio absent from pixels')
    assert not errors,errors
    page.close()
def bundle(directory,destination):
    with ZipFile(destination,'w',compression=ZIP_STORED) as archive:
        for name in NAMES:archive.write(directory/(name+'.png'),name+'.png')
    with ZipFile(destination) as archive:assert archive.testzip() is None
def run(source,output,lang):
    output.mkdir(parents=True,exist_ok=True)
    master=output/'png-masters';social=output/'x-png'
    with TemporaryDirectory() as temp,sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROME,headless=True,chromium_sandbox=True,
            args=['--disable-background-networking','--force-color-profile=srgb'])
        for dest,width in [(master,3200),(social,2048),(Path(temp),1600)]:
            print_sheets(browser,source,dest,width,lang)
        browser.close()
        strip=Image.new('RGB',(1600,2000*len(NAMES)),'white')
        for i,name in enumerate(NAMES):
            with Image.open(Path(temp)/(name+'.png')) as im:strip.paste(im,(0,i*2000))
        strip.save(output/'Riptide-making-of.png',compress_level=7)
    bundle(master,output/'Riptide-PNG-masters.zip')
    bundle(social,output/'Riptide-X-PNG.zip')
    print('Saved six 3200 × 4000 masters, six 2048 × 2560 X images and the 1600 × 12000 strip.',flush=True)

if __name__=='__main__':
    cli=argparse.ArgumentParser()
    cli.add_argument('--html',type=Path,default=ROOT/'making-of.html')
    cli.add_argument('--out',type=Path,default=ROOT/'exports')
    cli.add_argument('--lang',choices=['en','zh'],default='en')
    args=cli.parse_args();run(args.html.resolve(),args.out.resolve(),args.lang)
