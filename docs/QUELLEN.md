# Geprüfte Quellen · 3. November 2026

## Zahlungsabwicklung über Stripe

Erweiterung 4. November 2026: [Speichern während der Zahlung](https://docs.stripe.com/payments/checkout/save-during-payment?ui=full-page), [bestehende Kunden und Wiederanzeige](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted), [PaymentMethods auflisten](https://docs.stripe.com/api/payment_methods/list) und [vom Customer lösen](https://docs.stripe.com/api/payment_methods/detach). Die Speicheranleitung wurde zusätzlich direkt als offizielle Markdownfassung abgerufen, weil der Webparser die Unterseitenvariante nicht auflösen konnte. Umsetzung mit nativer freiwilliger Checkout-Checkbox, Customer-Bindung und serverseitiger Eigentümerprüfung.

Jonas’ Ergänzung: Zahlungen später zentral über Stripe. Daher verwendet der vorbereitete Checkout die Stripe-Methoden `card` und `paypal`; die ursprüngliche direkte PayPal-Anbindung entfällt.

- [Stripe: gehosteter Checkout](https://docs.stripe.com/checkout/quickstart) – Session serverseitig anlegen und zur gehosteten URL weiterleiten.
- [Stripe: PayPal](https://docs.stripe.com/payments/paypal) – Stripe unterstützt PayPal in Checkout und für deutsche Händlerkonten. Freischaltung im konkreten Konto ist noch zu prüfen.
- [Stripe: Webhooks und Signaturprüfung](https://docs.stripe.com/events/manage-webhook-endpoints) – Signatur auf unverändertem Body, Zeitfenster und wiederholte Zustellung beachten.

Ohne Stripe-Testschlüssel wurden keine Anbieteranfragen oder Zahlungen ausgeführt. Integrationstests verwenden kontrollierte Antwortfixtures. Reale Händlerfreischaltung und Tests bleiben offen.

## Podbase

Aktuelle Modelle, erneut geprüft am 4. November 2026: [Podbase-Neuheiten](https://help.podbase.com/hc/en-us/articles/26709115368988-What-s-New-in-Podbase) bestätigt Tough-Hüllen für iPhone 18 Pro/Pro Max seit 1. September, Pixel 11/11 Pro/11 Pro XL, Galaxy S26 FE und Z Flip8 seit 23. September, S26/S26 Plus/S26 Ultra seit 19. Februar sowie A57/A37 seit 2. April. Die [öffentliche Tough-Produktseite](https://shop.podbase.com/products/tough-phone-case) und ihre Produkt-JSON-Antwort bestätigen auch die weiteren ergänzten aktuellen Einträge. Der reduzierte [Prüfstand der 26 Ergänzungen](podbase-modelle-2026-11-04.json) enthält nur Modellbezeichnungen und öffentliche Verfügbarkeitsangaben. Öffentliche Shop-Varianten-IDs werden ausdrücklich nicht als Händler-API-IDs übernommen.

Erweiterung 4. November 2026: Die [offizielle Tough-Produktseite](https://www.podbase.com/custom/tech-accessories/tough-phone-case) nennt Google Pixel als unterstützte Gerätefamilie. Das ersetzt keinen Variantenabgleich mit dem Händlerkatalog und keine Druckfreigabe für ein konkretes Modell. Die [Google-Modellübersicht](https://store.google.com/us/magazine/pixel-phone-comparison?hl=en-US) bestätigt die Bezeichnungen Pixel 10, 10 Pro, 10 Pro XL und 10a. Die 17 ergänzten Pixel-Einträge im lokalen Shop sind ausdrücklich Testvarianten mit simulierten Druckschablonen; Fold-Modelle gehören nicht zur Auswahl.

- [Open API](https://open-api.podbase.com/api-docs/) – Schema, Produktkatalog und Auftragsendpunkte. Spezifikation am 3. November 2026 abgerufen; lokaler Referenzstand: `podbase-openapi-2026-11-03.json`.
- [Offizieller Integrationsleitfaden](https://help.podbase.com/hc/en-us/articles/26709382744604-Podbase-API-integration-guide) – API-Schlüsselheader, internationale Pflichttelefonnummer, Produkt-/Varianten-IDs, Versand-ID, öffentliche PNG-Direktlinks und Statusabgleich. Podbase-Tests laufen im Produktionssystem; der Leitfaden empfiehlt manuelle Auftragsfreigabe zum Vermeiden automatischer Kosten. Im Projekt werden ausschließlich lokale Simulationen ausgeführt.
- [Feste Kartenbeilage](https://help.podbase.com/hc/en-us/articles/26709214523676-Does-Podbase-offer-packing-inserts) – Eine aktive einseitige Storebeilage wird neuen Aufträgen automatisch hinzugefügt. Aktivierung und physische Musterprüfung sind offen.

Die vorgeschriebene Telefonnummer wird im Checkout abgefragt. Der Beilagenstatus ist ein Einrichtungsschritt im Händlerkonto, kein erfundenes API-Positionsfeld. Alle aktuellen IDs im Testshop sind ausdrücklich `SIM-…`.

## Bibel-Testbestand

Kurze Originalauszüge wurden gegen **Luther 1912 im Angebot der Deutschen Bibelgesellschaft** abgeglichen. Die Quelle nennt eigene Rechte an ihrer digitalen Ausgabe; daraus wird ausdrücklich **keine** Freigabe für moderne Übersetzungen oder kommerziellen Produktdruck abgeleitet. Der vollständige Livebetrieb bleibt gesperrt. Der lokale Bestand enthält nur kurze Auszüge für Entwicklung und Tests.

| Stelle | Gegenprüfbare Quelle |
|---|---|
| Psalm 23,1 | [LU12 · Psalm 23](https://www.die-bibel.de/bibel/LU12/PSA.23) |
| Psalm 56,4 | [LU12 · Psalm 56](https://www.die-bibel.de/bibel/LU12/PSA.56) |
| Jesaja 41,10 | [LU12 · Jesaja 41](https://www.die-bibel.de/bibel/LU12/ISA.41) |
| Matthäus 11,28 | [LU12 · Matthäus 11](https://www.die-bibel.de/bibel/LU12/MAT.11) |
| Psalm 46,2 | [LU12 · Psalm 46](https://www.die-bibel.de/bibel/LU12/PSA.46) |
| Jeremia 29,11 | [LU12 · Jeremia 29](https://www.die-bibel.de/bibel/LU12/JER.29) |
| Psalm 139,5 | [LU12 · Psalm 139](https://www.die-bibel.de/bibel/LU12/PSA.139) |
| 1. Korinther 13,13 | [LU12 · 1. Korinther 13](https://www.die-bibel.de/bibel/LU12/1CO.13) |
| Josua 1,6 | [LU12 · Josua 1](https://www.die-bibel.de/bibel/LU12/JOS.1) |

Die verbreitete Kurzform „Sei getrost und unverzagt“ steht in diesem konkreten Quelltext in **Josua 1,6**. Sie wird deshalb nicht irrtümlich als Josua 1,9 geführt. Psalm 23,1 übernimmt die Schreibweise „Herr“ der benannten digitalen Quelle.

Die Erklärungen sind eigene, getrennt markierte Bezugstexte. Sie gehören nicht zum Bibelzitat und werden nicht als Zitat gedruckt. Eine Livequelle (etwa BasisBibel oder Hoffnung für alle) erfordert eine eigenständige Prüfung und Freigabe für digitale Nutzung und Produktdruck.

## Vollständige Verse auf den Produktseiten · 10. November 2026

Die sechs festen Produktseiten zeigen den vollständigen zugehörigen Vers aus
der [Luther-1912-Ausgabe von eBible](https://ebible.org/deu1912/copyright.htm),
die der Anbieter ausdrücklich als Public Domain kennzeichnet. Der Wortlaut
wurde mit dieser Ausgabe abgeglichen; die Gegenprüfung erfolgte zusätzlich
anhand der Luther-1912-Texte der Deutschen Bibelgesellschaft. Die Großschreibung
„HERR“ und die Versgrenzen einschließlich abschließender Kommas folgen eBible.

- [Psalm 91,4](https://ebible.org/deu1912/PSA091.htm#V4): Unter seinen Flügeln.
- [Markus 4,39](https://ebible.org/deu1912/MRK04.htm#V39): Nach dem Sturm.
- [Matthäus 11,28](https://ebible.org/deu1912/MAT11.htm#V28): Absetzen.
- [Psalm 131,2](https://ebible.org/deu1912/PSA131.htm#V2): Ganz nah.
- [Psalm 121,5](https://ebible.org/deu1912/PSA121.htm#V5): Im Schatten.
- [Jesaja 40,11](https://ebible.org/deu1912/ISA40.htm#V11): Getragen.

Die Absätze „Einfach erklärt“ sind eigene, kurze Deutungen des Textes und des
Motivs. Sie sind sichtbar vom Zitat getrennt. Diese Ergänzung betrifft nur die
Beschreibung auf den Produktseiten (`public/product-verses.js`), nicht den
Versbestand der Personalisierung oder die Druckdateien.

## Schriften und Entwurfsassets

Jonas’ Projektquellen: [CI-Book Ausgabe 01](../Archenlicht-CI-Book.pdf), insbesondere Logo/Farbrollen auf Seiten 4–6 und Shop/Produkt auf Seiten 9–10, sowie [Original-Logo Nr. 2](../Logoentwürfe/Archenlicht-02.png). Das Original wurde unverändert übernommen; Seiten 4, 5 und 10 wurden zusätzlich visuell gerendert und abgeglichen. Farbcodes und Schriftbeispiele sind laut Buch Arbeitsvorschläge; die Freigabe des Original-Logos bleibt maßgeblich.

Die lokal eingebundenen Fonts stammen aus dem [Google-Fonts-Repository](https://github.com/google/fonts): DM Sans, Cormorant Garamond und Caveat. Jeweilige SIL Open Font License unter `public/fonts/*-LICENSE.txt`. Caveat ist bytegleich mit der Schrift im gelieferten Designpaket.

Die aktuellen sechs Motive stammen unverändert aus Jonas’ [Designpaket v2 Farbe](../Archenlicht-Designpaket-v2-Farbe/Archenlicht-Designpaket-v2-Farbe/UPDATE-ZUERST-LESEN.md). Originaldateien: Flügel und Lamm 962 × 1.634 px, übrige vier 962 × 1.635 px; zusammengefügter Hintergrund und Illustration. Die frühere v1-Bildsammlung bleibt erhalten; die alte SVG-Skizzensammlung wird nicht mehr gerendert. [Dokumentierte Einbindung](DESIGNPAKET.md); keine finale Druckfreigabe und keine übernommenen Produktfotos.
