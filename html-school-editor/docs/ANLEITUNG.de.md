# Kurzanleitung für Schülerinnen und Schüler

Mit diesem Editor schreibst du eigene Webseiten. Du brauchst nur die eine Datei und einen Browser (Microsoft Edge oder Google Chrome). Internet brauchst du nicht.

## Starten

Lege die Datei des Editors in deinen Projektordner. Dort liegen auch deine Seiten und deine Bilder. Doppelklicke auf die Datei des Editors. Sie öffnet sich im Browser.

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
| <u>U</u> | unterstrichen | `<u>` |
| x² | hochgestellt, zum Beispiel m² | `<sup>` |
| x₂ | tiefgestellt, zum Beispiel H₂O | `<sub>` |
| Marker | markiert wie mit einem Textmarker | `<mark>` |
| Farbe | färbt den markierten Text. Wähle eine der acht Farben. „Farbe entfernen“ nimmt die Farbe wieder weg. | `<span style="color: red">` |
| • Liste | Liste mit Punkten | `<ul>` und `<li>` |
| 1. Liste | Liste mit Nummern | `<ol>` und `<li>` |
| Links, Mitte, Rechts, Block | richtet den Absatz aus (oder das angeklickte Bild): linksbündig, zentriert, rechtsbündig, Blocksatz | `style="text-align: …"` |
| Link | macht aus dem markierten Text oder dem angeklickten Bild einen Link. Steht der Cursor in einem Link, änderst du seine Adresse. Mit dem Häkchen „In neuem Tab öffnen“ öffnet sich der Link später in einem neuen Tab. | `<a href="…">`, `target="_blank"` |
| Link entfernen | macht aus dem Link wieder normalen Text | |
| Bild | fügt ein Bild von deinem Computer ein. Ist ein Bild angeklickt, änderst du es. | `<img src="…">` |
| Tabelle | fügt eine Tabelle ein. Steht der Cursor in einer Tabelle, fügst du Zeilen und Spalten ein oder löschst sie. | `<table>`, `<tr>`, `<th>`, `<td>` |

Tipp: Klicke rechts in einen Text. Links wird der passende Code gelb markiert. So siehst du, welches Tag was bewirkt.

Hochgestellt und tiefgestellt gehen nicht gleichzeitig: Drückst du x², wird aus tiefgestelltem Text hochgestellter.

## Farbe

Markiere Text und drücke **Farbe**. Markierst du einen ganzen Absatz, bekommt der Absatz die Farbe: `<p style="color: red">`. Sonst steht um den Text ein `<span>`. Um eine Farbe wieder zu entfernen, markiere denselben Text und drücke „Farbe entfernen“.

## Tabellen

1. Setze den Cursor in den Absatz, hinter dem die Tabelle stehen soll, und drücke **Tabelle**.
2. Gib an, wie viele Zeilen und Spalten du brauchst. Mit „Erste Zeile als Überschrift“ wird die erste Zeile fett (`<th>`). „Mit Rahmenlinien“ zeichnet Linien um die Zellen (`border="1"`).
3. Mit der **Tab-Taste** springst du in die nächste Zelle, mit Umschalt+Tab zurück.
4. Fehlt eine Zeile oder Spalte? Setze den Cursor in eine Zelle und drücke wieder **Tabelle**. Dann kannst du Zeilen und Spalten einfügen oder löschen.

Eine ganze Tabelle löschst du links im Code: von `<table` bis `</table>`. Auch Tabellen mit `<colgroup>` (dort sind die Spalten eigens festgelegt) und Tabellen mit verbundenen Zellen änderst du links im Code.

## Titel der Seite

Über deiner Seite steht das Feld **Titel**. Was du dort schreibst, steht im Code im Tag `<title>` und später oben im Tab des Browsers. Drücke Enter, wenn du fertig bist.

## Bilder

Lege das Bild zuerst in deinen Projektordner. Drücke dann **Bild** und wähle die Bilddatei aus. Im Code steht nur der Name der Datei, zum Beispiel `<img src="katze.jpg" alt="">`.

Liegt das Bild in einem Unterordner, schreibst du dessen Namen in das Feld „Unterordner“, zum Beispiel `bilder`. Im Code steht dann `bilder/katze.jpg`. Der Editor erfährt nicht, aus welchem Ordner du ein Bild ausgewählt hast. Deshalb musst du den Unterordner selbst eintragen.

Unter dem Feld zeigt dir der Editor, was im Code stehen wird, und ob er das Bild dort findet: **Gefunden** oder **Nicht gefunden**.

