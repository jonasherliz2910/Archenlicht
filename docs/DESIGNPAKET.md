# Designpaket v2 Farbe · Integration vom 5. November 2026

Grundlage ist die vorrangige [UPDATE-ZUERST-LESEN.md](../Archenlicht-Designpaket-v2-Farbe/Archenlicht-Designpaket-v2-Farbe/UPDATE-ZUERST-LESEN.md) zusammen mit der [CODEX-INTEGRATION.md](../Archenlicht-Designpaket-v2-Farbe/Archenlicht-Designpaket-v2-Farbe/CODEX-INTEGRATION.md). Die bestehende Shop-, Warenkorb-, Zahlungs- und Bestelllogik bleibt zuständig. Die eigenständige Demo ersetzt keine Shopseite.

## Motive und Inhalte

Die sechs neuen farbigen Original-PNGs liegen bytegleich unter `public/assets/designpaket-v2-farbe/`. Sie enthalten Illustration mit dezenten Aquarellfarben und hellem Hintergrund, keine Versstelle, Widmung oder Marke. Flügel und Lamm messen 962 × 1.634 px, die anderen vier 962 × 1.635 px. `server/design-package.json` übernimmt das neue Manifest; `server/design-assets.js` prüft die Dimensionen je Bild und berechnet die Bildprüfsummen. Die vorhandene Caveat-Datei entspricht exakt der Schrift aus dem neuen Paket, einschließlich vorhandener SIL-Lizenz. Das bisherige Verzeichnis `public/assets/designpaket-v1/` und alte Bestellexporte bleiben erhalten.

| Motiv | Feste Versstelle |
|---|---|
| Unter seinen Flügeln | Psalm 91,4 |
| Nach dem Sturm | Markus 4,39 |
| Absetzen | Matthäus 11,28 |
| Ganz nah | Psalm 131,2 |
| Im Schatten | Psalm 121,5 |
| Getragen | Jesaja 40,11 |

Feste Produkte erhalten ausschließlich ihre Versstelle. Wunschvers-Produkte ersetzen diese vollständig durch die gewählte geprüfte Stelle und ihren wortgetreuen kurzen Originalauszug. Eine optionale Widmung steht getrennt darunter. Der Server leitet alle Versinhalte aus dem Katalog ab; vom Browser übergebene Textmetadaten werden nicht als Quelle verwendet. Situationsbeschreibungen bleiben flüchtig und gehören zu keiner Druckkonfiguration.

## Layout und Speicherung

`archenlicht-package-layout-v4-farbe` passt jedes Originalbild mit `Math.min` proportional und vollständig in die simulierte Modellfläche ein. Fehlende Fläche wird mit dem Papierhintergrund aus dem jeweiligen leeren Bildrand fortgesetzt. Originalbild und Illustration bleiben unverändert. Das finale Druckbild verwendet weder `cover` noch `slice`. Die Hüllenansicht nutzt das Modellseitenverhältnis, `contain`, automatische Bildhöhe und einen passenden hellen Hintergrund; andere Produktbilder werden nicht pauschal verändert. Kamerapositionen beziehen sich auf dieselben Modellabmessungen.

Die neuen normierten Textflächen werden auf die tatsächliche Originalbildfläche bezogen und mit demselben Faktor samt horizontalem/vertikalem Versatz transformiert. Die 2.000 px hohe Demoleinwand ist kein Koordinatensystem für diese Boxen. Test-Sicherheitsrand und Test-Kamerazone werden berücksichtigt. Jede sichtbare Textzeile wird anhand der tatsächlichen Caveat-Glyphgrenzen horizontal zentriert. Texte und Hüllenansichten bleiben gerade ausgerichtet.

Versstellen und Widmungen bleiben einzeilig; Auszüge haben maximal drei Zeilen. Jonas’ vergrößerte Schriftbereiche bleiben erhalten: 28–48 px für Referenzen, 27–36 px für Auszüge und 25–30 px für Widmungen, bezogen auf die 962 px breite Quelle. Die Textpositionen stammen aus v2. Bei „Im Schatten“ ist die Referenzfläche nach Pixelprüfung etwas schmaler (`x=0,37`, `width=0,26`), damit die vergrößerten Buchstaben Abstand zu den neuen Zweigen halten. Das gelieferte Manifest bleibt unverändert, die gezielte Anpassung steht in `server/design-assets.js`. Nicht passende Texte und fehlende Schriftzeichen blockieren den Warenkorbzugang. Kein Text wird abgeschnitten oder automatisch umformuliert.

