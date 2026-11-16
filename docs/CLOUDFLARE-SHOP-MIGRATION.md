# Geschützter Shop-Test auf Cloudflare

Stand: 16. November 2026. Branch: `codex/cloudflare-shop`.

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
3. Die vorbereitete Produktionsanwendung erst nach der Abnahme an die Domain
   anschließen. Die bisherigen Webhook-URLs können bleiben; ihre Erreichbarkeit
   muss nach der DNS-Umstellung geprüft werden. Die Testvorschau bleibt getrennt.
4. Unmittelbar vor dem Wechsel die bereits geprüfte Sicherung aktualisieren
   und auf seitdem hinzugekommene historische Druckdateien prüfen.
5. GitHub-Deployment der neuen Anwendung, Hostingangaben und Grenzwerte aller
   kostenlosen Dienste abschließend prüfen. Statische Seitentitel/SEO-Routen
   sind im neuen Produktionspaket bereits berücksichtigt.
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


## Sicherung und vorbereiteter Produktivbetrieb – 16. November 2026

Stand vor dem Nameserver-Wechsel: Die Website ist weiterhin bei Vercel. Die öffentlichen Nameserver sind
byte.dns-parking.com/pixel.dns-parking.com; www zeigt auf Vercel. Hostinger
bleibt für die Postfächer zuständig. Keine DNS-Einträge wurden verändert.
Checkout und Podbase-Übergabe bleiben in beiden Produktionskonfigurationen aus.

### Daten und Konten

- AES-256-GCM-verschlüsselte, komprimierte logische Sicherung aller 32
  Geschäftstabellen. Nach dem Export vom Datenträger entschlüsselt, in einem
  neuen zufälligen Testschema vollständig wiederhergestellt und jede Tabelle
  einschließlich aller Werte, Spalten und Constraints verglichen. Testschema
  anschließend entfernt. Kein bestehendes Schema wurde ersetzt.
- Sechs in bisherigen Testbestellungen verwendete, aber noch nicht als PNG
  gespeicherte Druckdateien über den alten Vercel-Renderer erzeugt. Alle sind
  PNG mit 300 DPI, unter ihrem ursprünglichen Hash gespeichert. Insgesamt
  enthält die Datenbank jetzt 14 gespeicherte PNGs. Die übrigen 317 Assets
  gehören zu unbestellten Vorschauen; deren alte Hashes werden weiterhin
  nicht durch den neuen Renderer neu gezeichnet.
- Danach erneut gesichert und erfolgreich wiederhergestellt: 1.469 Datensätze,
  23.121.739 Byte verschlüsselte Datei. Zwei bestehende Benutzer einschließlich
  unveränderter Passwort-Hashes und Rollen bestätigt. Alle acht bisherigen
  Bestellungen sind Testbestellungen. Keine offenen Mailzustellungen gefunden.
- Eigener Datenbankbenutzer archenlicht_cf_app für Cloudflare: CONNECT,
  Schema-USAGE und SELECT/INSERT/UPDATE/DELETE auf den bestehenden 32 Tabellen.
  Kein SUPERUSER, CREATEDB, CREATEROLE, Schema-CREATE oder TRUNCATE.
  Der Produktionsstart wurde mit diesem Zugang lesend geprüft.
- existingStoreOnly prüft die vorhandenen Tabellen und das bestehende Admin-
  Konto. Es erstellt keine Tabellen, Produktfreigaben, Benutzer oder Passwörter.
  Für neue Datenbankschemata/-migrationen ist weiterhin ein separater
  administrativer Wartungsschritt nötig. Der bisherige Vercel-Zugang bleibt.

Originalarbeitsordner (alles ignoriert):
.tools/migration-backups/2026-11-16/shop-2026-11-16T16-41-18-888Z.albackup
und zugehöriger JSON-Prüfbericht. Schlüssel getrennt in
.tools/migration-backup-key.txt. Weitere Nachweise: historical-prints.json,
account-preservation.json, cloudflare-database-role.json im Sicherungsordner.
Sicherung und Schlüssel liegen lokal auf demselben PC, nicht extern gesichert.
Die Sicherung enthält Shopdaten und Tabellenschema, keine Datenbankrollen
oder Zugangsdaten; sie ersetzt keinen vollständigen Cluster-/Rollen-Export.

