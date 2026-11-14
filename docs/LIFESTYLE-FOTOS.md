# Produktgalerie und Lifestyle-Fotos

Stand: 14. November 2026.

Jedes der sechs Motive hat ein eigenes Fotopaar an Position 3 und 4 der Galerie.
Bild 3 zeigt die Hülle in einer Hand, Bild 4 auf einer passenden Tischfläche.
Die zwölf Fotos werden zwischen Motiven nicht wiederverwendet.

[Übersicht aller sechs Fotopaare](previews/lifestyle-v3/six-scenes.webp)

| Motiv | Hand | Umgebung und Licht |
| --- | --- | --- |
| Unter seinen Flügeln | Frauenhand, heller Strickärmel | Helles Fenster, Blumen, sanftes Morgenlicht |
| Nach dem Sturm | Männerhand, blaue Regenjacke | Küstenterrasse nach dem Regen, kühles Tageslicht |
| Absetzen | Männerhand, olivfarbene Jacke | Waldpause, Picknicktisch, gefiltertes Nachmittagslicht |
| Ganz nah | Frauenhand, roséfarbener Ärmel | Gemütliche Leseecke, Walnussholz und warmes Licht |
| Im Schatten | Frauenhand, salbeifarbener Leinenärmel | Olivenhof, heller Stein, Blattschatten |
| Getragen | Männerhand, dunkler Wollärmel | Buchhandlung, Eichentisch, warmes Fensterlicht |

## Dateien und Entstehung

Das eingebaute `image_gen`-Werkzeug erzeugte alle zwölf Fotos als gezielte
Bearbeitung der vorhandenen unbedruckten Hüllenfotos. Es wurde keine Imagegen-CLI
und kein anderer Bilddienst verwendet. Telefonposition, Perspektive und
Kamerabereich bleiben an den vorhandenen Vorlagen ausgerichtet.

Die ausgelieferten Dateien liegen unter `public/assets/lifestyle-v3/`:

- `<motiv-id>-hand.webp` und `<motiv-id>-table.webp`: Fotos, 1122 × 1402 Pixel,
  WebP-Qualität 94.
- `<motiv-id>-hand-mask.png` und `<motiv-id>-table-mask.png`: geprüfte Masken
  für die bedruckte Hüllenfläche; Hände, Hintergrund und Kamera sind ausgespart.

Alle konkreten Asset-Pfade, PNG-Quelldateinamen, Bildreferenzen und vollständigen
finalen Prompts stehen in [lifestyle-six-scenes-v3.json](lifestyle-six-scenes-v3.json).
Die Originalausgaben bleiben im lokalen Codex-Verzeichnis erhalten.

## Originalmotive, Farben und Vorschauen

`public/lifestyle-photos.js` setzt die unveränderten Originalmotive und Texte
aus derselben SVG-Druckvorschau wie die ersten beiden Ansichten ein. Die
ausgewählte Hintergrundfarbe, eigener Text und Widmung werden perspektivisch
eingepasst und mit Licht und Schatten des Fotos verrechnet. Persönliche Texte
werden nicht an einen Bilddienst geschickt.

Die Lifestyle-Bilder bleiben als Designbeispiele am iPhone 18 Pro gekennzeichnet.
Die ersten beiden Ansichten zeigen weiterhin das gewählte Handymodell. Fotos
ändern weder die Druckdatei noch das bestellte Modell oder die MagSafe-Auswahl.

`public/lifestyle-scenes.js` ordnet jedem Motiv genau ein exklusives Paar zu und
enthält die Kalibrierung. Fotos werden erst geladen, wenn ihre Ansicht oder ihre
Miniatur sichtbar wird. Der Speicher für vorbereitete Fotodaten ist auf
zwei Paare begrenzt. Farb- und Motivwechsel verwerfen veraltete Render-Ergebnisse.

## Prüfung

- Automatisierte Prüfung aller zwölf unterschiedlichen Dateien, Bildmaße,
  Masken und perspektivischen Druckecken.
- Visuelle Kontrolle aller Szenen mit dunkler Hüllenmaske, insbesondere an
  Kamera und Fingern.
- Browserprüfung der sechs Produktgalerien, aller neun Farben am Desktop und
  der weißen/schwarzen Varianten auf Mobilgeräten; zusätzlich Wechsel im
  Konfigurator mit eigenem Text.
- Die bestehende Modellvorschau und ihre Bestellbarkeitsprüfung bleiben erhalten.

Die älteren Vorlagen liegen weiterhin in `lifestyle-v1` und `lifestyle-v2`.
Die Umstellung der Beispielkamera ist in
[preview-model-iphone18.json](preview-model-iphone18.json) dokumentiert.
