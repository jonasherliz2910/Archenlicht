# Automatische Shop-E-Mails · 8. November 2026

## Aktueller Stand: Adapter vorbereitet, Versand noch ausgeschaltet

Jonas hat die frühere Resend-Testmail aus Spam in den Posteingang verschoben.
Das wurde am 8. November über die Hostinger-Ordnerliste bestätigt: passende
Nachricht in `INBOX`, `INBOX.Junk` leer. Die Suche bildete den Umzug noch nicht
ab; deshalb wurde die direkte Nachrichtenliste zum Nachweis verwendet.
Dies bestätigt den manuellen Umzug, keine verbesserte Zustellung neuer Mails.

Bestätigter Absender und Antwortadresse: **Archenlicht <info@archenlicht.de>**.
Betreiber: **Herzly Marketing GbR**, vertreten durch **Julian Isaak und Laura
Herliz**, Stettiner Straße 27, 36251 Bad Hersfeld. Jonas bestätigt die
Kleinunternehmerregelung ausdrücklich auch für diese GbR.

`server/mail-templates.js` enthält HTML und Klartext für Bestellbestätigung,
simulierte Versandmeldung und Fulfillment-Fehler. Positionen, Gerät, Farbe,
Drucktext, Gesamtpreis, Steuerhinweis und Lieferdaten stammen aus dem
Bestellsnapshot. Alle Vorlagen sind ausdrücklich als Test gekennzeichnet.

`server/mail.js` verarbeitet eine dauerhafte Warteschlange:

- Keine Bestätigung vor bestätigter Zahlung; Versand erst nach dem Anbieterstatus.
- Neue Tabellen `mail_deliveries`, `mail_events`, `mail_suppressions` ergänzen SQLite und Neon; bestehende Bestellungen und Outboxeinträge werden nicht umgeschrieben.
- Registrierung nur bei `MAIL_MODE=resend-test`, bei passenden ausdrücklich festgelegten Empfängern und für Bestellungen ab `MAIL_ENABLED_SINCE`. Kundendaten fremder Empfänger werden nicht in das Testpostfach umgeleitet.
- Zahlung wird vor dem HTTP-Versand festgeschrieben. Ein Mailausfall setzt keine bezahlte Bestellung zurück.
- Gleichbleibender Resend-Idempotency-Key und eingefrorener Inhalt; atomare Sperre gegen parallele Worker. Unklarer Status nach 23 Stunden oder sechs Versuchen wird zur manuellen Prüfung gehalten, nicht blind erneut gesendet.
- Versand wird direkt nach Zahlung und beim bestehenden Worker versucht. Automatische spätere Wiederholungen hängen weiterhin am täglichen Cron bzw. Statusabruf. Für Livebetrieb fehlt ein häufiger, verlässlicher Hintergrundlauf.
- `POST /api/webhooks/resend` prüft den unveränderten Body mit dem offiziellen Resend-SDK. Doppelte und verspätete Ereignisse sowie Zustellereignisse vor der Versandantwort werden abgeglichen. Rückläufer/Beschwerden sperren weitere Sendungen an diese Adresse.
- Geschützter Nachweis unter `GET /api/admin/mail-status`; keine Nachrichteninhalte oder Geheimnisse in Diagnoseprotokollen.

**Noch nicht aktiviert:** In Vercel bleibt `MAIL_MODE=local`. Die Implementierung
führt deshalb keine echten Bestellmails aus. Es wurde in diesem Schritt keine
weitere Testmail gesendet. Es fehlen noch der Resend-Webhook, dessen
Signing-Secret und die anschließende gemeinsame Freigabe des begrenzten Tests.

### Nächster geführter Einrichtungsschritt

In Resend unter Webhooks einen Endpunkt anlegen:

`https://www.archenlicht.de/api/webhooks/resend`

Ereignisse: `email.sent`, `email.delivered`, `email.delivery_delayed`,
`email.failed`, `email.bounced`, `email.complained`, `email.suppressed`.
Das Signing-Secret anschließend ausschließlich geschützt als
`RESEND_WEBHOOK_SECRET` hinterlegen, nicht im Chat oder Git.
Der vorhandene eingeschränkte Sendeschlüssel kann keine Webhooks verwalten;
deshalb erfolgt dieser Schritt im Resend-Dashboard.

Vor Aktivierung gemeinsam prüfen:

- `RESEND_API_KEY` und `RESEND_WEBHOOK_SECRET` als serverseitige Secrets.
- `MAIL_TEST_RECIPIENTS=info@archenlicht.de`, `MAIL_PUBLIC_URL=https://www.archenlicht.de` und frische ISO-Startzeit in `MAIL_ENABLED_SINCE`.
- Erst dann `MAIL_MODE=resend-test`; ein neuer Sandboxkauf mit dieser Empfängeradresse prüft die echte Versandkette. Keine Altbestellungen nachversenden.
- Resend-Zustellereignis bedeutet Annahme beim Empfängerserver, nicht garantiert Posteingang; tatsächlichen Ordner zusätzlich prüfen.

