# Hosting auf Vercel

Der aktuelle GitHub-Stand ist der vollständige lokale Node.js-24-Testshop. Ein Import dieses Repositories in Vercel allein stellt noch keinen funktionsfähigen Shop bereit.

Der Server schreibt Konten, Sitzungen, Warenkörbe und Bestellungen in eine lokale SQLite-Datei unter `data/test`, legt dort unveränderliche Druckdateien ab und verarbeitet die Fulfillment-Warteschlange über einen dauerhaften Timer. Diese Dateien sind absichtlich nicht im Repository enthalten. Vercel Functions stellen keinen gemeinsamen dauerhaft beschreibbaren lokalen Datenträger für SQLite bereit. Siehe [Vercels Erklärung zu SQLite](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

Vor einem Vercel-Deployment müssen die HTTP-Einstiegspunkte für das Zielhosting eingerichtet, Daten und Sitzungen in einen dauerhaften externen Datenspeicher verlagert, Druckdateien in dauerhaftem Objektspeicher abgelegt und die Hintergrundverarbeitung als dauerhafte Jobs ausgeführt werden. Der vorhandene Schutz vor doppelten Zahlungen und Druckaufträgen muss dabei erhalten bleiben.

Nur `public/` als statische Website auszuliefern genügt ebenfalls nicht: Die Oberfläche benötigt `/api/bootstrap`, Vorschau-, Warenkorb-, Konto- und Zahlungsrouten aus `server/index.js`.

Alternativ kann der bestehende Node-Server auf einem Hosting mit dauerhaftem Datenträger und Hintergrundprozess laufen; für eine Trennung von Frontend und Backend wären Routing und Betriebskonfiguration entsprechend einzurichten. Eine solche Umstellung wurde beim GitHub-Upload noch nicht vorgenommen.

Zugangsdaten gehören in die serverseitige Umgebungsverwaltung des späteren Hostings, nicht nach GitHub. `.env.example` ist die leere Konfigurationsvorlage. Lokale Konten, Testbestellungen, Adminzugang und Backups bleiben auf Jonas’ Rechner. Zahlungen, Podbase und Mail laufen weiterhin ausschließlich im dokumentierten Testbetrieb.
