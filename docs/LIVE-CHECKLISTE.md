# Vor einem echten Verkauf

Der derzeitige Stand ist lokal startbar und über die API durchgehend testbar. Eine technische Endabnahme benötigt noch die Browser-/Mobilprüfung und echte Stripe-Testzahlungen. Verkauf beginnt erst nach geklärten Voraussetzungen und Jonas’ ausdrücklicher Musterfreigabe. `SHOP_MODE=live` ist deshalb gesperrt.

| Voraussetzung | Zuständig | Konkrete Freigabe / nächster Nachweis |
|---|---|---|
| Markenname und Domain | Jonas | Archenlicht bestätigen, Namen prüfen lassen, Domain bestimmen. Kein Domainkauf erfolgt. Markenname zentral in `server/catalog.js`; danach Markenassets neu generieren. |
| Betreiberangaben und Rechtsseiten | Jonas + qualifizierte rechtliche Prüfung | Vollständige Angaben und freigegebene Texte für Impressum, Datenschutz, AGB, Widerruf/Musterformular, Preise/Steuern, Lieferzeiten und Vertragsschluss. Vorlagen im Shop ersetzen. |
| Stripe-Händlerkonto und Testzugang | Jonas | Stripe-Konto für den tatsächlichen Betreiber, Testschlüssel, Karte und PayPal im Stripe-Dashboard einrichten. PayPal als Stripe-Zahlungsmethode bestätigen. |
| Anbieter-Testabnahme | Umsetzung + Jonas | Beide Wege über echten gehosteten Stripe-Testcheckout einschließlich Webhooks, Abbruch, Replay und Bestellabgleich. Keine Live-Schlüssel verwenden. |
| Live-Zahlungsfreigabe | Jonas + Umsetzung | Händlerfreischaltung und Live-Secrets getrennt vom Testbetrieb; Liveadapter erst nach vollständiger Abnahme freigeben. Fehler-/Erstattungsprozess und Rechnungsangaben festlegen. |
| Podbase-Konto und API | Jonas | Eigenen Store, API-Schlüssel und Kontoeinstellungen bereitstellen. Podbase besitzt laut Dokumentation keinen isolierten kostenlosen Sandboxbetrieb; zunächst manuelle Auftragsfreigabe konfigurieren. Keine Produktion ohne ausdrückliche Zustimmung. |
| Aktueller Tough-Katalog | Umsetzung + Jonas | Echte Produkt-/Varianten-IDs aus `/catalog`, tatsächliches `inStock`, regelmäßige Aktualisierung sowie erneute Prüfung vor Checkout. Die 74 Testmodelle (Apple, Samsung und Google Pixel) sind kein Verfügbarkeitsversprechen. |
| Motive und Schablonen | Jonas liefert Assets; Umsetzung integriert | Finale Illustrationen, Podbase-Modelltemplates und Druckränder; Vorschau und physische Lesbarkeit für jede veröffentlichte Kombination prüfen und Freigabe pro Modell/Motiv dokumentieren. |
| Bibelquelle und Rechte | Jonas + Rechteinhaber | Moderne verständliche Quelle, exakte Textfassung, Quellenangaben, Rechte für Onlineanzeige und kommerziellen Produktdruck schriftlich klären. BasisBibel und Hoffnung für alle prüfen. Testquelle bleibt live gesperrt. |
| Externe KI | Jonas + Umsetzung + Datenschutzprüfung | Nur falls gewünscht: Anbieter, Vertrag, Speicher-/Trainingspraxis, Region und Löschung prüfen. Freitext weiterhin nur flüchtig, keine Weitergabe an Fulfillment/Analytics. Zitate nur aus freigegebenem Bestand. Lokale Beratung ist bereits ohne externen Dienst testbar. |
| Geschenkkarte | Jonas + Podbase | Den einseitigen 10 × 15-cm-Entwurf freigeben, im Store als feste Beilage aktivieren und Muster im selben Paket prüfen. Kein individuell gedruckter Kartentext im Launchumfang. |
| Öffentliche Druckdateien | Umsetzung + Hosting | Unveränderliche HTTPS-Direktlinks auf vollständige hochauflösende PNGs ohne Authentifizierung; keine Preview- oder Freigabelinks. Geprüfte Modelle und Datenschutz bei Widmungen berücksichtigen. |
| E-Mail-Absender und Zustellung | Jonas + Umsetzung | Absenderdomain, SPF/DKIM/DMARC, Mailanbieter, geprüfte Vorlagen; Statuslink, Fehleralarm und einmaliger Versand praktisch testen. Lokale Outbox ist kein echter Versand. |
| Hosting und Persistenz | Jonas entscheidet; Umsetzung richtet ein | Region/Anbieter, HTTPS, dauerhafter Datenträger oder gemeinsame Datenbank, dauerhaft laufender Queueworker, Backups samt Wiederherstellung und Monitoring. Test-/Livedaten und Secrets getrennt. |
| Kontobetrieb und Datenschutz | Jonas + Umsetzung | E-Mail-Verifikation, Kontowiederherstellung, angemessener Missbrauchsschutz, Auskunft/Löschung, Aufbewahrungsfristen und Dienstleisterverträge vor Öffnung prüfen und ergänzen. |
| Browser und echtes Smartphone | Umsetzung + Jonas | Desktop sowie 390-/360-px-Ansicht und echtes Handy; QR-/TikTok-Einstieg, alle Gestaltungsfelder, Bearbeiten, Zahlungscheckout und Status prüfen. Derzeit technisch blockiert. |
| Verpackung und reale Gesamtkosten | Jonas + Steuer-/Fachberatung nach Bedarf | Produkt, Druck, Beilage, Versand DE, Steuern, Stripe-/PayPal-Gebühren, Domain/Hosting/Mail und mögliche Ersatz-/Rückabwicklungsfälle bestimmen. Keine belastbare Marge aus den Testpreisen ableiten. |
| Ausdrücklich freigegebener Musterauftrag | Jonas | Kostenpflichtigen Einzelauftrag separat autorisieren. Tatsächliches Druckbild je Muster, Kamerapassung, Lesbarkeit, Beilage, Gesamtkosten, Versandmail und echtes Tracking dokumentieren. Erst danach Verkauf freigeben. |

## Kostenblatt für die Musterprüfung

| Bestandteil | Kollektion | Wunschvers |
|---|---:|---:|
| Test-Endpreis inkl. Versand/Beilage | 29,90 € | 34,90 € |
| Podbase Tough inkl. Druck | offen | offen |
| Feste Karte | offen | offen |
| Deutschlandversand | offen | offen |
| Stripegebühr je Methode | offen | offen |
| Steuerliche Behandlung | offen | offen |
| Anteil Domain/Hosting/Mail | offen | offen |
| Reale Gesamtkosten / verbleibender Betrag | noch nicht berechenbar | noch nicht berechenbar |

Werbebudget: **0 €**. TikTok-Videos entstehen außerhalb des Shops. Die Herkunftslinks sind vorhanden; es wurden keine Werbekampagnen oder bezahlten Dienste beauftragt.
