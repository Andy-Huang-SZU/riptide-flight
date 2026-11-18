# Six illustrated build notes

The reader reflows into a single column on phones. Tap a production figure to see its native image, or open the gold-ridge comparison and drag the divider. The fixed 4:5 print design is used only when exporting PNGs.

- `poster.html` and `technical.html` contain the English and Chinese copy. `reader.js` draws the six measured crop rectangles, the actual score envelope and cue markers.
- `art/` contains the studio stills, input crop, raw repaint, registered crop and diagnostic views used by the guide. `technical-views.js` shows how the orthographic cutaway, film-camera mesh, skinned rig with projected joints, and wing stamps were drawn. The cutaway illustration was generated separately. [ImageGen prompt](imagegen-prompt.md)
- `export_plates.py` prints the HTML at three browser resolutions. The master pages are 3200 × 4000, the social pages are 2048 × 2560, and the 1600 × 12000 long image stitches the six native 1600-pixel renders. The exporter supports English and Chinese.

Run the build and export commands in the [main README](../README.md).
