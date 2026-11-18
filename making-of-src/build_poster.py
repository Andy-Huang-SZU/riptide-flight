"""Compile the bilingual making-of. The distributed reader embeds its images and fonts."""
import json
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
ART = SRC / 'art'
REPO = ROOT
ASSETS = {
    'WAVE': 'frame-wave.webp', 'CUTAWAY': 'cutaway.webp',
    'PSEA': 'plate-tide.webp', 'FIRST': 'gold-first.png', 'FINAL': 'gold-final.png',
    'WIRESIDE': 'actual-wire-side.webp', 'WIREEYE': 'actual-wire-eye.webp',
    'TOPO': 'actual-mesh.webp', 'RIG': 'actual-rig.webp', 'STAMPS': 'actual-stamps.webp',
    'TILEIN': 'tile-input.webp', 'TILEGEN': 'tile-repaint.webp', 'TILEOUT': 'tile-registered.webp',
    'CONCEPT': 'bird-concept.jpg', 'RIFT': 'frame-rift.webp',
    'PRINT': 'frame-print.webp', 'CREST': 'frame-crest.webp',
}

def build():
    target = ROOT / 'making-of.html'
    text = (SRC / 'poster.html').read_text().replace('@@PAGES@@', (SRC / 'technical.html').read_text())
    css = (SRC / 'film-guide.css').read_text() + (SRC / 'guide-layout.css').read_text()
    def asset(path, mime=None):
        return ('assets/' if path.parent == REPO / 'assets' else 'making-of-src/art/') + path.name
    css = css.replace('@@GEIST@@', asset(ART / 'geist.woff2', 'font/woff2'))
    pictures = {name: asset(ART / ('frame-' + shot + '.webp')) for name, shot in
                [('tear', 'tear'), ('fold', 'print'), ('bank', 'rift'), ('peel', 'return')]}
    pictures['plates'] = [asset(ART / ('plate-' + key + '.webp')) for key in ('dawn', 'strata', 'tide')]
    values = {key: asset(ART / filename) for key, filename in ASSETS.items()}
    values.update(COVER='docs/cover.jpg', GUIDEFILM='docs/riptide.mp4', CSS=css, JS=(SRC / 'reader.js').read_text(), COPY=(SRC / 'copy.json').read_text(),
                  PLOTS=(SRC / 'plot-data.json').read_text(), EXTRA=json.dumps(pictures),
                  DOWNLOAD='https://github.com/Andy-Huang-SZU/riptide-flight/releases/latest/download/Riptide-making-of.png',
                  FILM='index.html')
    for token, value in values.items():
        text = text.replace('@@' + token + '@@', value)
    if '@@' in text:
        raise ValueError('Unresolved template placeholder')
    target.write_text(text)
    print(target, target.stat().st_size, flush=True)

if __name__ == '__main__':
    build()
