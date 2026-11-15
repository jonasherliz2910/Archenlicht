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
- Persistierte Durable-Object-Alarme nehmen offene Aufträge und Mailversuche wieder
  auf. Der Wecktermin wird vor möglichen geschäftlichen Änderungen gespeichert.
  Abgelaufene Auftrags-Leases und vorhandene Anbieter-IDs bleiben maßgeblich;
  unklare Übergaben werden zunächst abgeglichen. Ohne offene Arbeit endet der Alarm.

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

Die Vorschau hat eigene Benutzerkonten. Der Browser-Zugang mit Benutzername
`preview` ist kein Shop-Login. Ein verifizierter Testkunden-Zugang und der
separate Testadmin stehen in der ignorierten lokalen Datei
`.tools/cloudflare-vorschau-zugang.txt` im ursprünglichen Projektordner.
Bestehende produktive Kunden und Administratoren wurden nicht kopiert.
Die Konto-Anmeldeseite erklärt dies nur in der isolierten Vorschau.

Nachtrag zur Anmeldung, Version `775fc0fc-dbf5-47bf-a2d1-ce7c049792bc`:
Registrierung, Abmeldung, erneute Anmeldung und Seitenneuladen des Testkunden
sowie Testadmin-Anmeldung und Zugriff auf die Administration wurden im Browser
gegen Cloudflare erfolgreich geprüft. Nach erfolgreicher Registrierung wechselt
das Formular für eine spätere Anmeldung jetzt zurück in den Anmeldemodus.
Prüfprotokoll: `test-results/cloudflare-shop-deployed/account-login.json`.

### Hintergrundverarbeitung und parallele Anfragen

Version `ddffae03-e51f-44e0-801a-d74a4211ee28` enthält den Alarm-Scheduler.
Sechs zusätzliche Tests prüfen Wiederaufnahme nach Serverneustart, verlorene
Anbieterantworten ohne zweiten POST, aktive Leases, Versand ohne doppelte Mail,
Mail-Retryzeiten und dauerhafte Wiederholungen bei Datenbankausfall.

In der veröffentlichten Vorschau wurde eine simuliert bezahlte Bestellung mit
aktiver Lease gespeichert und danach erneut deployt. Ohne weitere Shopanfrage
übernahm ein Alarm den Auftrag nach Ablauf der Lease. Genau ein simulierter
Druckauftrag und ein Übergabeversuch wurden gespeichert. Die Beobachtung erfolgte
direkt in der isolierten Datenbank. Rechner- und Worker-Uhr können abweichen;
daraus wird keine Latenz abgeleitet.

Sechs gleichzeitige Sitzungen hatten getrennte CSRF-Token. Drei parallele
Wunschtext-Vorschauen mit verschiedenen Motiven/Farben und einer MagSafe-Variante
behielten ihre jeweilige Konfiguration und lieferten unterschiedliche gültige
PNGs. Die Gruppen dauerten 594 ms (Bootstrap), 5755 ms (Vorschauen) und 5816 ms
(PNG-Abfragen). Das sind Netzwerk-Wandzeiten, kein CPU- oder Lastkapazitätsnachweis.

Nachweise: `test-results/cloudflare-shop-deployed/recovery.json` und
`parallel.json`. Reproduzierbar mit `scripts/check-cloudflare-recovery.mjs`
(`prepare`, anschließend Deploy, danach `check`; separat `parallel`).

Der Scheduler bearbeitet maximal drei fällige Aufträge je Lauf. Er berücksichtigt
Mail-Leases und Retryzeiten, gleicht Produktionsstände standardmäßig alle 30
Minuten ab und erhöht bei Datenbankfehlern die Pause bis auf 15 Minuten. Manuell
angehaltene Simulationen erzeugen keine endlose Statusabfrage. Ein größerer
Lasttest und die Beobachtung tatsächlicher Free-Kontingente stehen noch aus.