Wiederholung: node scripts/shop-backup.mjs <ursprüngliche .env.local>
<ignorierter Sicherungsordner> <ignorierte Schlüsseldatei>.
Das Werkzeug bricht bei nicht unterstützten Schemaobjekten ab und testet nur
in einem neu angelegten cf_restore_<Zufall>-Schema. Vor einem echten Restore
zuerst ein neues Zielschema anlegen, Daten prüfen und Zugriffsrechte gesondert
setzen; nie die Produktivtabellen mit einem ungeprüften Import überschreiben.

### Cloudflare-Konfiguration

Separate Dateien production-config.js, production-router.js,
production-worker.js und wrangler-production.jsonc im Ordner cloudflare.
Die bestehende Vorschau-Konfiguration bleibt isoliert und simuliert.
Produktions-Build: pnpm run build:cloudflare-production.
Deployment: pnpm run deploy:cloudflare-production.
Das aktuelle Deployment ist ausdrücklich ohne Domain/Route und ohne öffentliche
workers.dev- oder Versions-Vorschau-Adresse vorbereitet. Es empfängt keinen
Besucherverkehr. Keine echten Anbieteraktionen wurden ausgelöst.

Worker: archenlicht-shop. Nach dem Secret-Upload aktive Version:
bdab6575-701d-4bf3-bec2-a5be4d679154.
14 Konfigurationseinträge wurden verschlüsselt als Cloudflare-Secrets gesetzt.
Quelle im Worktree: cloudflare/.env.production.secrets.json (ignoriert).
Darin nur der beschränkte Datenbankzugang, kein bestehendes Admin-Passwort.
CRON_SECRET wurde für Cloudflare neu erzeugt; die Vercel-Konfiguration ist
unverändert. Secret-Werte und Sicherungsdateien gehören nicht nach GitHub.

Der Router erhält unveränderte Webhook-Rohdaten, Signaturen und Bearer-Zugänge.
Stripe-/Resend-Webhooks sind ohne Vorschau-Basic-Auth erreichbar; der Server
prüft ihre Signaturen. /api/jobs bleibt geheimnisgeschützt, API-/Druckantworten
werden nicht geteilt gecacht. Die Herkunfts-IP kommt ausschließlich von
Cloudflare. Produkt- und Bundleseiten nutzen ihre erzeugten HTML-Seitentitel;
versionierte Frontenddateien werden gecacht. Der Produktionsbuild ist
indexierbar. Vollständige Request-Aufruflogs sind abgeschaltet.

Prüfungen: 22 native Tests bestanden; workerd-Anbietertest mit isolierter Neon-
Datenbank erneut vollständig bestanden, einschließlich fehlendem Admin und
Erhalt bestehender Passwort-Hashes. Miniflare führte zusätzlich das echte
Produktionspaket aus: eigene Produkt-/Bundle-Titel, keine Vorschau-Sperre und
503 bei unvollständiger Konfiguration. Paketbau, Wrangler-Dry-run und Upload
bestanden (1.484 KiB gzip, Startzeit laut Cloudflare 27 ms).
Diese Startzeit ersetzt keinen Last-/CPU-Kontingenttest.

Nachweise im Worktree: test-results/cloudflare-production/bundle-check.json,
inactive-deployment.json und test-results/cloudflare-providers/report.json.
Cloudflare bestätigte workers.dev=false und previews_enabled=false. Die
öffentliche Vercel-Gesundheitsprüfung meldet weiterhin Checkout/Übergabe=false.

