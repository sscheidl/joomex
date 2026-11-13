# Third-party software

PDF.js 6.5.438, Mozilla and contributors, Apache License 2.0.
Official distribution: https://github.com/mozilla/pdf.js/releases/tag/v6.5.438
Archive SHA-256: fcbe9ba21d9911843e3502adc178a7f549a524a4055f887bedc942e5490c6ba1

The complete upstream license accompanies `media/vendor/pdfjs/LICENSE`. Fonts, CMaps and decoder resources keep the notices of the official distribution. The file inventory and hashes are in `dependencies.json` in the source project.

Page sounds `media/vendor/kenney-rpg-audio/page-turn-1.mp3` and `page-turn-2.mp3` (with Kenney's `License.txt`): derived from `bookFlip2.ogg` and `bookFlip3.ogg` of "RPG Audio" by Kenney Vleugels (https://kenney.nl/assets/rpg-audio), Creative Commons Zero 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Credit is not required by the licence and is given here voluntarily. Changes: mixed to mono, silence trimmed, high-pass 150 Hz and low-pass 7 kHz, peak-normalised to -3 dB, 6 ms fade-in and 80 ms fade-out, encoded as MP3 64 kbit/s with ffmpeg. The pack was taken from the unmodified `kenney_rpgaudio.zip` (with Kenney's `License.txt`) mirrored at https://github.com/sigco3111/assets-audio, commit `eb369bc`. Hashes of the archive, the source files and the shipped files are in `dependencies.json` in the source project.

No code, binaries, sound effects, fonts or graphics of the previously used commercial flipbook module are included. The page-turn implementation, interface and synthetic test PDFs were written independently for this project.

Project source license: GPL-3.0-or-later. Tests and the alpha package are not a security certification and do not confirm Joomla integration compatibility.
