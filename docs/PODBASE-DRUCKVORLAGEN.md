# Druckvorlagen: Abgleich vom 11. November 2026

64 Standardmodelle und 38 magnetische Modelle besitzen jetzt eine technisch
prüfbare Druckvorlage. Dies ist keine Freigabe von Verkauf oder Produktion.

## Behoben: iPhone 17

Podbase liefert für das iPhone 17 die Sicherheitskontur und den Kameraausschnitt
als gemeinsame Rasterebene in der offiziellen PSD. Der bisherige Import
verlangte eine Vektorebene und hat dieses Modell deshalb ausgeschlossen.

Der Import gewinnt jetzt beide geschlossenen Konturen aus den Originalpixeln.
Die Kamerasperrfläche schließt auch die geglätteten Randpixel ein. Es werden
keine Abmessungen eines anderen Telefons übernommen. Die Druckprüfung hält
weiterhin 45 Pixel Sicherheitsabstand ein. Die übrigen Vorlagen und ihre
Prüfsummen bleiben unverändert.

- Standard: `PBV-4EY-2LR-225P`.
- MagSafe: `PBV-4EY-2VR-22FL`.
- Druckdatei: 2000 × 3400 Pixel, 300 dpi, vollflächiger Hintergrund.
- Vorlage wird für feste Motive und personalisierte Texte verwendet;
  MagSafe verändert weder Motiv, Text noch Skalierung.

## Noch nicht vollständig belegte Modelle

| Modelle | Fehlender Nachweis in den aktuell veröffentlichten Dateien |
| --- | --- |
| iPhone 17e | Modellgenaue Sicherheits- und Kamerakontur; die Dateianforderungen sind vorhanden. |
| iPhone 18 Pro, iPhone 18 Pro Max | Dateianforderungen für die konkreten Standard-/MagSafe-Varianten. Die PSD nennt bereits gemeinsam genutzte Konturen mit 17 Pro bzw. 17 Pro Max. |
| Google Pixel 10a | Dateianforderungen für die konkreten Standard-/Magnet-Varianten. Die PSD-Kontur ist vorhanden. |
| Samsung Galaxy S26 FE, Galaxy A27, Galaxy Z Flip8 | Modellgenaue Konturen und Dateianforderungen; beim Flip zusätzlich die genaue Trennung der Klapphälften. |
| Google Pixel 11, Pixel 11 Pro, Pixel 11 Pro XL | Modellgenaue Konturen und Dateianforderungen. |

Diese zehn Standardmodelle und neun magnetischen Varianten werden weiterhin
nicht zur Bestellung freigeschaltet. Ein Katalogeintrag mit Bestand belegt
noch keine vollständige Druckspezifikation. Der API-Katalog liefert pro
Variante nur ID, Name und Bestand, keine Druckmaße oder Kamerakonturen.

Die genaue Zuordnung mit Produkt- und Variantenkennungen steht in
[podbase-print-template-gaps.json](podbase-print-template-gaps.json).

## Prüfung der Änderung

- 25 relevante JavaScript-Tests bestanden, ein externer Neon-Test mangels
  Testdatenbank übersprungen; zusätzlich drei Python-Tests für den Import.
- Bestehende 63 Standard- und 37 magnetische Vorlagen behalten ihre Hashes.
- Alle jetzt belegten Modelle wurden mit den sechs Motiven und Wunschtexten
  gegen die Konturen geprüft. Für das neue iPhone 17 zusätzlich alle neun
  Farben, beide Hüllenarten und eigene Texte; kein Motiv-/Textpixel außerhalb
  der sicheren Druckfläche.
- Browserprüfung bei 390 und 1440 Pixel Breite: Produkt, MagSafe-Wechsel,
  Personalisierung und Bundle. Die Kassensperre bleibt aktiv.
- Keine echte Zahlung, Bestellung oder Produktionsfreigabe ausgelöst.

## Quellen und Wiederholbarkeit

Am 11. November erneut heruntergeladen und mit dem bisherigen Bestand
verglichen: Beide Anbieterdateien sind unverändert.

- [Podbase-Anleitung für API-Druckdateien](https://help.podbase.com/hc/en-us/articles/26709497957532-How-to-prepare-print-files-for-Podbase-API).
- [Offizielle PSD mit Modellkonturen](https://drive.google.com/file/d/1SvuCd1eDkq2VKgky2NRi6NpEF9CZTUB2/view).
- [Offizielle Tabelle der Dateianforderungen](https://docs.google.com/spreadsheets/d/1shTH2o9K3sN0RyWYUzk8tLADDNgB-qixPxnwQGvOiqM/edit?gid=969391465).

Quell-Hashes stehen in `server/podbase-print-templates.json`. Die Originaldateien
werden lokal unter `.tools/podbase-print-references/` abgelegt. Mit `psd-tools`,
Pillow und NumPy lässt sich `scripts/import-podbase-templates.py` erneut ausführen.
`tests/podbase-raster-guide.test.py` prüft zusätzlich, dass offene, fehlende oder
mehrdeutige Konturen abgewiesen werden. Der Import stellt keine Bestellungen.

## Vorbereitete Anfrage an Podbase – nicht versendet

Bitte stellt uns die aktuellen Druckspezifikationen für die oben aufgeführten
Modelle und Varianten bereit. Benötigt werden die Dateiabmessungen, der
Druckdateityp (vollflächig oder mit transparenter Außenfläche), die sichere
Druckkontur und alle Kamera-/Display-/Scharnierausschnitte für Tough Phone Case
sowie die angebotenen MagSafe/Magnetic Tough Phone Cases. Bei gemeinsam
genutzten Vorlagen benötigen wir eine Bestätigung für die jeweiligen
Variantenkennungen. Die vollständige Variantenliste ist in der beigefügten
Datei `podbase-print-template-gaps.json` enthalten.
