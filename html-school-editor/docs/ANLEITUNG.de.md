# Kurzanleitung für Schülerinnen und Schüler

Mit diesem Editor schreibst du eigene Webseiten. Du brauchst nur die eine Datei und einen Browser (Microsoft Edge oder Google Chrome). Internet brauchst du nicht.

## Starten

Doppelklicke auf die Datei des Editors. Sie öffnet sich im Browser.

* **Links** steht der HTML-Code deiner Seite.
* **Rechts** siehst du die Seite so, wie ein Browser sie anzeigt.

Du kannst auf beiden Seiten schreiben. Die andere Seite ändert sich mit.

## Schreiben und gestalten

1. Klicke rechts in den Text und schreibe einfach los.
2. Für eine Überschrift, eine Liste, fetten Text, einen Link oder ein Bild: Setze zuerst rechts den Cursor an die Stelle oder markiere den Text. Drücke dann den Knopf über der Seite.

| Knopf | Was passiert | Tag im Code |
| --- | --- | --- |
| Absatz | normaler Text | `<p>` |
| Ü1, Ü2, Ü3 | große, mittlere, kleine Überschrift | `<h1>`, `<h2>`, `<h3>` |
| **F** | fett | `<b>` |
| *K* | kursiv | `<i>` |
| • Liste | Liste mit Punkten | `<ul>` und `<li>` |
| 1. Liste | Liste mit Nummern | `<ol>` und `<li>` |
| Links, Mitte, Rechts, Block | richtet den Absatz aus (oder das angeklickte Bild): linksbündig, zentriert, rechtsbündig, Blocksatz | `style="text-align: …"` |
| Link | macht aus dem markierten Text einen Link. Steht der Cursor in einem Link, änderst du seine Adresse. | `<a href="…">` |
| Link entfernen | macht aus dem Link wieder normalen Text | |
| Bild | fügt ein Bild von deinem Computer ein. Ist ein Bild angeklickt, änderst du es. | `<img src="…">` |

Tipp: Klicke rechts in einen Text. Links wird der passende Code gelb markiert. So siehst du, welches Tag was bewirkt.

## Bilder

Drücke **Bild** und wähle eine Bilddatei aus. Im Code steht dann nur der Name der Datei, zum Beispiel `<img src="katze.jpg" alt="">`.

**Wichtig:** Lege die Bilddatei in denselben Ordner wie deine Seite. Liegt sie in einem Unterordner, schreibst du dessen Namen in das Feld „Unterordner“, zum Beispiel `bilder`. Im Code steht dann `bilder/katze.jpg`. Fehlt die Datei dort, zeigt der Browser später kein Bild.

Der Editor erfährt nicht, aus welchem Ordner du ein Bild ausgewählt hast. Deshalb musst du den Unterordner selbst eintragen. Unter dem Feld zeigt dir der Editor, was im Code stehen wird.

Im selben Fenster kannst du das Bild beschreiben (diese Beschreibung hören Menschen, die das Bild nicht sehen können) und eine Breite in Pixeln angeben. Beides ist freiwillig.

Zum Ändern klickst du das Bild rechts an und drückst wieder **Bild**. Mit der Taste Entf löschst du ein angeklicktes Bild. Mit **Links**, **Mitte** und **Rechts** stellst du ein, wo das Bild in seiner Zeile steht.

Wenn du deine Seite später wieder öffnest, zeigt der Editor deine Bilder zuerst als Kasten, denn er darf deine Ordner nicht selbst lesen. Klicke einen Kasten an, drücke **Bild** und wähle die Datei noch einmal aus. Dann siehst du das Bild wieder; am Code ändert sich dabei nichts.

## Speichern

Drücke **Speichern** (oder die Tasten Strg+S) und wähle beim ersten Mal, wohin die Datei soll. Oben rechts steht, ob deine Seite gespeichert ist.

**Wichtig:** Der Editor merkt sich nichts. Wenn du das Fenster schließt, ohne zu speichern, ist deine Arbeit weg.

Mit **Herunterladen** bekommst du eine Kopie in den Ordner „Downloads“.

## Wenn etwas schiefgeht

* **Rückgängig** (Strg+Z) nimmt den letzten Schritt zurück. **Wiederholen** (Strg+Y) holt ihn wieder.
* **Rechts lässt sich nichts mehr schreiben?** Dann ist im Code links etwas nicht richtig geschlossen, zum Beispiel fehlt ein `</p>`. Der Editor zeigt dann einen Hinweis. Korrigiere den Code links.
* **Eine Stelle hat einen gestrichelten Rahmen?** Diese Stelle kannst du nur links im Code ändern.
* **Code aufräumen** rückt den Code ordentlich ein. Am Inhalt ändert sich nichts. Würde deine Seite danach anders aussehen (das kann am CSS liegen), lässt der Editor den Code, wie er ist, und sagt dir warum.

## Was der Editor nicht anzeigt

Skripte, Formulare, Videos und Bilder aus dem Internet sind im Editor ausgeschaltet. Bilder aus Dateien zeigt der Editor erst, wenn du sie mit **Bild** ausgewählt hast (siehe oben). In deinem Code bleibt alles erhalten. Wenn du die gespeicherte Datei im Browser öffnest, funktioniert es dort.

## Tasten

| Tasten | Wirkung |
| --- | --- |
| Strg+S | speichern |
| Strg+O | Datei öffnen |
| Strg+Z | rückgängig |
| Strg+Y | wiederholen |
| Strg+B | fett |
| Strg+I | kursiv |
| Tab (links im Code) | zwei Leerzeichen einrücken |
