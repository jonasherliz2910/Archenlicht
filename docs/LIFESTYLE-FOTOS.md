# Produktgalerie und Lifestyle-Fotos

Stand: 10. November 2026.

Die Galerie enthält vier Ansichten: zwei modellbezogene Vorschauen und zwei
zusätzliche Lifestyle-Fotomontagen. Vier beschriftete, tastaturbedienbare Punkte
ersetzen die sichtbaren Umschalttexte. Die Fotos sind als Designbeispiel am
iPhone 14 Pro gekennzeichnet; die ersten beiden Ansichten zeigen das gewählte
Handymodell und dessen Kameraaussparung.

## Bilddateien und Herkunft

Die vier Bildvorlagen wurden mit dem eingebauten `image_gen`-Werkzeug erzeugt,
visuell geprüft und als WebP (Qualität 92, 1122 × 1402 Pixel) im Projekt gespeichert:

- `public/assets/lifestyle-v1/female-hand.webp`: natürliche Frauenhand im Café.
- `public/assets/lifestyle-v1/female-table.webp`: Hülle auf einem Cafétisch.
- `public/assets/lifestyle-v1/male-hand.webp`: natürliche Männerhand im Garten.
- `public/assets/lifestyle-v1/male-table.webp`: Hülle auf einem Tisch am Fenster.

Die zugehörigen `*-mask.png` enthalten die geprüfte Druckfläche einschließlich
der Seitenwände. Hände, Umgebung und Kamerahardware sind ausgespart. Die Masken
wurden mit OpenCV GrabCut, geometrischen Startkonturen und einer schmalen
Kantenglättung erzeugt. OpenCV wird nur für die Bildvorbereitung benötigt;
die Website benötigt keine zusätzliche Bibliothek.

Quellbilder unter dem lokalen Codex-Verzeichnis
`generated_images/01a1a2ec-2646-7621-99db-a849623028bb/`:

| Bildvorlage | Generierte PNG-Datei |
| --- | --- |
| female-hand | exec-a90f9757-7522-431e-9902-17d825a200c8.png |
| female-table | exec-49dd9de2-9e79-4578-8aea-33e572019b76.png |
| male-hand | exec-6239dba6-d6f1-4156-8c3d-2374a488861a.png |
| male-table | exec-a836edfc-1398-4653-a56f-d0fe6db03cae.png |

## Verwendete Bildvorgaben

Gemeinsam: hochwertige, natürliche Lifestyle-Produktfotografie im Hochformat
4:5; iPhone 14 Pro mit normaler Dreifachkamera und matter Hülle; plausible
Anatomie und natürlicher Griff; keine künstliche Handfläche, keine verformten
Finger, keine CGI-Optik, kein Wasserzeichen. Die ursprünglichen Motive dienten
als Produktreferenz. Für die programmatische Montage wurde die Hülle anschließend
ohne Änderung der Szene in eine unbedruckte weiße Hülle umgewandelt.

Szenen-Prompts:

1. Erwachsene Frau mit elfenbeinfarbener Strickjacke hält das Smartphone locker
   und natürlich, Display zur Person, Hüllenrückseite zur Kamera. Die Handfläche
   ist größtenteils hinter dem Handy. Eichentisch im Café, unscharfer grüner
   Innenhof mit Steinarchitektur, warmes Tageslicht, echte Hautstruktur, kurze Nägel.
2. Dasselbe Produkt liegt mit der Rückseite nach oben auf einem Eichentisch
   im Außencafé. Teilweise angeschnittene keramische Cappuccinotasse, ruhiger
   grüner Hintergrund und warmes Tageslicht; glaubwürdige Perspektive und Schatten.
3. Erwachsener Mann sitzt auf einer Gartenbank und hält das Smartphone entspannt.
   Dunkelblauer Leinenärmel, beige Hose, grüne Gartenkulisse und unscharfer Stein,
   weiches Morgenlicht, anatomisch korrekter Griff und natürliche Hautstruktur.
4. Produkt mit der Rückseite nach oben auf einem hellen Eichentisch am großen
   Fenster; Pflanzen im Hintergrund, salbeifarbenes Leinen, weiches kühleres
   Tageslicht und natürliche Kontaktschatten.

Abschließender Edit-Prompt für alle vier Vorlagen:

> Precise product-photo edit. Keep this photograph, exact composition, phone
> position, camera hardware, hands, fingers, surrounding environment, framing
> and lighting completely unchanged. Change ONLY the printed exterior phone
> case: remove ALL illustration, leaves, lettering and text from the case,
> leaving a completely blank clean WARM WHITE #FAFAF8 satin case. No ghost of
> the artwork. Preserve case's natural real shading, subtle highlights, rounded
> bevel, edges, camera rim and texture. Do not add anything. Keep silhouette,
> hand anatomy, background pixel-aligned as closely as possible. White-case
> template for placing original print by code. Same portrait 4:5/full resolution;
> no watermark.

## Originalgrafiken und Personalisierung

`public/lifestyle-photos.js` verwendet dieselbe SVG-Druckvorschau wie die ersten
beiden Ansichten. Schrift, Motiv, Farbe und Widmung werden nicht durch KI neu
gezeichnet. Die proportionale Druckfläche wird perspektivisch projiziert und
mit der vorhandenen Beleuchtung der weißen Hülle verrechnet. Die Montage läuft
im Browser; persönliche Texte werden dafür nicht an einen Bilddienst gesendet.

`public/lifestyle-scenes.js` enthält die perspektivischen Eckpunkte und die
Startkonturen der Maskenkalibrierung. Drei Motive verwenden das Café-Szenenpaar,
drei das Garten-/Fenster-Szenenpaar. Alle neun Hüllenfarben funktionieren mit
beiden Paaren. Die Fotobeispiele ändern weder Druckdatei noch Bestellvariante.

Fotos werden erst beim Aufrufen der jeweiligen Ansicht geladen. Bei einer
neuen Eingabe wird die alte Montage ausgeblendet; verspätete Antworten dürfen
keine neuere Auswahl überschreiben. Fehler lassen die modellbezogenen
Vorschauen weiterhin nutzbar.

## Prüfung

- 108 Kombinationen (6 Motive × 9 Farben × 2 Fotos) im lokalen Browser erzeugt
  und als sechs Kontaktbögen visuell verglichen.
- Originalgrafiken und Farbkontrast, Kamera- und Handmasken, dunkle Ränder sowie
  proportional erhaltene Texte geprüft.
- Wechsel zwischen Apple, Google und Samsung Flip, MagSafe, Freitext, Widmung
  und verspätete Farbanfragen im lokalen Browser geprüft.
- Vier Punkte mit 44-Pixel-Zielflächen, Tastatur, Größenänderung und echtes
  Touch-Wischen im mobilen Testbrowser geprüft.
- Ergänzende Tests prüfen Perspektivprojektion, vollständige Szenenzuordnung
  und Maskendateien; bestehende Modell-, Farb- und Freitexttests bleiben gültig.

Lokale Prüfbilder und Protokolle: `test-results/lifestyle-gallery/` (nicht im Git).
Die generierten Szenen sind Designbeispiele und keine Aufnahmen eines bereits
produzierten Musters.
