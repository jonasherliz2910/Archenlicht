# Frei zusammenstellbare Bundles

Unter `/bundle` können Kunden ihre Hüllen frei kombinieren. Ab insgesamt zwei Hüllen in einem Warenkorb werden automatisch 5 % vom Hüllen-Zwischensaldo abgezogen. Fertige und personalisierte Hüllen, unterschiedliche Modelle, Farben und MagSafe sind kombinierbar. Jede Gestaltung bleibt eine eigene bearbeitbare Position; mehrere Exemplare derselben Position zählen ebenfalls. Alle Positionen gehen an eine Lieferadresse. Bei weniger als zwei Hüllen entfällt der Rabatt.

Beispiele: Zwei Standardhüllen kosten zusammen 56,98 € statt 59,98 €. Eine Standardhülle und eine personalisierte MagSafe-Hülle kosten 66,48 € statt 69,98 €.

## Berechnung und gespeicherte Bestellungen

`public/bundle-pricing.js` berechnet in ganzen Eurocent: Rabatt = kaufmännisch gerundete 5 % des Zwischensaldos. Der Rabatt wird proportional auf die Positionen verteilt; verbleibende Cent gehen nach dem größten Rest an die jeweilige Position. Die Summe der Positionsbeträge stimmt deshalb genau mit dem Gesamtbetrag überein, auch bei größeren Mengen.

Der Server ermittelt Preise und Mengen neu aus dem Warenkorb. Preis-/Rabattfelder aus Browseranfragen werden nicht übernommen. Pro Bestellposition wird der berechnete Preisstand gespeichert. Bestehende Bestellungen ohne diese Felder behalten ihre ursprünglichen Preise. Spätere Warenkorbänderungen ändern keine laufende Zahlung oder Bestellbestätigung.

Stripe erhält die unveränderten Einzelpreise und einen auf eine Bestellung begrenzten Rabatt über den exakten Centbetrag. Erstellung und Checkout sind idempotent. Dadurch erscheint der Rabatt separat und die Stripe-Rundung kann nicht vom Warenkorb abweichen. Die Zahlungsprüfung kontrolliert Rabatt, Zwischensaldo und endgültigen Betrag. Grundlage: [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create) und [Stripe Coupons mit amount_off](https://docs.stripe.com/api/coupons/create).

Der Rabatt erscheint auf Bundle-Seite, Warenkorb, Kasse, Bestellstatus und HTML-/Text-Bestellmail. Produkt- und Varianten-IDs, Mengen und individuelle Druckdateien gehen unverändert an den bestehenden Podbase-Adapter.

## Prüfung

- Bundle-, Shop-, Mail- und Stripe-Tests: 31 bestanden.
- Konten, Farb-/Snapshot-Bestand, Zahlungsumgebungen, Stripe-Kasse und Vercel-Routing: 14 bestanden (UI-Testkontext um den Preishelfer ergänzt).
- Vier zusätzliche MagSafe-Preis-/Warenkorb-/Zahlungsprüfungen bestanden.
- Echte Stripe-Sandbox: zwei unbezahlte Checkout-Sessions für Gast und Konto, jeweils 64,98 € Zwischensaldo − 3,25 € Rabatt = 61,73 €. Sessions anschließend abgelaufen, Testkunden und erfasste Coupons entfernt. Keine Zahlung, Mail oder Produktion ausgelöst.
- Browser bei 320, 390, 768, 1024 und 1440 Pixel Breite: Bundle-Einstieg, unabhängige Gestaltung, gemischter Warenkorb, Bearbeitung mit Mengenbeibehaltung, Rabatt nach Mengenänderung/Entfernung und Kassenbetrag geprüft. Keine Browserfehler oder horizontale Überläufe.

Der Shop bleibt im vorhandenen Testbetrieb. Diese Änderung erteilt keine Freigabe für Livezahlungen oder echte Produktion.
