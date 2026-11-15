# Geschützter Shop-Test auf Cloudflare

Stand: 15. November 2026. Branch: `codex/cloudflare-shop`.

Der Nutzer hat im Cloudflare-Dashboard den aktiven Tarif **Free / $0** gezeigt.
Es wurde kein Tarifwechsel vorgenommen. Der vorherige reine Drucktest ist
weiterhin auf `archenlicht-cloudflare-test.jonas-herliz2910.workers.dev` erreichbar.
Die vollständige geschützte Shop-Vorschau wurde erfolgreich hochgeladen:
https://archenlicht-shop-preview.jonas-herliz2910.workers.dev/
Die produktive Domain, der Hauptbranch und die Verkaufssperre bleiben unverändert.

## Umfang

- Bestehende HTTP-Routen laufen über einen Fetch-Adapter in einem SQLite-basierten
  Durable Object. Die Geschäftsdaten liegen weiterhin bei Neon/PostgreSQL.
- Für diesen Test ist ein eigenes Schema mit Präfix `cf_preview_` vorgeschrieben.
  `public` wird abgewiesen. Es werden ausschließlich fiktive Testkunden verwendet.
- Jede Seite einschließlich Dateien ist durch ein zusätzliches Vorschaupasswort
  geschützt. Ein kurzlebiges signiertes Cookie ermöglicht weiterhin die bestehenden
  Gastbestellungslinks mit Bearer-Token. Die Vorschau ist mit `noindex` versehen.
- Zahlungen, Produktion, Bestellmails und Newsletter sind fest auf Simulation
  eingestellt. Eingetragene Live-Schlüssel werden nicht übernommen.
- Unveränderte Originalgrafiken werden bei Bedarf aus dem Asset-Binding geladen.
  Druckvorschauen werden nacheinander gerendert und nur begrenzt zwischengespeichert.
- Neue Drucke bekommen eine eigene Renderer-Kennung und einen anderen Hash.
  Vorhandene PNGs werden unverändert ausgeliefert. Fehlt bei einem alten Druck die
  fertige PNG-Datei, wird deren Neuerzeugung durch den anderen Renderer abgelehnt.
- Fehler während einer Datenbanktransaktion führen weiterhin zum Abbruch/Rollback.
  Nach einem bestätigten Commit auftretende WebSocket-Schließfehler machen die
  bereits gespeicherte Bestellung nicht nachträglich zu einem fehlgeschlagenen Vorgang.

## Prüfungen

- Bisherige Konto-, Live-Ablauf-, Druckvorlagen- und Vercel-Adapter-Prüfungen:
  24 bestanden; ein optionaler Neon-Livetest ohne Testkonfiguration übersprungen.
- Neun gezielte Prüfungen für Migration, Zugriffsschutz, CSRF, Rohdaten des
  HTTP-Adapters, Druckdatei-Erhalt und Fehlerbehandlung von Transaktionen bestanden.
- Lokale echte Workers/Durable-Object-Laufzeit mit Neon im getrennten Testschema:
  Gastkauf einer MagSafe-Hülle, Registrierung und personalisierte MagSafe-Hülle,
  simulierte Zahlung, wiederholte Bestätigung, fremder Bestellzugriff abgewiesen,
  Admin-Anmeldung, Dreier-Bundle mit 10 % Rabatt und Bestellabbruch bestanden.
- Druckdateien hatten 300 DPI und sRGB; Wunschtext und Renderer-Kennung wurden
  gespeichert. Vorangegangene lokale/remote Pixelvergleiche stehen in
  `CLOUDFLARE-TEST-2026-11-15.md`.
- Browserprüfung bei 390 und 1440 Pixeln: Startseite, Kollektion, Produkt,
  Bundles und Konto mit HTTP 200, ohne JavaScript-Fehler oder horizontales Überlaufen.
- Paketbau und Wrangler-Probelauf erfolgreich, etwa 1,45 MiB komprimierter Upload.

### Prüfung der veröffentlichten Vorschau

Version nach Konfiguration der fünf Secrets:
`744a7cbf-6050-462a-95a3-64600965aca2`.

