# Technische Prüfung des Bestellablaufs

Stand: 14. November 2026. Auftrag: Bestellverarbeitung und Kaufweg prüfen und
gefundene Fehler beheben. Kein Auftrag für eine kostenpflichtige Bestellung,
Produktionsfreigabe oder allgemeine Verkaufsöffnung.

Der geprüfte Ablauf ist: Produktauswahl / Wunschtext / Bundle → Warenkorb →
Lieferdaten → Zahlungsbestätigung → dauerhafter Bestell- und Mailauftrag →
Podbase-Übergabe → Versandstatus mit Tracking → einmalige Versandmail.

## Nachgewiesene und behobene Fehler

1. Ein Bearbeitungslauf konnte einen gleichzeitig gestarteten Lauf für eine
   andere Bestellung überspringen. Die Instanz verarbeitet Aufrufe jetzt der
   Reihe nach. Die bestehenden Datenbanksperren schützen weiterhin zwischen
   mehreren Instanzen. Ein Regressionstest hat den ursprünglichen Fehler
   reproduziert; danach werden beide Bestellungen genau einmal verarbeitet.
2. Bei einer vorübergehend fehlgeschlagenen Vorbereitung vor dem ersten
   Podbase-POST blieb der Auftrag dauerhaft als unklar hängen. Solange der
   laufende Versuch sicher noch nichts übermittelt hat, wird er nun wieder
   bearbeitbar. Nach einer möglicherweise angenommenen Übermittlung bleibt
   ausschließlich der Anbieterabgleich erlaubt. Unklare Altzustände werden
   weiterhin gehalten. Die POST-Freigabe prüft zusätzlich `attempts=0` in der
   Datenbank, bevor sie den Versuchszähler erhöht.
3. Die erste Bestellmail wartete bisher auf den gesamten Podbase-Lauf. Bereits
   bezahlte Bestätigungen werden nun davor bearbeitet; ein zweiter Maillauf
   im Abschlussblock verarbeitet neue Versand- oder Fehlermeldungen auch dann,
   wenn der restliche Lauf unterbrochen wurde. Inhalt und Wiederholungsschlüssel
   bleiben unverändert.

Ein bestehender Mehrinstanztest wurde korrigiert: Die beiden Worker werden
tatsächlich gleichzeitig gestartet, statt schon innerhalb der Promise-Liste
aufeinander zu warten. Der echte Paralleltest besteht.

## Aktuell überprüfte externe Konfiguration

- Production: Live-Zahlung, echter Podbase-Adapter, Originaldruckvorlagen,
  Resend-Bestellmails, Resend-Newsletter und PostgreSQL konfiguriert.
- `CHECKOUT_ENABLED=false`, `PODBASE_SUBMISSION_ENABLED=false` bleiben bestehen.
- Stripe-Livekonto über vorhandenen lokalen Schlüssel gelesen:
  Zahlungen und Auszahlungen freigegeben, Kartenzahlung aktiv.
- Der Live-Webhook zur Shopadresse ist aktiv, mit den vier benötigten
  Checkout-Session-Ereignissen. Keine Zahlungsobjekte neu angelegt.
- Podbase-Katalog mit vorhandenem Schlüssel erreichbar, 28 Produktgruppen.
  Kein Auftrag erstellt und keine Produktion freigegeben.
- Produktionsdatenbank ausschließlich mit aggregierten SELECT-Abfragen geprüft:
  acht bisherige Testbestellungen, keine Livebestellung; drei abgeschlossene
  simulierte Fulfillments. Vorhandene Resend-Nachweise für Bestätigung,
  Versand, Newsletter und Widerruf stehen auf `delivered`; keine wartenden
  Mailaufträge im abgefragten Bestand. Das garantiert keine künftige Zustellung.
- 444 vorhandene Modell-/Motiv-Freigaben stehen weiterhin auf `test`.
  Es wurden keine Varianten automatisch für echte Käufe freigegeben.
- Abfrage der letzten 15 Minuten Produktions-Fehlerlogs: keine Einträge.
  Längere Abfragen scheiterten an der verfügbaren Log-Aufbewahrung; daraus
  wird keine Aussage über ältere Laufzeitfehler abgeleitet.