Nächster gemeinsamer Schritt: Domain-Aufnahme und DNS-Import bei Cloudflare
prüfen. Hostinger-MX sowie SPF/DKIM/DMARC für Hostinger und Resend vollständig
bewahren. Noch keine Nameserver oder Webhook-Ziele ändern. Vor dem Umschalten
weiterhin Hostingtexte, GitHub-Build, Last/Free-Kontingente und Rückfallplan
abschließen. Der Rückfall auf Vercel bleibt möglich, weil Datenbank, bestehende
Konten, Originaldrucke und Vercel-Projekt erhalten sind.

Quellen zur Routing-Konfiguration:
https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

Auch die geschützte Vorschau wurde auf Version ff535871-de4c-4cb1-8c7c-689921a70b60
aktualisiert. Der vollständige Gast-/Kontokauf, MagSafe/Wunschtext, Druckdateien,
Zugriffsschutz, Admin, Dreier-Bundle und Abbruch bestanden danach erneut auf
der Cloudflare-Adresse; alle Anbieteraktionen blieben simuliert.
Die lesende Cloudflare-Domainabfrage lieferte zu diesem Zeitpunkt für archenlicht.de keine Zone.

## Nameserver-Wechsel abgeschlossen – 16. November 2026, 18:40 Uhr

Der Nutzer hat die Nameserver bei Hostinger gespeichert und die Prüfung bei
Cloudflare angestoßen. Cloudflare meldet die Zone seit 17:37:31 UTC als aktiv.
Sowohl 1.1.1.1 als auch 8.8.8.8 liefern marissa.ns.cloudflare.com und
quincy.ns.cloudflare.com. Die Domain bleibt bei Hostinger registriert.

Vor dem Wechsel wurden alle 14 DNS-Einträge direkt gegen die autoritativen
alten und neuen Nameserver abgeglichen. Wichtig: send und rsend sind CNAMEs
auf send.forge.rmta.net bzw. rsend-euw1.forge.rmta.net, ohne zusätzliche
TXT- oder MX-Einträge desselben Namens. Die Hostinger-MX-Einträge mit Priorität
5 und 10, Hostinger-DKIM/SPF, Resend-DKIM und DMARC sind erhalten. Alle A/CNAME
stehen weiterhin auf DNS only. Kein DS-Eintrag war beim Registrar gesetzt.

Die Website zeigt weiterhin auf Vercel: A @ = 216.198.79.1 und CNAME www =
ba346264650cdc86.vercel-dns-017.com. HTTPS und /api/health antworteten mit 200;
Checkout und Podbase-Übermittlung sind aus. Produktions-Worker archenlicht-shop
hat noch keine Domains. Die Nameserver-Aktivierung allein schaltet kein Hosting um.

Nachweise: test-results/cloudflare-dns/verified-complete-import.json und
activation-check.json. DNS-API-Schreibrechte sind im CLI-Zugang nicht vorhanden;
die Eingaben wurden vom Nutzer im Dashboard vorgenommen.

Die Datenschutzseite im Migrationszweig nennt nun Cloudflare mit Verweisen auf
dessen Datenschutz- und Datenverarbeitungsbedingungen. Die weiterhin auf Vercel
ausgelieferte Seite wird dadurch noch nicht geändert.

Kleiner gleichzeitiger Vorschautest erneut bestanden: sechs Sitzungen und drei
unterschiedliche Druckdateien, ohne Vermischung von Gestaltung oder Sitzungen.
Netzwerkzeiten: Bootstrap gesamt 908 ms, Vorschauen 7.334 ms, PNG-Abruf 457 ms.
Cloudflare-GraphQL meldete für den Vorschau-Worker am 16. November bis 17:40 UTC
37 Aufrufe, 0 Fehler, CPU-P50 1.652 und P99 3.937 Mikrosekunden. Diese Messung
beschreibt den vorgeschalteten Worker, nicht die rechenintensiven Durable Objects.
Sie ist keine Garantie für zukünftige Last oder ausreichende Tageskontingente.
Nachweise: test-results/cloudflare-shop-deployed/parallel.json und
test-results/cloudflare-production/preview-metrics.json.

