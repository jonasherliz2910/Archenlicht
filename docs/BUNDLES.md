# Frei zusammenstellbare Bundles

Unter `/bundle` können Kunden ihre Hüllen frei kombinieren. Bei zwei bis drei Hüllen werden automatisch 5 %, ab vier Hüllen 10 % vom gesamten Hüllen-Zwischensaldo abgezogen. Es gilt jeweils eine Rabattstufe, keine Addition der Prozentsätze. Fertige und personalisierte Hüllen, unterschiedliche Modelle, Farben und MagSafe sind kombinierbar. Jede Gestaltung bleibt eine eigene bearbeitbare Position; mehrere Exemplare derselben Position zählen ebenfalls. Alle Positionen gehen an eine Lieferadresse. Bei weniger als zwei Hüllen entfällt der Rabatt.

Beispiele: Zwei Standardhüllen kosten zusammen 56,98 € statt 59,98 €. Vier Standardhüllen kosten 107,96 € statt 119,96 €. Eine Standardhülle und eine personalisierte MagSafe-Hülle kosten 66,48 € statt 69,98 €.

## Berechnung und gespeicherte Bestellungen

`public/bundle-pricing.js` berechnet in ganzen Eurocent: Rabatt = kaufmännisch gerundete 5 % oder 10 % des Zwischensaldos gemäß Stückzahl. Der Rabatt wird proportional auf die Positionen verteilt; verbleibende Cent gehen nach dem größten Rest an die jeweilige Position. Die Summe der Positionsbeträge stimmt deshalb genau mit dem Gesamtbetrag überein, auch bei größeren Mengen.

Der Server ermittelt Preise und Mengen neu aus dem Warenkorb. Preis-/Rabattfelder aus Browseranfragen werden nicht übernommen. Pro Bestellposition wird der berechnete Preisstand gespeichert. Bestehende Bestellungen behalten ihre ursprünglichen Preise, einschließlich bereits gespeicherter 5-%-Bundles mit vier oder mehr Hüllen. Spätere Warenkorbänderungen ändern keine laufende Zahlung oder Bestellbestätigung.

Stripe erhält die unveränderten Einzelpreise und einen auf eine Bestellung begrenzten Rabatt über den exakten Centbetrag. Erstellung und Checkout sind idempotent. Dadurch erscheint der Rabatt separat und die Stripe-Rundung kann nicht vom Warenkorb abweichen. Die Zahlungsprüfung kontrolliert Rabatt, Zwischensaldo und endgültigen Betrag. Grundlage: [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create) und [Stripe Coupons mit amount_off](https://docs.stripe.com/api/coupons/create).

Der Rabatt erscheint auf Bundle-Seite, Warenkorb, Kasse, Bestellstatus und HTML-/Text-Bestellmail. Produkt- und Varianten-IDs, Mengen und individuelle Druckdateien gehen unverändert an den bestehenden Podbase-Adapter.

## Prüfung

- Staffeländerung: 20 relevante Bundle-, Shop- und Stripe-UI-Tests bestanden. Grenzen bei 1, 2, 3, 4 und 5 Hüllen, Cent-Verteilung bei größeren Mengen, alte Preisstände, Mailbeträge und unveränderte Podbase-Positionen geprüft.
- Echte Stripe-Sandbox: unbezahlter Gast-Checkout mit zwei Hüllen (64,98 € − 3,25 € = 61,73 €) und Konto-Checkout mit vier Hüllen (124,96 € − 12,50 € = 112,46 €). Sessions anschließend abgelaufen, Testkunden und erfasste Coupons entfernt. Keine Zahlung, Mail oder Produktion ausgelöst.
- Browser bei 320, 390 und 1440 Pixel Breite: gemischter Warenkorb, Auf- und Abstieg zwischen 0 %, 5 % und 10 %, Kassenbetrag sowie Erhalt der einzelnen Gestaltungen geprüft. Keine Browserfehler oder horizontalen Überläufe.

Der Shop bleibt im vorhandenen Testbetrieb. Diese Änderung erteilt keine Freigabe für Livezahlungen oder echte Produktion.
