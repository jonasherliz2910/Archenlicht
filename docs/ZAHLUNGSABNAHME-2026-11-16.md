# Zahlungsabnahme nach dem Cloudflare-Umzug

Stand: 16. November 2026. Gemeinsame Abnahme begonnen; Zahlung des Nutzers
steht noch aus. Keine allgemeine Verkaufsfreigabe.

Der Nutzer bestätigt, dass er den früheren Podbase-Verbindungstest bewusst
storniert hat. Dessen Status `REJECTED` ist damit erklärt und kein neuer
Nachweis eines Integrationsfehlers. Die sieben noch unbelegten Druckmodelle
sollen zunächst zurückgestellt bleiben.

## Vorbereitete getrennte Prüfung

- Worker `archenlicht-checkout-test` mit demselben Bestellcode, Fetch-Adapter,
  Durable Object, Hintergrundverarbeitung und WASM-Druckrenderer wie der Shop.
- Eigenes Neon-Schema `cf_preview_sandbox_…`, eigene Datenbankrolle. Ein
  Zugriffsversuch auf `public.users` wurde ausdrücklich verweigert. Die
  Laufzeit darf weder Produktionskunden lesen noch Tabellen anlegen.
- Nur Stripe-Testschlüssel akzeptiert, eigener Sandbox-Webhook. Der alte
  deaktivierte Vercel-Testwebhook bleibt unverändert. Live-Zahlungen und
  echte Podbase-Aufträge sind in dieser Konfiguration ausgeschlossen.
- Shopseiten und APIs passwortgeschützt. Nur POST auf dem exakten
  Stripe-Webhook-Pfad passiert die äußere API-Anmeldung; anschließend prüft
  der Shop die unveränderte Stripe-Signatur. Ungültige Signatur: HTTP 401.
  Die neutrale Rückkehrseite des vorbereiteten Zahlungslinks ist öffentlich,
  zeigt keine Bestelldaten und bestätigt oder verarbeitet selbst keine Zahlung.
- Testbestellung `AL-2026-FSLLAKFU8`: Nach dem Sturm, iPhone 14 Pro, Hellblau,
  MagSafe, eine Hülle, 34,99 EUR. Fiktive Lieferanschrift; Testpostfach
  `info@archenlicht.de`. Stripe bestätigt `livemode=false`, offenen/unbezahlten
  Checkout, EUR und deaktivierte automatische Steuerberechnung.
- Bestellmail mit `[TEST]`-Betreff vorbereitet, Zustand `waiting-payment`,
  null Versandversuche. Versand ist auf das freigegebene Testpostfach begrenzt.
  Null Fulfillment-Aufträge vor Zahlung. Es wird nichts physisch gefertigt.
- Der existierende Resend-Webhook bleibt auf der öffentlichen Shopadresse.
  Seine echten, signaturgeprüften Zustellereignisse werden nach Testversand
  anhand der Resend-Nachrichten-ID ausschließlich lesend abgeglichen. Die
  Testdatenbank erhält dadurch nicht automatisch den Status `delivered`.

16 gezielte Tests zu Umgebungstrennung, Zugriffsschutz, unveränderten
Webhook-Bytes, Shop-Adapter, Mail und Stripe-Sicherheitsprüfungen bestanden.
Separater Browsercheck des gehosteten Stripe-Links: sichtbarer Sandbox-Hinweis,
34,99 EUR, richtiges Produkt und MagSafe; nach Auswahl „Karte“ Kartenfelder
verfügbar. Keine Zahlung im Browser ausgelöst.
Sandbox-Build erfolgreich. Produktionsprüfung danach: Checkout und
Podbase-Übermittlung weiterhin gesperrt; unverändert acht historische
Testbestellungen und zehn zugestellte Maildatensätze im Produktionsschema.

## Fortsetzen

Die lokalen, ignorierten Nachweise und Hilfsskripte liegen unter
`test-results/cloudflare-acceptance/`. Zugangsdaten nicht ausgeben.

1. Nutzer führt die vorbereitete Zahlung ausschließlich mit Stripe-Testkarte
   aus. Ablaufdatum in der Zukunft, keine echte Karte verwenden.
2. `node test-results/cloudflare-acceptance/verify.mjs` prüft nur lesend:
   Stripe-Zahlung, tatsächliches Webhook-Ereignis, genau einen simulierten
   Druckauftrag und echten Resend-Zustellnachweis. Nicht selbst `acceptPayment`
   aufrufen, um einen fehlenden Webhook-Nachweis zu verdecken.
3. Nutzer bestätigt Eingang und Darstellung der Testbestellmail.
4. Nach Abschluss Sandbox-Webhook deaktivieren und temporären Test-Worker
   entfernen. Testdaten nur nach Sicherung der relevanten Prüfergebnisse
   gezielt bereinigen. Produktionsdaten und Live-Webhooks bleiben bestehen.

Diese Prüfung belegt erst nach erfolgreichem Abschluss den neuen Stripe- und
Mailweg. Sie ist keine neue echte Podbase-Bestellung und keine physische
Druckfreigabe. Betriebs-/Backupfragen, Preisvergleich und Betreiberfreigabe
sind separat abzuschließen, bevor die Verkaufsschalter aktiviert werden.

Stripe-Vorgaben zum Testen:
https://docs.stripe.com/testing
