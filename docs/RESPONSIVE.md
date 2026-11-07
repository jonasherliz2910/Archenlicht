# Mobile Darstellung

Geprüft am 7. November 2026. Die Anpassungen stehen gesammelt am Ende von
`public/style.css` und gelten nur bis 900 CSS-Pixel Bildschirmbreite. Die
bisherigen Regeln bleiben erhalten.

## Änderungen

- Navigation auf schmalen Tablets als aufklappbares Menü mit scrollbarem Inhalt.
- Produktansicht, Gestaltungsbereich und Kasse untereinander statt in zu engen Spalten.
- Umbrechende Texte und Bedienelemente; gleichmäßig aufgeteilte Gestaltungsschritte.
- Eigene Bereiche für Hüllen und begleitende Beschriftungen auf der Startseite.
- Warenkorbpreise unter den Produktinformationen, großzügigere Kontoformulare.
- Modellauswahl mit lesbaren Namen, scrollbarer Liste und erreichbarem Schließen-Knopf,
  auch bei geringer Bildschirmhöhe; auf sehr schmalen Geräten eine Modellspalte.

## Verifikation

Playwright 1.65.0 mit installiertem Microsoft Edge im separaten Headless-Browser.
Der lokale Shop lief mit einer eigenen SQLite-Testdatenbank und ausschließlich
lokalen Zahlungs-, Mail- und Drucksimulationen.

- 91 Ansichten/Zustände geprüft: Startseite, Kollektion, Produktdetails, alle vier
  Gestaltungsschritte, Warenkorb, Kasse, Registrierung, Kundenkonto, Rechtstexte,
  FAQ, Navigation, Modellauswahl, Zahlungssimulator und Bestellstatus.
- Breiten: 320, 360, 390, 430, 680, 768, 820 und 900 Pixel.
- Modellauswahl zusätzlich bei 844 × 390, 390 × 360 und 320 × 480 Pixeln geprüft.
  Dialog bleibt im sichtbaren Bereich; lange Modelllisten lassen sich scrollen und
  Einträge am Listenende auswählen.
- Kein horizontaler Seitenüberlauf und keine außerhalb der Seitenbreite liegenden
  geprüften Texte/Formulare/Bedienelemente. Keine Überschneidungen der geprüften
  Vorschauen mit ihren Beschriftungen. Wichtige Bildschirmbilder visuell kontrolliert.
- Feste Hülle und personalisierte Hülle über die Oberfläche konfiguriert und in den
  Warenkorb gelegt; Testkonto angelegt und lokale Testbestellung mit gespeicherter
  Lieferadresse abgeschlossen. Keine externen Zahlungen, E-Mails oder Druckaufträge.
- 14 vollständige Desktop-Bildvergleiche bei 1024 und 1440 Pixeln: Startseite,
  Kollektion, Produktdetails, Gestaltung, Warenkorb, Kasse und Konto sind mit dem
  bisherigen Stylesheet pixelgleich.
- Keine JavaScript-Fehler oder fehlgeschlagenen HTTP-Antworten im Browserlauf.
- CSS-Parser und Eigenschaftsprüfung ohne Fehler; `pnpm check` erfolgreich.

Die Browserprüfung emuliert Bildschirmgrößen; sie ersetzt keinen Test auf einem
echten iPhone/iPad mit Safari. Lokale Testskripte und Bildschirmbilder liegen in
den ignorierten Verzeichnissen `.tools/mobile-check` und `test-results/mobile-layout`.
