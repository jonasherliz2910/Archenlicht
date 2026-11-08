# Hintergrundfarben und Flip-Platzierung

Stand: 8. November 2026. Jonas hat die Palette und die Platzierung auf einer
Klapphälfte anhand der Bildvorschauen freigegeben.

| Farbe | ID | Hintergrund |
|---|---|---|
| Weiß | white | #FAFAF8 |
| Beige | beige | #DCCDBB |
| Schwarz | black | #343638 |
| Hellblau | light-blue | #C8D9E3 |
| Dunkelblau | dark-blue | #43566C |
| Mintgrün | mint | #C5D7CB |
| Waldgrün | forest | #4D6558 |
| Flieder | lilac | #D6CEE3 |
| Grau | grey | #CBCDD0 |

Die Palette liegt gemeinsam für Browser und Server in `public/case-colors.js`.
Schwarz, Dunkelblau und Waldgrün verwenden helle Schrift, die anderen Farben
Waldgrün. Alle sechs Motive unterstützen dieselbe Palette. Die Farbe wird als
validierte `backgroundId` in Konfiguration, Warenkorb und Bestellsnapshot
gespeichert und ist Teil des Layout-Hashes. Ohne Farbangabe gilt Weiß.

## Originalmotive und Ausgabe

Die gelieferten PNGs bleiben bytegleich. `node scripts/design-foregrounds.mjs`
erzeugt daraus RGBA-Druckebenen in unveränderter Quellauflösung unter
`public/assets/design-foregrounds-v2`. Die früheren Luminanzmasken dienen als
Innenkontur; antialiasierte Ränder und offene Aquarellflächen erhalten abgestufte
Transparenz. Der Papieranteil wird auch aus den RGB-Randfarben entfernt, damit
auf dunklen Hüllen keine hellen Farbsäume entstehen. Haut, Wolle und andere helle
Innenflächen bleiben deckend. Wasser und offene Stoffenden laufen weich aus.
Konturen und Motivproportionen werden nicht weichgezeichnet oder vergrößert.

Der Renderer legt diese Ebene über die gewählte Vollfläche. Vorschau und
PNG-Druckdatei verwenden dasselbe SVG. Quellbild und RGBA-Ebene sind über
SHA-256 verknüpft; `artworkHash` und `renderHash` gehen in die gespeicherte
Gestaltung ein. Neon speichert die RGBA-Ebene als unveränderlichen Artwork-Blob.
Früher gespeicherte SVGs mit Originalbild und Maske bleiben abrufbar und unverändert.

`archenlicht-package-layout-v7-soft-edges` hält die bisherige Standardgröße als
Obergrenze, außer beim ausdrücklich vergrößerten Motiv „Nach dem Sturm“.
Boot, Welle und zugehöriger Text sind dort zehn Prozent größer. Die Wellenenden
halten mindestens 20 Einheiten Abstand zum inneren Anschnitt-Rand; für die Schrift
bleibt die bisherige Sicherheitsfläche maßgeblich. Kamera- und Falzabstände
bleiben unverändert. Alle aktiven Texte werden mit dem Motiv gemeinsam proportional
platziert. Beim Galaxy Z Flip liegt diese Gruppe vollständig unter der Falz,
einschließlich Wunschvers und Widmung. Kameraabstände und Vorschautransform
verwenden dieselbe Gerätegeometrie. Die Geometrie bleibt illustrativ; endgültige
Podbase-Druckschablonen und deren Produktionsfreigabe stehen weiterhin aus.

## Prüfung

- 57 automatisierte Tests: 55 bestanden, 2 externe Integrationstests ohne
  Testzugänge übersprungen; keine Fehler.
- Farben aller sechs Motive gerastert: identische Motivgröße je Farbwechsel,
  korrekte Hintergrundwerte, Textkontrast, keine Änderung des Originalbilds.
- 74 Modelle × 6 Motive × beide Hüllenarten: Rand, Kameraabstand, Größenobergrenze
  und bei Flip Abstand zur Falz geprüft.
- Alle 54 Motiv-/Farbkombinationen visuell geprüft. Rastertests sichern deckende
  Haut- und Wollflächen sowie einen stufenlosen Wasserverlauf ohne weißen
  Papierfleck auf Schwarz ab.
- Farbe über Bearbeitung, erneuten Warenkorbabruf und Bestellsnapshot geprüft;
  frühere Druckdatei blieb unverändert.
- Separater Playwright-/Edge-Testbrowser: neun Farben, vier Gerätefamilien,
  320/390/768/1440 Pixel, alle sechs Motive, personalisiertes Flip-Motiv und
  Warenkorbbearbeitung. Eine Modellauswahl, kein horizontaler Seitenüberlauf.
- Lokale Bildbelege und Browserberichte liegen in `test-results/colors` (ignoriert).
  Keine echten Zahlungen, E-Mails oder Produktionsaufträge wurden ausgelöst.
- Nach der Bootsvergrößerung erneut 53 Tests erfolgreich, 2 externe Tests
  übersprungen. Vergleich aller 888 Layouts: 148 Bootsvarianten exakt 10 % größer,
  740 übrige Layouts mit identischen Motiv- und Textpositionen. Zusätzliche
  Browserprüfung von Boot und Welle auf iPhone, Galaxy S, Pixel und Z Flip,
  einschließlich personalisierter Flip-Hülle; Belege in `test-results/storm-size`.
- Nach der Kantenkorrektur bleiben alle 888 Layouts geometrisch identisch zu v6.
  Bildbelege und Browserberichte zur neuen Freistellung: `test-results/matte`.