Benötigte Secrets: `DATABASE_URL`, `DATABASE_SCHEMA`, `ADMIN_PASSWORD`,
`MIGRATION_ACCESS_PASSWORD` (mindestens 24 Zeichen), `MIGRATION_JOB_SECRET`.
Lokale Werte stehen ausschließlich in der ignorierten `cloudflare/.dev.vars`.
Keine Live-API-Schlüssel an diese Vorschau übergeben. Nicht `public` als Schema
verwenden. Für lokale Tests: Wrangler-Port 8793, danach
`node scripts/check-cloudflare-shop.mjs`.

## Vor einem Produktionsumzug noch offen

1. Das erwartete Lastprofil und den tatsächlichen Ressourcenverbrauch im
   kostenlosen Tarif prüfen; die kleinen Parallel- und Wiederaufnahmetests bestehen.
2. Eine abschließende Anbieter-Abnahme beim geplanten Umzug durchführen.
   SDKs, Signaturen, Alarm-Scheduler und verlorene Antworten sind in workerd
   mit abgefangenen Anbieteraufrufen geprüft; echte Zahlungen, Mailzustellung
   und Produktion wurden dabei nicht ausgelöst.
3. Die endgültige Cloudflare-Konfiguration für Livebetrieb und öffentliche,
   signaturgeschützte Webhooks/Druckdateien bereitstellen. Die jetzige Vorschau
   bleibt absichtlich vollständig passwortgeschützt und simuliert. Falls die
   Domain unverändert bleibt, können die bisherigen Webhook-URLs bleiben;
   ihre Erreichbarkeit muss nach der DNS-Umstellung geprüft werden.
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
- https://developers.cloudflare.com/durable-objects/api/alarms/
- https://github.com/neondatabase/serverless

## Anbieterprüfung und behobene Umzugsfehler – 15. November 2026

Zwei bisher durch einfache HTTP-Mocks verdeckte Laufzeitprobleme wurden behoben:

- Stripe wählt im Workers-Paket Web Crypto. Die synchrone Signaturprüfung
  lehnte dadurch auch gültige Webhooks ab. Der Shop wartet jetzt auf
  `constructEventAsync`; falsche, veränderte und abgelaufene Signaturen bleiben
  gesperrt. Der bestehende Node-Server verwendet denselben geprüften Ablauf.
- Workers unterstützt `redirect: 'error'` nicht. Podbase-Katalog, Auftrags-API
  und Resend-Versand verwenden jetzt `manual`. Weiterleitungen werden nicht
  verfolgt und gelten nicht als erfolgreiche Antwort. Zugangsdaten werden
  dadurch weiterhin nicht an ein Weiterleitungsziel übertragen.

`node scripts/check-cloudflare-providers.mjs` baut eine getrennte Testdatei mit
denselben Ressourcen-/WASM-Ersetzungen wie die Shop-Vorschau. Sie läuft in der
von Wrangler mitgelieferten workerd-/Durable-Object-Laufzeit mit echter Neon-
Datenbank, aber in einem neu erzeugten, anschließend gelöschten Testschema.
Alle Anbieterzugänge sind feste Dummywerte; fremde Fetch-Ziele werden blockiert.
Native Request-Erzeugung vor den Mocks verhindert, dass ungültige Fetch-Optionen
erneut unbemerkt bleiben. Testdateien sind im deploybaren Shop ausdrücklich verboten.

Bestanden: Stripe-Checkout über das echte SDK; unveränderte UTF-8-Rohdaten;
Signatur-, Modus- und Betragsprüfung; keine Produktion vor bestätigter Zahlung;
MagSafe-Variante samt Wunschtext, Farbe und Druckdatei; Wiederaufnahme nach
verlorener Podbase-Antwort ohne zweiten POST; Resend-Wiederholung mit gleichem
Idempotenzschlüssel und Inhalt; einmalige Fehlermeldung an den Betreiber;
signierte Resend-Zustellung ohne doppelte Ereignisse; genau eine Versandmail
erst bei vorhandener Sendungsnummer; Ende des Alarms bei erledigten Aufgaben.