Produktions-Worker mit den aktualisierten Hostingangaben erfolgreich gebaut und
ohne öffentliche Route bereitgestellt: Version 0aae5855-4d4d-4625-8a2e-7967fa7fb327.
Nächster Schritt: Vor der Domain-Anbindung frisch sichern und anschließend www sowie die Hauptdomain
an archenlicht-shop anbinden. Danach öffentliche Routen, Konten und Signaturprüfung
kontrollieren. Verkäufe bleiben gesperrt. GitHub-Build-Verknüpfung für diesen Worker
und Dauerbetrieb innerhalb der kostenlosen Kontingente bleiben noch zu prüfen.

Abschließender Statusnachweis: test-results/cloudflare-dns/activation-complete.json.

### Domain-Anbindung: DNS-Konflikt – 16. November 2026, ca. 18:54 Uhr

Nach dem Domain-Dialog blieb die Worker-Domainliste leer; per API bestätigt.
Die CLI-Anmeldung wurde mit wrangler whoami erfolgreich erneuert. Vor dem
Umschalten wurde nochmals verschlüsselt gesichert und vollständig wiederhergestellt:
shop-2026-11-16T17-50-38-268Z.albackup, 32 Tabellen, 1.471 Zeilen,
23.121.881 Byte, Restore bestanden und Testschema entfernt.

Der Vorschauaufruf /workers/scripts/archenlicht-shop/domains/changeset meldete
beide gewünschten Hosts als hinzugefügt und keine Konflikte. Der tatsächliche
PUT auf /domains/records mit override_existing_dns_record=true wurde jedoch
mit HTTP 409 / Fehler 100117 abgelehnt: www.archenlicht.de besitzt noch extern
verwaltete DNS-Einträge, die zuerst entfernt werden müssen. Dies ist ein
Cloudflare-DNS-Konflikt, keine automatische Genehmigungsablehnung.

Keine Domain wurde angelegt. Erneut geprüft: www zeigt auf
ba346264650cdc86.vercel-dns-017.com, die Hauptdomain auf 216.198.79.1,
Hostinger-MX unverändert, Website HTTP 200 über Vercel, beide Verkaufsschalter aus.
wrangler-production.jsonc bleibt deshalb vorerst bei routes: [].
Nachweise: test-results/cloudflare-production/domain-changeset.json und
domain-attachment.json. Der aktuelle CLI-Zugang kann Worker-Domains verwalten,
aber keine DNS-Einträge bearbeiten. Nächster Nutzerschritt: DNS-Tabelle öffnen,
alte Website-Einträge gezielt prüfen und zur direkten Worker-Anbindung ersetzen.
Mail-Einträge erhalten. Erst nach erfolgreicher Anbindung beide Custom Domains
in der Wrangler-Konfiguration festhalten.

### www erfolgreich verbunden – 16. November 2026

Der Nutzer hat den alten www-CNAME entfernt. Anschließend wurde ausschließlich
www.archenlicht.de per Worker-Domain-API erfolgreich an archenlicht-shop gebunden.
override_existing_origin und override_existing_dns_record waren beide false.
Domain-ID a5d9955426dfe90091f0baaf018d8ff9ea94c685; Zertifikat
360756e2-1cca-45c4-a7ab-210f2f77b154; enabled=true, previews_enabled=false.
wrangler-production.jsonc enthält jetzt genau diese Custom Domain.

1.1.1.1 liefert Cloudflare-Adressen für www; kein alter www-CNAME mehr vorhanden.
Der lokale Windows-DNS-Cache lieferte beim ersten HTTP-Test noch Vercel. Deshalb
wurden zusätzliche HTTPS-Aufrufe mit dem aktuellen Cloudflare-Ziel, richtigem
Hostnamen/SNI und normaler Zertifikatsprüfung ausgeführt: Startseite 200,
Produktseite Nach dem Sturm 200, Gesundheitsprüfung 200, Shopstart 200 mit sechs
Motiven und 74 Modellen. Beide Verkaufsschalter false. Ungültige Stripe- und
Resend-Signaturen: jeweils 401. Unautorisierter Jobaufruf: 403. Antworten tragen
server=cloudflare und cf-ray. Die Hostinger-MX-Einträge sind unverändert.

