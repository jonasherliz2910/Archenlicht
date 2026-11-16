# Zahlungsabnahme nach dem Cloudflare-Umzug

Stand: 16. November 2026. Die vom Nutzer ausgeführte Stripe-Testzahlung und
der technische Mailweg sind erfolgreich geprüft. Die Sichtprüfung der E-Mail
durch den Nutzer steht noch aus. Keine allgemeine Verkaufsfreigabe.

Der Nutzer bestätigt, dass er den früheren Podbase-Verbindungstest bewusst
storniert hat. Dessen Status `REJECTED` ist damit erklärt und kein neuer
Nachweis eines Integrationsfehlers. Die sieben noch unbelegten Druckmodelle
sollen zunächst zurückgestellt bleiben.

## Getrennte Testumgebung und Vorbereitung

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
  `info@archenlicht.de`. Vor Zahlung bestätigte Stripe `livemode=false`,
  offenen/unbezahlten Checkout, EUR und deaktivierte automatische Steuerberechnung.
- Vor Zahlung: Bestellmail mit `[TEST]`-Betreff im Zustand `waiting-payment`,
  null Versandversuche und null Fulfillment-Aufträge. Versand ist auf das
  freigegebene Testpostfach begrenzt. Es wird nichts physisch gefertigt.
- Der existierende Resend-Webhook bleibt auf der öffentlichen Shopadresse.
  Seine echten, signaturgeprüften Zustellereignisse wurden nach Testversand
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

## Ergebnis nach Zahlung durch den Nutzer

Der Nutzer meldete „Testzahlung abgeschlossen“. Die anschließende Prüfung
hat ausschließlich gelesen; sie hat weder die Zahlung selbst bestätigt
noch einen Mail- oder Druckauftrag nachträglich erzeugt.

- Stripe-Checkout `complete`, Zahlungsstatus `paid`, `livemode=false`, 3499 Cent.
- Ein tatsächliches `checkout.session`-Webhook-Ereignis wurde im Testshop
  verarbeitet und die Bestellung als bezahlt gespeichert.
- Genau ein simuliertes Fulfillment, ein Anbieter-Versuch, keine Fehlermeldung.
  Die dortige Statusbezeichnung `production` gehört ausdrücklich zum lokalen
  Simulator und belegt keine reale Podbase-Produktion.
- Genau eine Bestellbestätigung, ein Resend-Versandversuch, Anbieter-ID gespeichert.
- Resend-Ereignisse `email.sent` und `email.delivered` für exakt diese Nachricht
  am unveränderten öffentlichen Cloudflare-Mailwebhook nachgewiesen.
  Im isolierten Testshop bleibt der Datensatz erwartungsgemäß `accepted`,
  da der Zustellwebhook in das Produktionsschema schreibt. Diese Umgebungen
  wurden nicht durch Kopieren von Ereignissen vermischt.
- Produktionsprüfung danach unverändert: Checkout und echte Podbase-Übermittlung
  gesperrt, acht historische Testbestellungen und zehn Mailzustände `delivered`.

Prüfskript-Ergebnis `passed=true` in
`test-results/cloudflare-acceptance/verification.json`. Ein Zustellnachweis
belegt noch nicht die Ablage im Hauptpostfach; der Nutzer wird um Prüfung
von Eingang und Darstellung der Mail gebeten.

## Fortsetzen

Die lokalen, ignorierten Nachweise und Hilfsskripte liegen unter
`test-results/cloudflare-acceptance/`. Zugangsdaten nicht ausgeben.

1. Nutzer bestätigt Eingang und Darstellung der Testbestellmail.
2. Nach Abschluss Sandbox-Webhook deaktivieren und temporären Test-Worker
   entfernen. Testdaten nur nach Sicherung der relevanten Prüfergebnisse
   gezielt bereinigen. Produktionsdaten und Live-Webhooks bleiben bestehen.

Diese Prüfung belegt den neuen Stripe-Testzahlungs- und Mailweg.
Sie ist keine neue echte Podbase-Bestellung und keine physische
Druckfreigabe. Betriebs-/Backupfragen, Preisvergleich und Betreiberfreigabe
sind separat abzuschließen, bevor die Verkaufsschalter aktiviert werden.

Stripe-Vorgaben zum Testen:
https://docs.stripe.com/testing
