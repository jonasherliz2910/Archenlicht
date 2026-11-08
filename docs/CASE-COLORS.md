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

Die gelieferten PNGs bleiben bytegleich. Der SVG-Renderer legt die ursprünglichen
Bildpixel über die gewählte Vollfläche und blendet ausschließlich das Papier mit
versionierten Luminanzmasken aus. Die Masken werden mit
`node scripts/design-masks.mjs` reproduziert. Sie bewahren eingeschlossene helle
Innenflächen; für bewusst offene Konturen der Hand und von Mutter/Kind sind
Maskenbrücken bzw. eine dokumentierte Kontur hinterlegt. Die PNG-Ausgabe wird
aus demselben SVG gerendert. Es gibt keine gespiegelt wiederholten Motive oder
abweichend weißen Flächen neben dem Ausgangsbild.

Masken und Quellbilder sind über SHA-256 verknüpft; beide Hashes gehen in die
gespeicherte Gestaltung ein. Die Maske bleibt direkt im gespeicherten SVG, auch
wenn das große Originalmotiv in Neon als unveränderlicher Artwork-Blob abgelegt
wird. Früher gespeicherte Druckdateien bleiben abrufbar und unverändert.

`archenlicht-package-layout-v6-storm-size` hält die bisherige Standardgröße als
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

- 55 automatisierte Tests: 53 bestanden, 2 externe Integrationstests ohne
  Testzugänge übersprungen; keine Fehler.
- Farben aller sechs Motive gerastert: identische Motivgröße je Farbwechsel,
  korrekte Hintergrundwerte, Textkontrast, keine Änderung des Originalbilds.
- 74 Modelle × 6 Motive × beide Hüllenarten: Rand, Kameraabstand, Größenobergrenze
  und bei Flip Abstand zur Falz geprüft.
- Masken erhalten die hellen Innenflächen; alle Motive auf Schwarz visuell geprüft.
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