Nachweise: test-results/cloudflare-production/www-attachment.json,
www-first-check.json und www-direct-check.json. Die Hauptdomain ohne www zeigt
noch mit A 216.198.79.1 auf Vercel. Nächster Schritt: Nutzer entfernt gezielt
diesen A-Eintrag; dann beide Hosts gemeinsam an den Worker binden und die
Wrangler-Konfiguration um die Hauptdomain ergänzen. Bestehende www-Anbindung
beibehalten. Verkauf weiterhin gesperrt; noch kein abgeschlossener Verkaufsstart.

### Beide Domainadressen umgeschaltet – 16. November 2026, 19:02 Uhr

Der Nutzer hat auch den A-Eintrag 216.198.79.1 der Hauptdomain entfernt.
Die anschließende API-Anbindung beider Hosts war erfolgreich. archenlicht.de
und www.archenlicht.de zeigen jetzt auf archenlicht-shop; beide enabled=true,
previews_enabled=false. Die Wrangler-Konfiguration hält beide Custom Domains fest.
Die Hauptdomain hat Domain-ID a1f505e6576c8652a62980f3594d79783e2fde3e und
Zertifikat 4d165f87-4b6d-4404-baa6-22d1d123cec7. Kein kostenpflichtiger Tarifwechsel.

HTTPS mit aktuellen öffentlichen DNS-Adressen und unveränderter Zertifikatsprüfung
kontrolliert: Die Hauptdomain leitet Seiten mit 308 auf www weiter, einschließlich
Pfad und Query. /api/health bleibt auf beiden Hosts direkt erreichbar und meldet
Checkout sowie Podbase-Übermittlung=false. Start- und Produktseite auf www liefern
200. Eingebundene Startskripte, Stylesheet, Favicon und Schrift liefern ihre
richtigen Content-Types; die Datenschutzdatei enthält Cloudflare. Antworten kommen
von Cloudflare. Lokale oder externe DNS-Caches können vorübergehend alte Ziele halten.

Mail-DNS erneut geprüft: Hostinger MX 5/10, SPF, drei DKIM-CNAMEs, DMARC,
Resend-DKIM und die send-/rsend-CNAMEs sind erhalten. Dies war eine DNS-Prüfung,
kein erneuter E-Mail-Versand. Ein erster Testabbruch beruhte nur auf einem
zusätzlichen type-Feld im DNS-Toolergebnis; der Vergleich der MX-Fachfelder
exchange/priority und der vollständige erneute Durchlauf bestanden.

Über den eingeschränkten Cloudflare-Datenbankzugang wurden alle Werte der beiden
bestehenden Konten mit der Sicherung unmittelbar vor dem Wechsel verglichen:
unverändert, einschließlich Passwort-Hashes und Rollen. Keine Konten neu erstellt
oder zurückgesetzt. Die Anmeldung im Browser des Nutzers ist noch zu bestätigen.

Nachweise: test-results/cloudflare-production/all-domains-attachment.json,
domain-cutover-check.json und accounts-after-cutover.json. Neuer Stand:
Domain-Umschaltung abgeschlossen; Verkäufe weiterhin gesperrt. Nächster gemeinsamer
Schritt ist die Anmeldung mit dem bisherigen Konto auf www.archenlicht.de.
GitHub-Build-Anbindung für archenlicht-shop, verbleibende Betriebs-/Kontingentprüfung
und gesonderte Verkaufsfreigabe sind weiterhin offen. Vercel-Projekt erhalten.

### Bestehende Anmeldung bestätigt; GitHub-Verknüpfung als Nächstes

Jonas bestätigt nach der Domain-Umschaltung ausdrücklich, dass die Anmeldung
mit dem bisherigen Konto auf dem öffentlichen Shop funktioniert ("ja geht").
Damit ist die Bestätigung im Nutzerbrowser erfolgt.

