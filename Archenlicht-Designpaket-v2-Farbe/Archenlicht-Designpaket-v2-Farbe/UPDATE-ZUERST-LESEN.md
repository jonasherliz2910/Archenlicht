# Update v2: dezente Farben, Blanko und zusätzlicher Hintergrund

Diese Datei zuerst lesen. Sie ergänzt CODEX-INTEGRATION.md und hat bei Abweichungen Vorrang.

- Sechs neue farbige Blanko-PNGs: keine Verse eingebaut, sehr heller Cremehintergrund, dezente Aquarellfüllungen.
- Die Quelldateien haben 962 × 1635 Pixel, Flügel und Lamm 962 × 1634 Pixel. Exakte Abmessungen stehen pro Motiv in designs.json. Keine globale Dimensionsprüfung ohne Berücksichtigung dieser Werte übernehmen.
- Die Motivgruppen wurden mit zusätzlichem Freiraum neu erzeugt; die neue Platzierung ist nicht pixelgenau aus v1 ableitbar. Neue Textflächen stehen im Manifest und müssen bei Integration mit Vorschauen geprüft werden. Alte Textkoordinaten nicht unverändert übernehmen.
- Die Demo rendert auf eine längere Leinwand von 962 × 2000 Pixeln. Das komplette Originalmotiv bleibt proportional erhalten; freier Hintergrund wird oben und unten ergänzt (rund 182 Pixel pro Seite). Derselbe Renderer wird für Vorschau und PNG-Download verwendet. Das ist keine universelle Druckschablone.

## Integration im vorhandenen Shop codexvs

Bei der Einsicht enthält server/layout.js bereits eine proportionale Anpassung mit Math.min und eine Verlängerung des Hintergrunds. Diese Eigenschaft erhalten. public/style.css enthält unter anderem .phone>img mit object-fit:cover. An der tatsächlich betroffenen Ansicht prüfen, ob das finale Bild an ein abweichendes Seitenverhältnis angepasst wird. Das kann beschneiden. Nicht pauschal alle Produktbilder ändern.

1. Neue Dateien unter einem versionierten Asset-Pfad aufnehmen; bisherige Bilder und gespeicherte Bestellexporte erhalten.
2. server/design-package.json und server/design-assets.js mit neuen Textflächen, Abmessungen je Bild und neuer Assetversion aktualisieren. Vorhandene Typografie-Anpassungen bewusst berücksichtigen; Texte dürfen die Zweige nicht berühren.
3. Die komplette Modellfläche mit dem passenden hellen Hintergrund füllen. Motiv und Text gemeinsam proportional einpassen; fehlende Höhe ausschließlich durch Hintergrund ergänzen. Kein cover/slice für die finale Druckvorschau und keine Verzerrung. Preview-Container soll zur Modellfläche passen. Falls contain verwendet wird, freie Flächen in derselben Hintergrundfarbe darstellen.
4. Feste Referenz, Wunschversauszug und Widmung aus denselben normierten Boxen auf die tatsächlich platzierte Bildfläche transformieren. Bei zusätzlichen Rändern den vertikalen Versatz mitrechnen. Nicht auf Höhe der 2000er-Demo normieren, wenn das Manifest auf die Originalbildfläche bezogen ist.
5. Bei jedem Motiv feste und personalisierte Vorschau auf mindestens einer schmalen und einer breiten Modellvorlage prüfen. Oben/unten keine abrupten Bildkanten, keine abgeschnittenen Linien/Texte. Browseransicht, gespeicherte SVG und PNG vergleichen.
6. Bestehende Überlaufprüfungen und Mindestschriftgrößen beibehalten. productionApproved bleibt false.

## Benutzung

node serve.mjs starten, http://127.0.0.1:4178 öffnen. Ein eventuell laufender alter Demoserver muss zuvor beendet werden. Die neue Seite zeigt die verlängerte Vorschau; der Button speichert diese als PNG. Die Dateien in assets bleiben die originalen Quelldateien.

Dieses Update ist ein Übergabepaket. Der bestehende Shop wurde hier nicht verändert. Die gemeldete Beschneidung ist noch nicht im Browser reproduziert und damit nicht abschließend behoben.
