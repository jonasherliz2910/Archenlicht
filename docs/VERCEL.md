# Hosting auf Vercel

Der Shop unterstützt zwei Betriebsarten mit derselben Geschäftslogik: lokal Node.js 24 mit SQLite und auf Vercel eine Node.js-24-Function mit Neon PostgreSQL. Zahlungen, Podbase und E-Mails bleiben simuliert. Die Hosting-Anpassung ist keine Freigabe für echte Verkäufe.

## Projekt und Routing

Ziel ist `jonas-4eb6/archenlicht`, Repository `jonasherliz2910/Archenlicht`, öffentliche Adresse `https://archenlicht.vercel.app`. Das Framework bleibt „Other“. `api/shop.js` ist der native HTTP-Einstieg; `vercel.json` leitet API-, Druckdatei- und Shoprouten dorthin. Die Funktion läuft in Frankfurt. Node 24 wird über `package.json` festgelegt. Vercel installiert die Abhängigkeiten einschließlich `sharp` aus der Lockdatei.

Das frühere Deployment lieferte nur statische Dateien aus: `/` war erreichbar, aber `/api/bootstrap`, `/api/health` und `/kollektion` antworteten mit 404. Deshalb versuchte der Browser, Vercels Textfehler als JSON zu lesen. Die API wird nun als Function bereitgestellt. Zusätzlich verarbeitet die Oberfläche nicht-JSON-Antworten verständlich und bietet bei einem fehlgeschlagenen Start eine funktionierende vollständige Neuladung an.

## Dauerhafte Daten

Die eingebundene Neon-Datenbank `archenlicht-testdb` wurde im Tarif **Free**, Region Frankfurt, angelegt. Konten, Sitzungen, Warenkörbe, Bestellungen, Zahlungsereignisse, Mail-Outbox und Queue liegen dort. PostgreSQL-Transaktionen verwenden pro Transaktion eine eigene Verbindung, die abschließend geschlossen wird. Kritische Zustandsübergänge sind durch Transaktionen und einen gemeinsamen Advisory Lock geschützt; Claims und eindeutige Schlüssel verhindern doppelte Verarbeitung.

Cloud-Druckdateien liegen ebenfalls dauerhaft in PostgreSQL: Originalmotive werden anhand ihrer Prüfsumme einmalig gespeichert. Unveränderliche SVG-Snapshots referenzieren diese Kopie intern; bei der Auslieferung wird die Originaldatei wieder eingebettet. Gerasterte PNGs werden unveränderlich zum Inhalts-Hash abgelegt. Spätere Änderungen an Motiven, Schrift oder Layout verändern bereits gespeicherte Druckdateien nicht. Für einen größeren Livekatalog sind Speicherbedarf und Tarif gesondert zu planen.

`DATABASE_SCHEMA` trennt den öffentlichen Testshop (`public`), Vorschauen (`archenlicht_preview`) und Cloud-Entwicklung (`archenlicht_development`). Lokale SQLite-Daten werden nicht hochgeladen oder automatisch migriert. Der lokale Start verwendet weiterhin `data/test/shop.sqlite`; `.env.local` wird vom lokalen Startskript nicht automatisch geladen. [Warum SQLite-Dateien nicht als dauerhafter Vercel-Speicher dienen](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

## Serverkonfiguration

Die Neon-Integration stellt `DATABASE_URL` bereit. In Vercels serverseitiger Umgebungsverwaltung sind zusätzlich gesetzt:

| Variable | Einstellung |
|---|---|
| `STORAGE_MODE` | `postgres` |
| `SHOP_MODE` | `test` |
| `PAYMENT_MODE`, `PODBASE_MODE`, `MAIL_MODE` | `local` |
| `BASE_URL` | `https://archenlicht.vercel.app` |
| `DATABASE_SCHEMA` | je Umgebung wie oben; ohne Angabe `public` |
| `ADMIN_EMAIL` | eigenes Test-Adminkonto |
| `ADMIN_PASSWORD`, `CRON_SECRET` | zufällige Geheimnisse; keine öffentlichen Werte |

Der private Cloud-Adminzugang liegt ausschließlich auf Jonas’ Rechner in `data/test/cloud-admin-access.txt`. `.env*`, `.vercel`, `.tools`, lokale Daten und Testausgaben sind vom Git-Upload und vom Deployment ausgeschlossen. Geheimnisse werden weder in Browsercode eingebaut noch in Prüfberichten ausgegeben.

## Testjobs

Es gibt keinen dauerhaft laufenden Timer in der Function. Nach Zahlungsbestätigung und beim autorisierten Abruf einer Bestellung wird die dauerhafte Testqueue abgearbeitet. Zusätzlich ruft ein täglicher Vercel Cron Job `/api/jobs` auf; der Endpunkt verlangt `Authorization: Bearer <CRON_SECRET>`. Der tägliche Zeitplan passt zum Hobby-Tarif. Bei offener Bestellansicht aktualisiert deren bestehende Statusabfrage den simulierten Versand zeitnah; ohne Seitenaufrufe erfolgt der nächste Abgleich erst durch einen späteren Aufruf oder den täglichen Job.

Die Situationsbeschreibung der Beratung bleibt flüchtig im Browser beziehungsweise im Speicher einer Function-Instanz. Sie wird nicht in die Datenbank oder in Logs geschrieben und kann nach einem Instanzwechsel serverseitig nicht wiederhergestellt werden. Der verteilte Anmeldeschutz, E-Mail-Verifikation, Passwortwiederherstellung, echte Stripe-Zahlungen und Podbase-Produktionsfreigaben bleiben Live-Voraussetzungen.

## Prüfen und veröffentlichen

Vor einer Veröffentlichung Team, Projekt und Umgebung prüfen. Zuerst eine Vorschau erstellen und über `vercel curl` mit dem vorhandenen Vercel-Zugang prüfen; Deployment Protection bleibt aktiv. Anschließend den geprüften Code nach `main` pushen und das daraus entstandene Production-Deployment sowie die öffentliche Domain kontrollieren. [Prüfnachweise und Grenzen](TESTPROTOKOLL.md).

Die normale Suite prüft die lokale Datenhaltung und den nativen Function-Einstieg. Der zusätzliche Neon-Test wird nur ausdrücklich mit `RUN_POSTGRES_TESTS=1` und geschützter `DATABASE_URL` ausgeführt. Er verwendet ein zufälliges eigenes Schema und entfernt ausschließlich dieses Schema nach dem Test. Nie das öffentliche Schema für automatische Kaufprüfungen verwenden.
