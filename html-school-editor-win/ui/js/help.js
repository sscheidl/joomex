// The content of "Hilfe" (wish W1 of the owner's collection, 2026-11-27): a short guide in German for pupils of
// about twelve, the version, the developer, the MIT licence of the program and the notice of the WebView2 SDK,
// whose loader library is linked into the exe (its licence asks for the notice in the documentation of a binary).
// Everything is inside the program; nothing is loaded from the internet.

export const DEVELOPER = 'Stefan Scheidl';
export const YEAR = '2026';

const MIT = `MIT License

Copyright (c) ${YEAR} ${DEVELOPER}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

// LICENSE.txt of the Microsoft.Web.WebView2 SDK 1.0.4314.35 (dependencies.json), word for word.
const WEBVIEW2 = `Copyright (C) Microsoft Corporation. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * The name of Microsoft Corporation, or the names of its contributors
may not be used to endorse or promote products derived from this
software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

// [heading, [items]]; an item is text, or [text, key] for a line that names a key.
const GUIDE = [
  ['So fängst du an', [
    'Klicke auf „Projektordner öffnen“ und wähle den Ordner, in dem deine Seiten und Bilder liegen.',
    'Links siehst du alle Dateien. Klicke auf eine Seite, um sie zu öffnen, oder lege mit „Neue Seite“ eine an.',
  ]],
  ['Zwei Arten zu schreiben', [
    'In der Mitte steht der HTML-Code deiner Seite. Hier schreibst du die Tags selbst.',
    'Rechts siehst du deine Seite so wie im Browser. Du kannst auch direkt dort hineinschreiben.',
    'Beides gehört zusammen: Was du auf der einen Seite änderst, steht sofort auch auf der anderen.',
  ]],
  ['Gestalten', [
    'Markiere in deiner Seite einen Text und klicke oben in der zweiten Zeile auf einen Knopf, zum Beispiel Fett, Überschrift oder Liste.',
    'Die Ausrichtung (links, zentriert, rechts, Blocksatz) nimmst du weg, wenn du den Knopf noch einmal drückst.',
    'Beim „A“ wählst du die Textfarbe. Der kleine Pfeil daneben öffnet alle Farben.',
    ['Eine neue Zeile im selben Absatz', 'Umschalt+Enter'],
    '„Bild einfügen“ setzt ein Bild an die Stelle, an der du zuletzt geschrieben hast.',
  ]],
  ['Speichern und ansehen', [
    ['Speichern', 'Strg+S'],
    'Oben steht immer, ob deine Seite gespeichert ist.',
    '„Im Browser ansehen“ zeigt die gespeicherte Seite in deinem Browser.',
  ]],
  ['Nützliche Tasten', [
    ['Rückgängig', 'Strg+Z'],
    ['Wiederholen', 'Strg+Y'],
    ['Im Code suchen', 'Strg+F'],
    ['Diese Hilfe', 'F1'],
  ]],
];

const el = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props || {}); e.append(...kids); return e; };

export function helpBody(version) {
  const box = el('div', { className: 'helpText' });
  // The hero of the branding (an approved picture of the owner's brief, shown as it is, without cropping)
  box.append(el('img', {
    className: 'helpHero', src: 'assets/ninja-hero.webp', width: 1536, height: 1024, decoding: 'async',
    alt: 'Markup Ninja: Ein lächelnder Ninja mit Schwert auf dem Rücken reicht dir die Hand. Daneben das Logo und der Satz „Master the Art of HTML.“',
  }));
  for (const [head, items] of GUIDE) {
    box.append(el('h4', { textContent: head }));
    box.append(el('ul', null, ...items.map((item) => (Array.isArray(item) ? el('li', null, item[0] + ': ', el('kbd', { textContent: item[1] })) : el('li', { textContent: item })))));
  }
  box.append(
    el('h4', { textContent: 'Über dieses Programm' }),
    el('p', { textContent: 'Markup Ninja – der HTML-Editor für die Schule (Windows)' + (version ? ', Version ' + version : '') }),
    el('p', { textContent: 'Entwickelt von ' + DEVELOPER + ', ' + YEAR + '.' }),
    el('p', { textContent: 'Das Programm ist freie Software unter der MIT-Lizenz:' }),
    el('pre', { textContent: MIT }),
    el('h4', { textContent: 'Eingebaute Software anderer' }),
    el('p', { textContent: 'Das Programm zeigt Seiten mit Microsoft Edge WebView2. Die WebView2-Laufzeit ist Teil von Windows. Im Programm steckt die Ladebibliothek aus dem Microsoft WebView2 SDK 1.0.4314.35; für sie gilt diese Lizenz:' }),
    el('pre', { textContent: WEBVIEW2 }),
  );
  return box;
}