Der Produktions-Worker hat den unveränderlichen Tag
5d3dc88e8a394e898a2f025cde895aec. Die lesende Abfrage der Builds-Trigger über
/accounts/{account}/builds/workers/{tag}/triggers liefert mit dem bestehenden
OAuth-Zugang HTTP 403 (Authentication error). Gleiches gilt beim alten Testworker;
daraus folgt kein Fehler des laufenden Shops. Nachweise liegen ignoriert unter
test-results/cloudflare-production/archenlicht-shop-build-triggers.json und
archenlicht-cloudflare-test-build-triggers.json.

Nächster Nutzerschritt: archenlicht-shop > Settings > Builds öffnen und die
Git-Verknüpfung prüfen/einrichten. Konkrete Einstellungen für den bereits
veröffentlichten Stand: Repository jonasherliz2910/Archenlicht, Produktionsbranch
codex/cloudflare-shop, Wurzel /, Build pnpm run build:cloudflare-production,
Deploy pnpm run deploy:cloudflare-production. Preview-Builds vorerst aus;
keine Produktionsschlüssel als Build-Variablen kopieren. Sie bleiben verschlüsselt
in der Worker-Laufzeit. Nach Verbindung einen GitHub-Build und die resultierende
Deployment-Version sowie beide Domains und Sperrschalter prüfen. main enthält
noch den bisherigen Vercel-Stand; kein unbeabsichtigter Branchwechsel.

Die alte LIVE-CHECKLISTE.md vom 8. November beschreibt nicht den heutigen Stand.
Für die weitere Verkaufsfreigabe die jüngeren Prüfberichte und tatsächlich aktive
Konfiguration heranziehen; bereits erledigte Betreiber-, Anbieter- und Domain-
Schritte nicht erneut als fehlend ausgeben. Verkäufe bleiben weiterhin gesperrt.

### Automatischen Produktionsbuild prüfen

Der Dashboard-Screenshot bestätigt die Produktionsbefehle
pnpm run build:cloudflare-production und pnpm run deploy:cloudflare-production,
die Wurzel / sowie den neu ausgewählten Build-Token archenlicht-shop-build.
Build-Variablen sind leer; die vorhandenen Laufzeit-Secrets werden nicht dorthin
kopiert. Der Produktionsbranch ist im letzten Screenshot nicht sichtbar.

Dieser Commit auf codex/cloudflare-shop dient zugleich zur Prüfung des neuen
GitHub-Auslösers. Erfolg erst nach abgeschlossenem Cloudflare-Build und Prüfung
der resultierenden Veröffentlichung bestätigen. Verkaufs- und Podbase-Freigabe
bleiben davon unabhängig gesperrt.

### GitHub-Build erfolgreich verifiziert (16. November 2026, 19:17 MEZ)

Der Push von 7cce471 auf codex/cloudflare-shop hat den Check
"Workers Builds: archenlicht-shop" ausgelöst und erfolgreich abgeschlossen.
Build-ID: 4bd1af2c-4adc-4f6b-9a7e-99640f34ec51. Die im GitHub-Check gemeldete
Version 97287bd2-3ad1-494f-a479-503fecb7f0e7 stimmt mit der zu 100 Prozent aktiven
Cloudflare-Veröffentlichung überein (Deployment adb7768d-8a07-4041-9284-acc94d31cf6b).
Damit ist die automatische Veröffentlichung aus dem Migrationsbranch praktisch
nachgewiesen; kein Wechsel zu main erforderlich.

Danach geprüft: www-Startseite und Bootstrap HTTP 200, Hauptdomain leitet mit 308
einschließlich Pfad und Query auf www um, beide Health-Endpunkte HTTP 200.
Alle 14 vorhandenen Secret-Bindings und beide Custom Domains sind erhalten.
Checkout und Podbase-Übermittlung melden weiterhin false. Nachweise:
test-results/cloudflare-production/github-build-verification.json und
after-github-build.json (ignoriert, ohne Schlüsselwerte).