Sieben Mailtests prüfen Zahlungsfreigabe, Replay, Empfänger-/Altbestellungsschutz,
unklare Antworten, Parallelität/Neustart, signierte Zustellereignisse und Vorlagen.
Mobile/Desktop-Vorschauen liegen ignoriert in `test-results/mail-previews`.

## Historische Prüfung vom 7. November 2026

### Direkter Resend-Testversand

Jonas hat Resend eingerichtet, die Domain verifiziert und einen Schlüssel in der lokalen Datei `resend` hinterlegt. Die Datei ist in `.gitignore` und `.vercelignore` ausgeschlossen.

Der Schlüssel besitzt eingeschränkte Versandberechtigungen. `GET /domains` antwortet mit HTTP 401 und `restricted_api_key`; das ist eine Berechtigungsgrenze der Domainverwaltung, kein Nachweis eines ungültigen Versandschlüssels. Zusätzliche Verwaltungsrechte wurden nicht angefordert.

Nach Jonas' ausdrücklicher Freigabe wurde **genau eine echte Testmail** mit einem Idempotency-Key über `POST /emails` gesendet: Absender `Archenlicht <info@archenlicht.de>`, Empfänger `info@archenlicht.de`, Betreff „Archenlicht – Test des E-Mail-Versands“. Resend bestätigte die Annahme mit HTTP 200 und einer Nachrichten-ID. Die Mail enthält nur den angekündigten Testtext, keine Bestell- oder Kundendaten. Bei erneuter Ausführung verhindert die lokale Nachweisdatei einen zweiten Versand.

Die Ankunft wurde anschließend unabhängig über den Hostinger-Mail-Zugang geprüft. **Die Nachricht liegt in `INBOX.Junk`**, nicht im regulären Posteingang. Ihre tatsächlichen Empfangsheader bestätigen:

- SPF: `pass`, Return-Path unter `rsend.archenlicht.de`.
- DKIM: `pass`, signierende Domain `archenlicht.de`, Selektor `resend`.
- DMARC: `pass`, Absenderdomain `archenlicht.de`.
- Spamkennzeichnung: `X-Spam: Yes`. Die verfügbaren Header nennen keinen nachvollziehbaren konkreten Filtergrund.

