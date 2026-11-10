# Fotografische Produktansichten

Die Hüllen erscheinen auf Startseite, Kollektion, Produktseiten, in der personalisierten Vorschau, Bundle-Konfiguration, Warenkorb und Bestellübersicht im selben Fotostudio. Die ersten beiden Galeriebilder zeigen die Hülle am Gerät und mit offener Kameraaussparung; die beiden vorhandenen Lifestyle-Bilder bleiben erhalten.

## Herkunft und Grenzen

Die 21 neutralen Fotovorlagen wurden mit dem integrierten **image_gen** erzeugt, nicht mit dem CLI-Fallback. Es sind KI-generierte Fotomontagen, keine Fotos bereits hergestellter Podbase-Muster. Ähnliche Geräte teilen sich eine Vorlage für ihre Kamerafamilie; die Bilder sind keine maßgenauen Herstellerabbildungen. Die Beschriftung lautet „Fotovorschau“. Verbindliche Produktionsmaße kommen weiterhin ausschließlich aus den ausgewählten Podbase-Druckvorlagen.

- Originaldateipfade und sämtliche tatsächlich verwendeten Prompts: [studio-photo-sources.json](studio-photo-sources.json).
- 21 WebP-Vorlagen und zugehörige Masken: public/assets/studio-v2/, 1122 × 1402 Pixel.
- Sechs fertig zusammengesetzte Kollektionsbilder: public/assets/studio-v2/catalog/, 672 × 840 Pixel, Beispielgerät iPhone 15 in Weiß.
- Perspektive, Kameraöffnungen und Zuordnung: public/studio-scenes.js. 19 Kamerafamilien plus zwei separate Pixel-Vorlagen mit zwei Objektiven decken die 74 derzeit angebotenen Modelle ab.

## Originalgestaltung und Darstellung

public/studio-photography.js legt die vorhandene Druckvorschau über printFrame auf die fotografierte Fläche. public/studio-compositor.js übernimmt Perspektive, Farbe, Beleuchtung und Materialreflexe. Vers, Schrift und Illustration werden nicht neu generiert. Die Kamera und der Studioschatten stammen aus der Bildvorlage. In der zweiten Ansicht werden ausschließlich die Kameraöffnungen mit Hintergrund und einem inneren Randschatten gefüllt.

Alle neun Farben, die Platzierung auf einer Klapphälfte bei Galaxy Z Flip und die bestehende Druckskalierung bleiben erhalten. MagSafe verändert weiterhin die echte Bestellvariante; ein sichtbarer Magnetring wird nicht erfunden. Das Rendering verändert keine Druckdateien oder Bestellung.

Die Galerie verwirft veraltete Ergebnisse nach einem Farb- oder Modellwechsel. Die gesamte Hülle bleibt durch object-fit: contain sichtbar. Statische Kollektionsbilder laden ohne Canvas-Berechnung; konfigurierte Vorschaubilder werden bei Annäherung an den sichtbaren Bildschirmbereich erstellt. Foto- und Maskencaches sind begrenzt. Bei einem fehlgeschlagenen Fotodownload bleibt in der Produktgalerie die bisherige schematische Vorschau bedienbar. Three.js/WebGL und die alten lokalen Three-Browsermodule werden nicht mehr benötigt.

## Reproduzieren

Die fertigen WebP- und PNG-Dateien sind versioniert; für Betrieb und Deployment ist keine Bildgenerierung erforderlich. Für erneute Aufbereitung müssen die im Manifest genannten Quelldateien vorhanden sein:

1. node scripts/prepare-studio-photos.mjs erstellt WebPs und geometrische Maskenvorlagen.
2. python scripts/studio-photo-masks.py erstellt Masken mit OpenCV und NumPy (opencv-python-headless, numpy). Geprüfte, glatte Konturen verhindern ausgefranste Ränder bei dunklen Farben. Die RGB-Kanäle speichern bedruckbare Fläche, Kameraöffnung und inneren Randschatten.
3. node scripts/studio-catalog.mjs exportiert die sechs Kollektionsbilder mit denselben Kompositionsfunktionen wie im Browser.

Die Zwischendateien liegen standardmäßig im ausgeschlossenen Ordner test-results/studio-v2; STUDIO_WORK_DIR kann für die ersten beiden Schritte einen anderen Ordner festlegen. Die erzeugten Konturen und Kameraöffnungen müssen vor Veröffentlichung visuell geprüft werden.

## Eigenschaften und tatsächliche Aufrufe

Die vorhandenen Häkchen nennen Doppelschicht, Motiv ohne Markenaufdruck, Versand innerhalb Deutschlands inklusive und die Karte zum Selbstbeschriften. Fremde Material-, Schutz- oder Bewertungsversprechen werden nicht übernommen.

Der monatliche Hinweis erscheint erst ab 100 tatsächlich erfassten Besuchen eines festen Motivs. Er zählt Einwilligungen zur Statistik, einmal je Sitzung/Motiv, ausschließlich Live-Daten im aktuellen Kalendermonat nach Europe/Berlin. Er wird auf volle Hunderter abgerundet und bezeichnet Besuche, nicht Personen oder Käufe. Eigene Sitzung, zuordenbare Admin-Sitzungen, Testdaten, Warenkorbzugänge, personalisierte Ansichten und zukünftige Ereignisse zählen nicht. Unterhalb der Schwelle, im Testshop oder bei Fehlern bleibt er verborgen.

## Prüfung

tests/studio-photography.test.js prüft Vorlagen für alle angebotenen Modelle, vorhandene Bildmaße sowie die Trennung zwischen Druckfläche, Kamerapixeln, Hintergrund und offener Aussparung. Geräteprofil-, Lifestyle- und Aufrufstatistiktests bleiben erhalten. Zusätzlich werden Browseransichten auf Handy und PC, Galeriebedienung, Farb-/Modellwechsel, personalisierte Gestaltung, Bundle und Warenkorb geprüft. Eine Kontaktübersicht prüft alle 21 Vorlagen sowie die 54 Kombinationen aus sechs Motiven und neun Farben. Es werden dabei keine echten Bestellungen oder Zahlungen ausgelöst.