Der Hostingwechsel einschließlich GitHub-Veröffentlichung ist damit abgeschlossen.
Die getrennte Verkaufsfreigabe und die noch offenen Punkte aus den aktuellen
Betriebs- und Bestellablauf-Prüfberichten bleiben als nächste Arbeit bestehen.
Keine kostenpflichtige Produktion, Zahlung oder neue E-Mail durch diese Prüfung.

### Produktfreigaben übernommen (16. November 2026, 19:39 MEZ)

Nach ausdrücklichem Auftrag zum nächsten Schritt wurden 64 belegte Standard-
und 38 magnetische Modelle für alle sechs Motive technisch freigegeben.
Die 384 entsprechenden Modell-/Motivzeilen stehen jetzt auf live. Die zehn
Modelle mit unvollständiger offizieller Vorlage bleiben mit 60 deaktivierten
Zeilen gesperrt. Quellen neu heruntergeladen und unverändert; Katalogkennungen
und Bestand aktuell lesend geprüft.

Die vorher nur auf Testfreigaben beschränkte Auswahl bei geschlossenem Checkout
akzeptiert jetzt auch bereits freigegebene Varianten im getrennten Vorschaukontext.
Kauf und Übergabe behalten die strikte Test-/Live-Trennung. Änderung 0a92650 über
GitHub/Cloudflare erfolgreich veröffentlicht; Worker-Version
0e6a32ce-bf8b-493c-9912-acd530571c7c. Checkout und Podbase-Übermittlung bleiben aus.

17 gezielte Tests bestanden, ein optionaler Neon-Test übersprungen. Zusätzlich
1.836 native Beschnittprüfungen ohne Fehler, 72 abgeschlossene WASM-Stichproben
und 648 Farbgeometrievergleiche. Keine vollständige physische Musterfreigabe
aller Varianten behauptet. Öffentliche Auswahl und echte Datenbank danach
verglichen: 384 Standard-/228 Magnetkombinationen, 60 gesperrt; keine neue
Bestellung oder E-Mail. Details, Grenzen und Modellliste:
[PRODUKTFREIGABE-2026-11-16.md](PRODUKTFREIGABE-2026-11-16.md).

Damit ist der Produktfreigabeschritt erledigt. Noch offene Anbieter-Abnahme,
Betreiberfragen und Betriebsabsicherung sind getrennt vom Einschalten des Verkaufs.
Korrektur älterer Prüfpläne: Stripe-Integrationstests mit Sandbox und Testkarten
durchführen, nicht mit echten Zahlungsmitteln im Livebetrieb. Quelle:
https://docs.stripe.com/testing. Eine kostenpflichtige Testzahlung wird nicht
als Voraussetzung für den Verkaufsstart verlangt.

### Drei fehlende Modellvorlagen ergänzt (16. November 2026, 20:04 MEZ)

Der Import berücksichtigt jetzt zusätzlich ausdrücklich modellbezogene
Konturen aus der offiziellen PSD zusammen mit den Druckanforderungen der
jeweiligen Podbase-Produktseite. Damit sind iPhone 18 Pro, iPhone 18 Pro Max
und Google Pixel 10a mit Standard- und Magnet/MagSafe-Variante belegt.
Alle 102 bisherigen Vorlagensätze behalten ihren Inhalt und Hash.

Prüfung: 24 gezielte JavaScript-Tests, ein zusätzlicher Test für die exakten
Podbase-Auftragsdaten der sechs neuen Varianten, zwei Python-Zuordnungstests;
keine Fehler. Für die drei ergänzten Modelle je 108 Beschnittprüfungen und
972 Farbgeometrievergleiche mit nativer und Cloudflare-WASM-Technik bestanden.
Syntaxprüfung und Produktionsbuild erfolgreich. Keine Anbieterbestellung
ausgelöst und keine pauschale physische Musterfreigabe behauptet.

Commit 3f0efb7 liegt auf codex/cloudflare-shop. Für diesen Push erschien bis
zur Übernahme kein Cloudflare-GitHub-Check. Deshalb wurde der identische lokal
geprüfte Build mit `wrangler versions upload` und `versions deploy` veröffentlicht.
Aktive Version: dd5e6711-c586-4d88-955a-2ea8a3922c94, 100 Prozent.
Die GitHub-Build-Verbindung war zuvor nachweislich funktionsfähig; der aktuell
ausgebliebene Auslöser ist bei der nächsten Änderung erneut zu kontrollieren.