Damit sind der Schlüssel, der Versand mit der eigenen Domain und die Annahme im Hostinger-Postfach praktisch bestätigt. Die Spam-Einsortierung bleibt ein offener Befund; daraus lässt sich keine allgemeine Posteingangszustellung bei Gmail, Outlook oder anderen Kundenpostfächern ableiten. DNS-Authentifizierung allein garantiert diese nicht. Laut Hostinger trainiert das Verschieben aus Spam die Erkennung für das jeweilige Postfach; das ist keine globale Lösung für alle Empfänger. [Hostinger: Spamfilter und Lernen pro Postfach](https://www.hostinger.com/support/5240863-what-happens-to-emails-in-the-spam-folder/).

Die Prüfung änderte weder DNS noch Filterregeln und verschob die Nachricht nicht. Der automatisierte Shopversand ist weiterhin nicht angeschlossen: `MAIL_MODE=local`, vorhandene Bestell- und Versandmails bleiben simuliert. Ein erfolgreicher direkter Resend-Test ersetzt keinen Test der späteren Bestellautomatik.

### Historisch: Prüfung des Hostinger-Zugangs

Der in der lokalen Datei `Mail` hinterlegte Schlüssel wird von der offiziellen Hostinger-Mail-API akzeptiert (`GET /api/v1/me`, HTTP 200). Er erschließt genau das gewünschte Postfach **info@archenlicht.de**. Auch die Quota-Abfrage antwortet mit HTTP 200. Diese Prüfung bestätigt Authentifizierung und Postfachzugang; eine Sendung oder Zustellung wurde nicht getestet.

Die separat verbundene Hostinger-App erschließt ein anderes Postfach. Für die Prüfung von Archenlicht wurde deshalb der bereitgestellte lokale Schlüssel direkt gegen `https://api.mail.hostinger.com` verwendet. Keine Nachrichteninhalte wurden gelesen, keine Nachrichten versandt und keine DNS-Einstellungen geändert.

Öffentliches DNS: MX zeigt auf Hostinger; SPF enthält `_spf.mail.hostinger.com`; alle drei Standard-DKIM-CNAMEs (`hostingermail-a`, `-b`, `-c`) zeigen auf die entsprechenden Hostinger-Ziele. DMARC ist mit `p=none` vorhanden. Vorhandene DNS-Einträge ersetzen keinen realen Zustelltest und belegen noch keine tatsächlich signierte Ausgangsmail.

`Mail` ist jetzt in `.gitignore` und `.vercelignore` ausgeschlossen. Schlüssel oder Postfachinhalte gehören nicht in Git, Browsercode oder Diagnoseberichte.

### Historisch: Anbieterwahl

**Hostinger Agentic Mail ist technisch geeignet; Resend ist keine zwingende Voraussetzung.** Hostinger nennt Transaktionsmails ausdrücklich als Anwendungsfall. Die geprüfte OpenAPI 1.3.0 dokumentiert HTML, Klartext, Anhänge und Versand aus dem eigenen Postfach mit einer Kopie in `INBOX.Sent`.

Für den Shop wird dennoch **Resend als Versanddienst bei fortbestehendem Hostinger-Postfach** empfohlen: Resend dokumentiert Idempotency-Keys mit 24 Stunden Gültigkeit sowie Ereignisse für Zustellung, Rückläufer und Beschwerden. Die geprüfte Hostinger-Spezifikation dokumentiert beim Versand HTTP 204 ohne Nachrichten-ID, keinen Idempotency-Key und ausschließlich `message.received` als Webhook-Ereignis. Eine unterbrochene Versandantwort lässt sich dadurch schwerer sicher wiederholen. Das ist eine Bewertung der dokumentierten Funktionen, keine Behauptung, dass Hostinger grundsätzlich unzuverlässig zustellt.

Mit Hostinger wäre eine eigene dauerhafte Versandwarteschlange nötig, die unklare Versandversuche zunächst zurückhält und abgleicht. Mit Resend bleibt eine solche Warteschlange ebenfalls sinnvoll; der Anbieterschlüssel erleichtert sichere Wiederholungen innerhalb seines Zeitfensters. In beiden Fällen sind API-Annahme, tatsächliche Zustellung und Anzeige im Posteingang unterschiedliche Zustände.

Die konkrete Hostinger-Tagesversandgrenze ließ sich mit dem Quota-Endpunkt nicht ermitteln; dieser liefert Speicher- und Nachrichtenbestand. Allgemeine Tarifgrenzen sind kein Nachweis des individuellen Vertrags.

### Historisch: damaliger Shop und Umsetzungsplan

Der Shop speichert bereits Bestellbestätigungen, Versandmeldungen und Adminhinweise bei Fulfillmentproblemen in `mail_outbox`. Eine eindeutige Kombination aus Bestellung und Nachrichtenart verhindert doppelte Einträge. Bestellbestätigungen bleiben bis zur unabhängig bestätigten Zahlung auf `pending-payment`. Danach wird bisher nur `local-delivered` gesetzt. `MAIL_MODE=local` bedeutet weiterhin **kein echter Versand**.

Für die tatsächliche Anbindung sind folgende Änderungen vorgesehen:

1. Absender `Archenlicht <info@archenlicht.de>`, Antworten an das vorhandene Postfach; gestaltete HTML- und Klartextvorlagen mit Bestellpositionen, Betrag, Kleinunternehmerhinweis und geschütztem Statuslink.
2. Versandauftrag erst nach bestätigter Stripe-Zahlung; Versandmeldung erst bei bestätigtem Anbietertracking. Im gegenwärtigen Testbetrieb muss simuliertes Tracking ausdrücklich als Test bezeichnet bleiben.
3. Dauerhafte Versandzustände mit Sperre gegen parallele Worker, begrenzten Wiederholungen, sicherem Umgang mit unklarem Status und Nachweis der Anbieterannahme. Zahlungs-Webhooks dürfen bei Mailproblemen keine bereits bestätigte Zahlung zurücknehmen.
4. Zeitnahe Verarbeitung im Vercel-Betrieb auch ohne geöffnetes Browserfenster. Der derzeitige tägliche Cron und die Statusseiten-Aufrufe allein reichen als allgemeine Wiederholungsstrategie für zeitkritische Mails nicht aus.
5. Vorhandene simulierte Altbestellungen nicht nachträglich verschicken. Testmails zunächst nur an ausdrücklich festgelegte Testempfänger; anschließend Zustellung und Rückläufer prüfen.

Es wurde noch kein Anbieterwechsel und keine Versandaktivierung vorgenommen. Bei Wahl von Resend sind ein Zugang und die Freigabe der Absenderdomain erforderlich. Der Hostinger-Empfang kann bestehen bleiben; eine vollständige Postfachmigration ist für einen separaten Versanddienst nicht erforderlich.

## Quellen

- [Hostinger Agentic Mail und Transaktionsmails](https://www.hostinger.com/support/how-to-use-agentic-mail-in-hostinger/)
- [Hostinger Mail API](https://docs.hostinger.com/emails/mail-api)
- [Geprüfte Hostinger-OpenAPI](https://api.mail.hostinger.com/openapi/openapi.json)
- [Hostinger-Tarifgrenzen](https://www.hostinger.com/support/4625828-parameters-and-limits-of-hostinger-email/)
- [Resend: Idempotency-Keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Resend: Webhook-Ereignisse](https://resend.com/docs/webhooks/event-types)