## Testnachweise

- Gezielte Tests für Gast-/Kontokauf, Adressspeicherung, Standard/MagSafe,
  Wunschtext, Bundles, Newsletter-Rabatt, Zahlungsabbruch, Signaturen,
  falsche Beträge, Test-/Live-Trennung, doppelte Ereignisse, parallele Worker,
  verlorene Anbieterantworten und Zustellereignisse bestanden. Betroffene
  Bestell-/Mail-/Provider-Suiten nach der Korrektur erneut erfolgreich.
- Zusätzlich echte Neon-Datenbank in einem isolierten temporären Schema:
  verifizierte Zahlung, einmaliger unfreigegebener Anbieterauftrag und
  unveränderter Zustand nach einer neuen Serverinstanz. Das Schema wurde vom
  Test wieder entfernt. Stripe, Podbase und Resend waren dabei simuliert.
- Vier vollständige Browserwege mit Edge: feste Hülle als Gast auf Desktop,
  eigene Worte/MagSafe/Widmung mit Kundenkonto und gespeicherter Adresse auf
  Mobilgröße, Dreier-Bundle mit drei verschiedenen Modellen/Farben auf Desktop,
  Zahlungsabbruch auf Mobilgröße. Kein horizontaler Überlauf und keine
  JavaScript-Seitenfehler. Drei simulierte Käufe erzeugen genau sechs
  abgefangene E-Mails; der Abbruch erzeugt weder Mail noch Fulfillment.
- Beispielbeträge geprüft: Standard 29,99 €, personalisierte MagSafe-Hülle
  39,99 €, Dreier-Bundle mit einer MagSafe-Hülle 85,47 € nach 10 % Rabatt.
- Syntaxprüfung aller 104 JavaScript-Dateien und Web-Build erfolgreich.

Private technische Belege liegen unter `test-results/order-flow-2026-11-14/`.
Die Prüfskripte und Zugangsdaten bleiben in ausgeschlossenen lokalen Dateien.

## Weiterhin vor Verkaufsfreigabe offen

1. Häufiger, überwachter Hintergrundlauf unabhängig von offenen Browserseiten.
   `vercel.json` löst `/api/jobs` weiterhin nur täglich aus. Bei Resend beträgt
   die sichere automatische Wiederholungsfrist im Shop 23 Stunden; der tägliche
   Lauf kann diese verpassen und eine manuelle Klärung nötig machen. Auch
   Podbase-Tracking wird ohne Besucher sonst nur täglich aktualisiert.
   Ein Zeitgeber muss zum endgültigen Hosting passen. Es wurde kein Tarif
   gebucht, Host gewechselt oder zusätzlicher Dienst eingerichtet.
2. Bewusste Freigabe der tatsächlich verkauften Varianten. Die bestätigte
   Musterhülle ist dokumentiert; daraus folgt keine automatische Freigabe
   aller übrigen Produkte oder des standardmäßig gezeigten iPhone 18 Pro.
3. Abschließender kontrollierter Kauf über die echte Stripe-Oberfläche mit
   tatsächlichem Zahlungsereignis, Mail und Podbase-Auftrag. Die aktuellen
   Tests belegen die technische Verarbeitung, keine erfolgte Livezahlung oder
   reale Lieferung durch diesen vollständigen Shop-Kaufweg.
4. Die separat dokumentierten Betreiber-, Verpackungs-, Rechte- und
   Hostingfragen bleiben außerhalb dieser technischen Prüfung offen.

## Verwendete Anbieterinformationen

- Stripe-Fulfillment und Webhook-Verarbeitung:
  https://docs.stripe.com/checkout/fulfillment
- Resend-Schlüssel gelten 24 Stunden; der Shop hält danach unklare Sendungen:
  https://resend.com/docs/dashboard/emails/idempotency-keys
- Die aktuell verwendeten Vercel-Cron-Jobs sind im Hobby-Tarif auf tägliche
  Ausführung begrenzt:
  https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing
