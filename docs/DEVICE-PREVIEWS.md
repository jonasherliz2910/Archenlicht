# Modellabhängige Hüllenvorschau

Stand: 8. November 2026.

Die Produktseiten und der Wunschvers-Konfigurator zeigen zwei synchronisierte
Ansichten: **Mit Handy** und **Nur Hülle**. Beide verwenden dieselbe erzeugte
Druckgrafik. Die zweite Ansicht hat transparente Kameraöffnungen und keine
Kameralinsen. Ein leicht salbeifarbener Hintergrund macht die Öffnungen sichtbar.

## Darstellung und Grenzen

`public/device-preview.js` zeichnet skalierbare SVG-Modelle für die 74 vorhandenen
Katalogeinträge. Modellfamilien unterscheiden sich in Proportion, Ecken, Anzahl und
Anordnung der Linsen sowie Öffnungen. Dazu gehören beispielsweise die breite
Pro-Kameraeinheit bei iPhone 17/18, diagonale und vertikale iPhone-Doppelkameras,
Samsung-Einzelringe und Kameraeinheiten sowie verschiedene Pixel-Kameraleisten.

Dies sind eigene, illustrative Zeichnungen. Die Proportionen orientieren sich an
Geräteangaben; Ausschnittpositionen, Randstärken und Rundungen sind angenähert.
Herstellerfotos dienen als Referenz und werden nicht in den Shop übernommen.
Es liegen weiterhin keine freigegebenen Podbase-Stanzkonturen oder Produktions-
Mockups je Variante vor. Deshalb steht die Einschränkung direkt unter der Vorschau.
Die Ansichten stellen keine maßgenaue Freigabe einer Podbase-Hülle dar.

Geprüfte öffentliche Referenzen:

- [Apple iPhone 18 Pro / Pro Max – technische Daten](https://www.apple.com/iphone-18-pro/specs/)
  und [Produktansichten](https://www.apple.com/iphone-18-pro/).
- [Apple zur neuen Kameraeinheit des iPhone 17 Pro](https://www.apple.com/newsroom/2025/09/apple-unveils-iphone-17-pro-and-iphone-17-pro-max/).
- [Samsung Galaxy S26 – Herstellerinformationen](https://www.samsungmobilepress.com/articles/samsung-unveils-galaxy-s26-series-intuitive-galaxy-ai).
- [Google Pixel 11 Pro / Pro XL – technische Daten](https://store.google.com/us/product/pixel_11_pro_specs?hl=en-US).
- [Podbase Tough – öffentliche Produktseite](https://shop.podbase.com/products/tough-phone-case).
  Die öffentliche Modellliste ersetzt keine freigegebene Händlerschablone.

## Umsetzung

- Die SVG-Maske entfernt die Öffnungen aus sämtlichen Hüllenflächen. In der ersten
  Ansicht wird nur die Gerätehardware ergänzt. Die Druckgrafik wird in beiden
  Ansichten proportional eingebettet, ohne Verzerrung oder Drehung.
- Das native horizontale Scrollen unterstützt Touch-Wischen. Beschriftete Knöpfe,
  Pfeile und die Tastatur (Links/Rechts, Pos1/Ende) bieten denselben Wechsel.
  Reduzierte Bewegung und Größenänderungen werden berücksichtigt; Observer werden
  beim Seitenwechsel entfernt.
- Modell-, Motiv- und Textänderungen aktualisieren beide Bilder gemeinsam und
  lassen die gewählte Ansicht bestehen.
- Das Z Flip8 benötigt wegen Außendisplay und Scharnier eine gesonderte freie
  Motivfläche. `test-flip-template-v4` setzt Motiv und sämtliche aktiven Textfelder
  vollständig auf die untere Klapphälfte (ab y=1290 bei Falz y=1200), mit
  passenden Hintergrundflächen außen. Diese Änderung gilt auch für die
  erzeugte SVG/PNG-Druckdatei. Bereits gespeicherte Druckdateien werden nicht geändert.
  Die Vorlage bleibt simuliert und `productionApproved: false`.
- Kamera-Ausschlüsse werden mit demselben `printFrame` wie die Browseransicht
  in Druckkoordinaten umgerechnet. Die sichtbare Motivgruppe hält 45 Einheiten
  Abstand und wird höchstens so groß wie die frühere Standardplatzierung.
  Bei Bedarf wird sie versetzt oder proportional verkleinert. Leeres Quellpapier
  außerhalb der Gruppe darf über die Leinwand hinausragen; keine gedruckte Linie.
- In der mobilen Produktansicht gibt es nur den regulären Modellwähler bei den
  Produktoptionen; im Gestalter nur den Modell-Schritt.

## Prüfung

- Geometrieprüfung für alle Katalogmodelle; Rastertests bestätigen transparente
  Ausschnitte und sichtbare Linsen nur in der Geräteansicht.
- Zusätzlicher Rasterabgleich der Öffnungen für alle Modelle, sechs Motive und
  beide Hüllenarten: mit dem geprüften Testvers und einer Widmung keine verdeckte
  Motivzeichnung nach der Korrektur der Flip-Fläche.
- Playwright mit separatem Edge-Testbrowser: iPhone 18 Pro Max, iPhone 15,
  Galaxy S26 Ultra, Pixel 11 Pro XL und Z Flip8; Modellwechsel, beide Ansichten,
  echtes Touch-Wischen, Tastatur, Personalisierung und Warenkorbzugang.
- Galerie bei 320, 390, 768 und 1440 Pixeln geprüft; Startseiten-Abstände zusätzlich
  bei 900 und 1024 Pixeln kontrolliert. Bildschirmbilder visuell geprüft.
- Lokale Testdateien liegen ignoriert unter `.tools/mobile-check` und
  `test-results/device-gallery`. Die Tests verwenden keine echten Zahlungen,
  E-Mails oder Druckaufträge.