Motiv, Layoutversion, Modellvorlagenversion, Bildprüfsumme, Schriftprüfsumme, Versstelle, exakter Auszug und Widmung werden strukturiert gespeichert. Das autoritative SVG enthält die unveränderte PNG als eingebettetes Bild und die getrennten Textblöcke als Schriftpfade. Vorschau, Warenkorb und PNG-Export nutzen dieselbe gespeicherte Datei und denselben Hash. Vorhandene Druckdateien werden beim Aktualisieren des Shops nicht überschrieben.

## Prüfung und Reproduktion

`Start-Shop.cmd design-previews` erzeugt zwölf Shop-PNGs und den [Layoutbericht](previews/designpaket-v2-farbe/layout-pruefung.json). [Vergleichsbild](previews/designpaket-v2-farbe/vergleich.png): oben die sechs festen Produkte, unten derselbe Wunschvers mit Widmung. Alle zwölf wurden als Bild kontrolliert; Verse sind horizontal und von den Dekorzweigen getrennt.

Zusätzlich entstehen 24 Exporte auf **synthetischen Geometrie-Testflächen** mit 1.000 × 2.400 und 1.400 × 2.400 px. [Schmal/breit vergleichen](previews/designpaket-v2-farbe/schmal-breit.png): vier Reihen, schmal fest, schmal personalisiert, breit fest, breit personalisiert. [Geometriebericht](previews/designpaket-v2-farbe/geometrie-pruefung.json). Alle 24 Exporte wurden visuell kontrolliert. Diese Flächen werden nicht in den verkaufbaren Katalog eingefügt und sind keine bestätigten Podbase-Vorlagen. Alte Vorschaudateien bleiben im bisherigen Ordner erhalten.

Die automatische Prüfung deckt Originaldateien und Schrift, Bildmaße je Motiv, neue Textboxen, alle sechs festen Referenzen, neun Wunschverse auf vier repräsentativen Testschablonen, Umlaute, lange Referenzen/Wörter, drei Zeilen, fehlende Glyphen, Überlauf und unveränderliche gespeicherte Exporte ab. Pixeltests prüfen Farbübergänge und Papiertextur sowie freie Originalbildpixel um die vergrößerten Texte. Auf den 24 schmalen/breiten Entwürfen werden vollständige Bild-/Textgrenzen, identische Skalierung, Modellmaße und die gerenderten Pixel von SVG und PNG verglichen. Der PNG-Renderer übernimmt die tatsächlichen SVG-Modellabmessungen statt einer festen 1.200 × 2.400-Ausgabe. Die Gesamtsuite prüft zusätzlich sämtliche 444 festen Modell-/Motivkombinationen und die vollständigen lokalen Kaufwege. Ergebnis: 37 Tests bestanden; 22 JavaScript-Dateien syntaktisch geprüft. Die Bildprüfung ersetzt keine Browser- oder Druckabnahme.

Nach dem Serverneustart wurden alle sechs Blankodateien und zwölf Vorschauen zusätzlich über HTTP mit den lokalen Originalen beziehungsweise dem autoritativen Renderer abgeglichen. Ein PNG stimmt bytegleich mit dem Export überein. Vorhandene SVGs, PNGs, Bestellpositions-Snapshots und die Anzahl der Kundenkonten blieben erhalten. Die Browserabnahme ist offen: Der Windows-Computer-Use-Helfer war auch nach Wiederherstellung nicht erreichbar (native Pipe fehlt, Betriebssystemfehler 2).

## Produktionsstatus

`productionApproved` bleibt `false`. Die Originalmotive haben 962 × 1.634/1.635 px und sind zusammengefügte Vorschaubilder. Ein größerer Export mit 300-dpi-Metadaten erzeugt keine zusätzlichen Bilddetails. Es fehlen hochauflösende geeignete Master, bestätigte modellbezogene Podbase-Vorlagen, physische Mindestschriftgrößen sowie reale Druckmuster. Der bestehende lokale Testkauf bleibt verfügbar; echte Produktion ist weiterhin gesperrt.
