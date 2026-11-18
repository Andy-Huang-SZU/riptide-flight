"""Render the public film with a local WebGL 2 and WebCodecs-capable Chromium browser."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
def browser_binary():
    candidates=[os.environ.get('CHROME_PATH'),shutil.which('google-chrome'),shutil.which('chromium'),
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    return next((str(p) for p in candidates if p and Path(p).is_file()),None)

def render(height,destination):
    source=ROOT/'riptide-offline.html'
    if not source.exists():
        import sys
        subprocess.run([sys.executable,str(ROOT/'build.py'),'--standalone'],check=True)
    grid=json.loads((ROOT/'beat-grid.json').read_text());fps=grid['fps'];total=round(fps*grid['duration'])
    with tempfile.TemporaryDirectory() as temp, sync_playwright() as lib:
        browser=lib.chromium.launch(executable_path=browser_binary(),headless=True,chromium_sandbox=True,
            args=['--force-color-profile=srgb','--disable-background-timer-throttling','--disable-background-networking'])
        try:
            page=browser.new_page(viewport={'width':960,'height':540},offline=True,accept_downloads=True)
            failures=[];page.on('pageerror',lambda e:failures.append(str(e)))
            page.goto(source.as_uri()+'?render&size='+str(height));page.evaluate('window.ready')
            for script in [ROOT/'assets/mediabunny-1.66.0.min.js',ROOT/'src/export.js']:
                page.add_script_tag(path=str(script))
            page.evaluate('async f=>window.recorder=await startUhdExport(f)',fps)
            for first in range(0,total,120):
                page.evaluate('([a,b])=>recorder.frames(a,b)',[first,min(first+120,total)])
            with page.expect_download(timeout=120000) as download:
                result=page.evaluate('recorder.finish()')
            if result['frames']!=total or failures:raise RuntimeError((result,failures))
            picture=Path(temp)/'picture.mp4';download.value.save_as(picture)
            partial=destination.with_name(destination.stem+'.part.mp4')
            try:
                subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(picture),'-i',str(ROOT/'assets/score.wav'),
                    '-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','256k','-t',str(grid['duration']),
                    '-movflags','+faststart',str(partial)],check=True)
                partial.replace(destination)
            finally:
                partial.unlink(missing_ok=True)
        finally:browser.close()
    print(destination,flush=True)
if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('--height',type=int,choices=[540,1080,2160],default=2160)
    cli.add_argument('--out',type=Path,default=ROOT/'riptide.mp4')
    opts=cli.parse_args();render(opts.height,opts.out.resolve())
