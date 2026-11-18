# Newsletter-Rabatt auf Aktionen und Bundles

Ab 18.11.2026 gilt der persönliche Newsletter-Code zusätzlich auf alle Hüllen, einschließlich Aktionspreisen, personalisierten Hüllen, MagSafe und bereits rabattierten Mengen- oder Dreier-Bundles. Der Newsletter-Rabatt beträgt weiterhin einmalig 5 % und wird nach dem bestehenden Rabatt berechnet. Bestätigte E-Mail-Adresse, Reservierung beim Checkout, Einmalnutzung und Freigabe nach abgebrochener Zahlung bleiben bestehen. Auch bereits ausgegebene, unbenutzte Codes verwenden die neue Regel.

Beispiele mit Aktionspreisen:

| Warenkorb | Nach Aktions-/Bundlepreis | Newsletter-Rabatt | Gesamt |
|---|---:|---:|---:|
| Eine Standardhülle | 29,99 € | 1,50 € | 28,49 € |
| Zwei Standardhüllen, 5 % Mengenrabatt | 56,98 € | 2,85 € | 54,13 € |
| Festes Dreier-Bundle, 10 % Set-Rabatt | 80,97 € | 4,05 € | 76,92 € |
| Vier Standardhüllen, 10 % Mengenrabatt | 107,96 € | 5,40 € | 102,56 € |

Der Rabatt wird einmal auf den verbleibenden Warenwert gerundet und anschließend centgenau auf die Positionen verteilt. Bestehende Preis-Snapshots und Zahlungen werden nicht neu berechnet. Neue Snapshots enthalten die beiden Rabattbestandteile getrennt. Stripe erhält weiterhin einen festen, bestellungsgebundenen Gesamtrabattbetrag mit unverändertem Wiederholungsschlüssel; der Stripe-Adapter prüft sowohl den Gesamtbetrag als auch den Rabatt gegen den gespeicherten Auftrag.

Aktualisiert: Newsletter-Bedingungen, Willkommensvorlage, Bundle-Hinweis, AGB, Kassenfeld, Bestellübersicht und Bestellmail. Es wurde keine Rundmail versendet.

Prüfung: 54 automatisierte Tests bestanden (Newsletter, Aktionen, Bundles, Stripe, Bestellmails, Cloudflare-Auftragswiederholung, Druckabruf und Web-Build). Isolierte Browserprüfung in Edge auf 390 × 844 und 1440 × 1000: Code anwenden/entfernen/erneut anwenden, bei E-Mail-Änderung zurücksetzen, beide Rabatte und Gesamtbetrag anzeigen sowie lokale Bestellung zum richtigen Betrag speichern. Keine JavaScript-Fehler oder horizontales Überlaufen. Stripe-Aufrufe wurden mit kontrollierten SDK-Antworten geprüft; keine reale Zahlung, E-Mail oder Podbase-Produktion ausgelöst.

Veröffentlicht als Cloudflare-Version `82037f9e-c756-4d1e-ba0f-8bdb5a8ffd2f`. Alle 16 Binding-Definitionen einschließlich der vorhandenen Secret-Bindings und des Shop-Durable-Objects stimmen mit der vorigen Version überein. Die Liveprüfung bestätigt die neuen Newsletter-Bedingungen und das freigegebene Codefeld bei einem Warenkorb mit Aktionspreisen und Mengenrabatt.