**Wichtig:** Der Editor findet deine Bilder nur, wenn deine Seite im selben Ordner liegt wie der Editor.

Im selben Fenster kannst du das Bild beschreiben (diese Beschreibung hören Menschen, die das Bild nicht sehen können) und eine Breite in Pixeln angeben. Beides ist freiwillig.

Zum Ändern klickst du das Bild rechts an und drückst wieder **Bild**. Mit **Link** machst du aus einem angeklickten Bild einen Link. Mit der Taste Entf löschst du ein angeklicktes Bild. Mit **Links**, **Mitte** und **Rechts** stellst du ein, wo das Bild in seiner Zeile steht.

Steht statt eines Bildes ein Kasten mit „Bild nicht gefunden: …“, liegt unter dieser Adresse keine Datei. Über der Seite steht dann auch, welche Bilder fehlen. Lege die Datei an die richtige Stelle oder ändere die Adresse. Wenn du danach zum Editor zurückkehrst, sucht er das Bild noch einmal.

### Bilder aus dem Internet

Bilder aus dem Internet zeigt der Editor nicht an. Lade das Bild herunter, lege es in deinen Projektordner und verlinke es mit seinem Dateinamen. Denk dabei an das Urheberrecht: Nicht jedes Bild aus dem Internet darfst du verwenden.

## Speichern

Drücke **Speichern** (oder die Tasten Strg+S) und wähle beim ersten Mal, wohin die Datei soll. Oben rechts steht, ob deine Seite gespeichert ist.

**Wichtig:** Der Editor merkt sich nichts. Wenn du das Fenster schließt, ohne zu speichern, ist deine Arbeit weg.

Oben rechts steht **Speichert …**, solange die Datei geschrieben wird. Auf einem Netzlaufwerk kann das einen Moment dauern. Drückst du in dieser Zeit noch einmal Speichern, speichert der Editor danach einmal deinen neuesten Stand. Öffne in dieser Zeit am besten keine andere Datei.

Mit **Herunterladen** bekommst du eine Kopie in den Ordner „Downloads“.

Oben rechts siehst du, ob deine Seite gespeichert ist: **● nicht gespeichert** oder **Speichert …** (orange) oder **gespeichert** (grün).

## Seite im Browser ansehen und Links testen

Drücke **Im Browser öffnen**. Deine gespeicherte Seite öffnet sich in einem neuen Tab, so wie andere sie später sehen. Dort funktionieren deine Links und Skripte. Probiere alle Links aus: Führen sie wirklich zu deinen anderen Seiten?

* Ist deine Seite noch nicht gespeichert, fragt der Editor zuerst.
* Steht im neuen Tab „Datei nicht gefunden“, liegt deine Seite nicht im Ordner des Editors.

Das geht auch ohne den Knopf: Speichere die Seite und doppelklicke die Datei im Ordner.

## Wenn etwas schiefgeht

* **Rückgängig** (Strg+Z) nimmt den letzten Schritt zurück. **Wiederholen** (Strg+Y) holt ihn wieder.
* **Rechts lässt sich nichts mehr schreiben?** Dann ist im Code links etwas nicht richtig geschlossen, zum Beispiel fehlt ein `</p>`. Der Editor zeigt dann einen Hinweis. Korrigiere den Code links.
* **Ein Fenster des Editors verdeckt deine Seite?** Ziehe es an seiner Überschrift zur Seite.
* **Eine Stelle hat einen gestrichelten Rahmen?** Diese Stelle kannst du nur links im Code ändern.
* **Code aufräumen** rückt den Code ordentlich ein. Am Inhalt ändert sich nichts. Würde deine Seite danach anders aussehen (das kann am CSS liegen), lässt der Editor den Code, wie er ist, und sagt dir warum.

## Was der Editor nicht anzeigt

Skripte, Formulare, Videos und Bilder aus dem Internet sind im Editor ausgeschaltet. In deinem Code bleibt alles erhalten. Wenn du die gespeicherte Datei im Browser öffnest, funktioniert es dort.

## Tasten

| Tasten | Wirkung |
| --- | --- |
| Strg+S | speichern |
| Strg+O | Datei öffnen |
| Strg+Z | rückgängig |
| Strg+Y | wiederholen |
| Strg+B | fett |
| Strg+I | kursiv |
| Strg+U | unterstrichen |
| Tab (in einer Tabelle) | nächste Zelle, mit Umschalt zurück |
| Tab (links im Code) | zwei Leerzeichen einrücken |