Zusätzlich wurde ein kurzlebiger, geschützter Prüf-Worker tatsächlich bei
Cloudflare veröffentlicht und anschließend gelöscht. Er führte ausschließlich
fest definierte GET-Abfragen aus. Die vorhandenen Schlüssel wurden nur für
diese HTTPS-Anfrage im Arbeitsspeicher verarbeitet, nicht als Worker-Secrets
gespeichert. Die Ergebnisse um 20:32 UTC:

- Stripe: HTTP 200, Zahlungen und Auszahlungen aktiv. Der Live-Webhook auf
  `https://www.archenlicht.de/api/webhooks/stripe` ist aktiviert und enthält
  die vier benötigten Checkout-Ereignisse.
- Podbase: Katalog und Bestellabfrage HTTP 200; 28 Katalogprodukte. Der
  bestehende alte Verbindungstest steht inzwischen auf `REJECTED`; eine
  Begründung liefert die API nicht. Er wurde nicht neu angelegt oder freigegeben.
- Resend: erreichbar, Schlüssel ausdrücklich auf Versand beschränkt. Der
  Domain-Verwaltungsaufruf liefert deshalb `restricted_api_key` (HTTP 401).
  Das beweist keine aktuelle Zustellung und erfordert keine Rechteausweitung.
  DKIM, Return-Path-SPF/MX, DMARC und die Hostinger-Postfach-MX waren bei der
  zusätzlichen DNS-Prüfung vorhanden. Die signierte Verarbeitung im Shop ist
  mit Dummyereignissen geprüft; eine neue echte Mail wurde nicht versendet.

Die lesende Podbase-Zuordnungsprüfung bestätigte weiterhin 74 verfügbare
zugeordnete Modelle, davon 64 mit Standard-Druckvorlage und 38 druckbare
MagSafe-Varianten. Fehlende Originalvorlagen bleiben Kaufhindernisse.

Begleitende native Regression: 50 Tests bestanden, ein optionaler Neon-Livetest
übersprungen. Nach der Redirect-Korrektur erneut 25 relevante Tests bestanden,
ein optionaler Neon-Livetest übersprungen. Keine fehlgeschlagenen Prüfungen.
Paketbau und Wrangler-Probelauf bestehen; etwa 1,45 MiB komprimierter Upload.
Die Korrekturen sind in Vorschau-Version
`48afc61f-3017-48ba-b886-6da79f10af50` veröffentlicht. Gastkauf, Konto mit
Wunschtext/MagSafe, Druckdateien, doppelte Zahlungsbestätigung, fremder Zugriff,
Admin, Dreier-Bundle und Abbruch bestanden anschließend erneut auf der
geschützten Cloudflare-Adresse. Dort bleiben alle Anbieteraktionen simuliert.

Lokale Nachweise (ignoriert): `test-results/cloudflare-providers/report.json`,
`native-tests.log`, `provider-native-tests.log`,
`test-results/cloudflare-provider-access/report.json` und
`test-results/cloudflare-shop-deployed/provider-access-local.json`.
Die temporäre externe Prüfung lässt sich mit
`node scripts/check-cloudflare-provider-access.mjs <ursprünglicher Projektordner>`
wiederholen; sie verändert weder Anbieter-Einstellungen noch den Live-Shop.

Quellen zu den tatsächlich aufgetretenen Laufzeitproblemen und Berechtigungen:

- https://github.com/stripe/stripe-node/blob/master/src/crypto/SubtleCryptoProvider.ts
- https://developers.cloudflare.com/workers/runtime-apis/request/
- https://resend.com/changelog/new-api-key-permissions
- https://help.podbase.com/hc/en-us/articles/26709382744604-Podbase-API-integration-guide