18 zusätzliche Datenbankzeilen atomar auf available=1, print_approved=1,
approval_mode=live gesetzt; vorher gesichert. Die übrigen 426 Zeilen blieben
unverändert. Öffentliche API und Datenbank bestätigen 402 Standard- und
246 Magnetkombinationen, 42 gesperrte Kombinationen. Alle 14 Laufzeit-Secrets
erhalten. Checkout und Podbase-Übermittlung weiterhin false; unverändert
acht Testbestellungen und zehn zugestellte Maildatensätze.

Separater Browsercheck auf www.archenlicht.de: alle drei Modelle auswählbar,
offizielle Druckvorschau und Magnetoption verfügbar, keine JavaScript-Fehler.
390 und 1440 Pixel ohne horizontalen Überlauf. Nachweise liegen ignoriert
unter test-results/template-completion/; kompakter Versions- und Prüfbeleg:
docs/product-template-completion-2026-11-16.json.

Noch offen: Modellkonturen für iPhone 17e, Galaxy S26 FE, Galaxy A27,
Galaxy Z Flip8 und Pixel 11/11 Pro/11 Pro XL. Der Nutzer öffnet den Podbase-
Editor, um diese modellgenauen Vorlagen zugänglich zu machen. Browseranbindung
zum bereits angemeldeten Editor ist derzeit nicht erreichbar. Diese sieben
Modelle bleiben bis zum Beleg ihrer sicheren Druckflächen gesperrt.

## Stripe-Testzahlung und Bestellmail am 16. November 2026 geprüft

Die sieben verbliebenen Modellkonturen sind auf Nutzerwunsch zurückgestellt.
Der Nutzer hat bestätigt, den bisherigen Podbase-Verbindungstest absichtlich
storniert zu haben; dessen Status REJECTED ist erklärt.

Eine eigene Stripe-Sandbox-Abnahme wurde auf dem Worker
`archenlicht-checkout-test` vorbereitet. Separates Neon-Schema und eingeschränkte
Datenbankrolle, echte Stripe-Testzahlung, Testmail nur an info@archenlicht.de,
Podbase weiterhin simuliert. Die Zahlung wurde inzwischen vom Nutzer ausgeführt:
Stripe `paid/complete`, tatsächliches Zahlungs-Webhook verarbeitet, eine
Bestellmail mit einem Versandversuch und tatsächlichem Resend-Zustellnachweis,
genau ein simulierter Druckauftrag ohne Fehler. Ergebnis `passed=true`.
Der Nutzer bestätigt zusätzlich Eingang und richtige Angaben der Mail.
Der eigene Sandbox-Webhook wurde anschließend deaktiviert, der temporäre
Test-Worker entfernt und sein Datenbestand verschlüsselt gesichert.
Details und Fortsetzung: `docs/ZAHLUNGSABNAHME-2026-11-16.md`.
Die Produktionsschalter und der öffentliche Live-Worker wurden nicht geändert.

Im Anschluss frische verschlüsselte Sicherung der Produktionsdatenbank erstellt:
`shop-2026-11-16T19-40-06-818Z.albackup`, 23.143.704 Bytes. Wiederherstellung
aller 32 Tabellen und 1501 Datensätze in einem neuen temporären Schema bestanden;
Prüfschema entfernt, Produktionsschema unverändert. Datei und Prüfbericht liegen
unter `.tools/migration-backups/2026-11-16/` im ursprünglichen Projektordner.
Der Schlüssel bleibt in `.tools/migration-backup-key.txt`.
Eine externe Kopie und regelmäßige automatische Sicherungen sind weiterhin
nicht nachgewiesen. Der Nutzer wurde nach vorhandenem Cloudspeicher oder einem
externen Datenträger gefragt. Diese Antwort steht noch aus.