Der auf die zwei erlaubten Testadressen beschränkte Prüfablauf wurde ebenfalls
gegen die veröffentlichte Vorschau ausgeführt:

```sh
node scripts/check-cloudflare-shop.mjs https://archenlicht-shop-preview.jonas-herliz2910.workers.dev
```

Gast- und Kontokauf, persönliche MagSafe-Hülle, Druckdateien, wiederholte
Zahlungsbestätigung, CSRF, Bestellzugriff, Admin-Anmeldung, Dreier-Bundle mit
10 % Rabatt und Abbruch bestanden. Ohne Vorschau-Anmeldung wird HTTP 401
zurückgegeben. Alle Anbieteraktionen waren simuliert; es wurde kein echter
Produktionsauftrag, keine echte Zahlung und keine E-Mail ausgelöst.

Auch die Browserprüfung wurde auf der veröffentlichten Vorschau wiederholt:
alle fünf genannten Seiten bei 390 und 1440 Pixeln mit HTTP 200, ohne
JavaScript-Fehler oder horizontales Überlaufen. Die Produktansicht wurde
zusätzlich als Bildschirmbild geprüft.

Lokale Nachweise liegen ignoriert unter `test-results/cloudflare-shop/`.
Remote-Nachweise liegen unter `test-results/cloudflare-shop-deployed/`. Die
Ausführungszeit lokaler Tests beweist keine CPU-Auslastung oder Kapazität im
kostenlosen Cloudflare-Tarif. Die Vorschau verarbeitet Anfragen seriell; ihre
Belastbarkeit muss vor einem Produktionsumzug gesondert geprüft werden.

## Einrichtung der Vorschau

```sh
pnpm run build:cloudflare-shop
pnpm exec wrangler deploy --dry-run --config cloudflare/wrangler-shop.jsonc
```

Projektname: `archenlicht-shop-preview`. Die Datei `cloudflare/wrangler-shop.jsonc`
enthält bewusst keine produktive Domain oder kostenpflichtige Zusatzdienste.
Die Cloudflare-CLI ist angemeldet; alle fünf benötigten Konfigurationswerte
wurden als Secrets hochgeladen. GitHub ist bisher nur mit dem vorherigen
Drucktest verbunden; diese Vorschau wurde über die CLI veröffentlicht.

Benötigte Secrets: `DATABASE_URL`, `DATABASE_SCHEMA`, `ADMIN_PASSWORD`,
`MIGRATION_ACCESS_PASSWORD` (mindestens 24 Zeichen), `MIGRATION_JOB_SECRET`.
Lokale Werte stehen ausschließlich in der ignorierten `cloudflare/.dev.vars`.
Keine Live-API-Schlüssel an diese Vorschau übergeben. Nicht `public` als Schema
verwenden. Für lokale Tests: Wrangler-Port 8793, danach
`node scripts/check-cloudflare-shop.mjs`.

## Vor einem Produktionsumzug noch offen

1. In der veröffentlichten Vorschau noch kalte Starts, Ressourcenverbrauch und
   parallele Nutzung prüfen; die funktionalen Kaufwegtests sind bestanden.
2. Dauerhafte Hintergrundverarbeitung mit Wiederholungen und Versandabgleich
   einrichten. Die Vorschau verarbeitet simulierte Folgeaktionen noch direkt.
3. Stripe-/Resend-Webhooks und Podbase-Anbindung in der neuen Laufzeit separat
   testen. Ein erfolgreicher simuliert bezahlter Kauf belegt diese Dienste nicht.
4. Bestehende Daten sichern; fehlende historische PNGs vorab im alten Renderer
   erzeugen. Produktionsrollen, Berechtigungen und Wiederherstellung prüfen.
5. GitHub-Deployment der neuen Anwendung, statische Seitentitel/SEO-Routen,
   Hostingangaben und Grenzwerte aller kostenlosen Dienste abschließend prüfen.
6. Erst danach Domain und Webhook-Ziele geplant umstellen und den vollständigen
   Kaufweg abnehmen. Die neue Vorschau erteilt keine Verkaufsfreigabe.

## Technische Quellen

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://github.com/neondatabase/serverless
