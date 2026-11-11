# Eröffnungspreise

Stand: 11. November 2026. Jonas wünscht ab sofort 5 EUR weniger pro Hülle. Ein Enddatum wurde ausdrücklich noch nicht festgelegt.

| Hülle | Eröffnungspreis | Preis nach Beendigung |
|---|---:|---:|
| Kollektion | 29,99 € | 34,99 € |
| Kollektion mit MagSafe | 34,99 € | 39,99 € |
| Wunschvers | 34,99 € | 39,99 € |
| Wunschvers mit MagSafe | 39,99 € | 44,99 € |

Der Shop zeigt ausschließlich den hervorgehobenen tatsächlichen **Eröffnungspreis**. Der gerade erhöhte Preis wird nicht als früherer Preis durchgestrichen. Ohne bestätigtes Datum wird auch kein zukünftiger Preis und kein Countdown angezeigt. Hinweise zu befristeten Eröffnungspreisen und Preisgegenüberstellungen: https://www.ihk-muenchen.de/ratgeber/recht/werbung-fairer-wettbewerb/richtig-werben-a-z/

`OPENING_OFFER_ENABLED` ist standardmäßig aktiv. Zum Beenden `OPENING_OFFER_ENABLED=false` setzen und neu deployen bzw. den Server neu starten. Dann liefert der Server wieder `REGULAR_BRAND` aus `server/catalog.js`; Eröffnungskennzeichnung und Aktionssperre für Newsletter-Codes verschwinden. Der höhere Preis wird jetzt nur intern für diese Rückkehr gespeichert, nicht als Vergleich beworben. Eine Eröffnungsaktion soll nicht dauerhaft als solche beworben werden; das Enddatum bleibt eine offene Betreiberentscheidung.

Mengenrabatte gelten zusätzlich auf die Eröffnungspreise: zwei Standardhüllen 56,98 €, drei 85,47 €, vier 107,96 €. Beide Dreier-Sets starten bei 85,47 €, mit einer MagSafe-Hülle bei 90,22 €. Der Newsletter-Code bleibt gemäß bestehenden Bedingungen auf nicht reduzierte Hüllen beschränkt. Der Server kennzeichnet Aktionspositionen deshalb mit `reduced` und `openingOffer`; manipulierte Kundeneingaben können diese Kennzeichnung nicht entfernen.

Produktseiten, Kollektion, Konfigurator, Bundles, Warenkorb und Checkout verwenden denselben serverseitigen Preis. Bestellungen speichern Preis, Aktionsstatus und Mengenrabatt unveränderlich. Eine spätere Preisänderung berechnet offene Warenkörbe neu, ändert aber keine bereits angelegte Bestellung oder Stripe-Zahlung. Stripe erhält die günstigeren Einzelpreise und gegebenenfalls den bestehenden Mengenrabatt. Podbase erhält weiterhin dieselben Varianten, Druckdateien und Mengen.

Verkaufsfreigabe, Produktionsfreigabe, Versandkosten und MagSafe-Aufpreis werden durch die Aktion nicht geändert.
