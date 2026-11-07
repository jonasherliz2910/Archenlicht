# Technische Übergabe

## Aufbau

| Datei | Aufgabe |
|---|---|
| `server/catalog.js` | Zentraler Markenname, Preise, Motive, Modell-Testkatalog, quellenbelegte Versauszüge |
| `server/design-assets.js`, `server/design-package.json` | Gelieferte Blankomotive, Prüfsummen und normierte Textflächen |
| `server/artwork.js` | Alte SVG-Skizzen; vom aktuellen Renderer nicht mehr verwendet |
| `server/layout.js` | Validierung, versioniertes Layout, Schriftpfade, Inhalts-Hash und PNG-Erzeugung |
| `server/store.js` | SQLite-Schema, Transaktionen, Passworthashes, lokales Adminkonto |
| `server/async-store.js`, `server/schema.js` | Gemeinsame asynchrone Schnittstelle, lokale Serialisierung und dauerhafter Neon-PostgreSQL-Speicher |
| `api/shop.js`, `vercel.json` | Vercel-HTTP-Einstieg, Routing und geschützter täglicher Testjob |
| `server/shop.js` | Warenkorb, Konten, Bestellungen, Beratung, Fulfillment, Mail-Outbox und Kennzahlen |
| `server/payments.js` | Lokaler Testadapter und Stripe Checkout für Karte und PayPal |
| `server/podbase.js` | Lokaler Podbase-Testadapter sowie gesperrter API-Client nach offizieller Spezifikation |
| `server/index.js` | HTTP-Routen, CSRF, Sicherheitsheader, Dateien und Statusworker |
| `public/` | Browseroberfläche, lokale Fonts, Geschenkkarte und Social-Profil |
| `scripts/` | Prüfen, Demodaten und reproduzierbare Markenassets |
| `tests/` | HTTP-Integration, Zahlungsfixtures, Sicherheits- und Wiederaufnahmetests |

Keine Händler- oder Zahlungsgeheimnisse gelangen in Browsercode. Der Server liefert ausschließlich `public/` und gezielt generierte Druckdateien aus. SQLite-Dateien, `.env`, Serverquellen und Adminzugang sind darüber nicht erreichbar.

## Daten und Sitzungen

`data/test/shop.sqlite` nutzt WAL, Foreign Keys und `BEGIN IMMEDIATE` für kritische Übergänge. Bestellungen enthalten feste Snapshots der Positionen und Drucktexte. Änderungen am späteren Projektkatalog verändern bereits bestellte Druckdateien nicht.

Auf Vercel ersetzt Neon PostgreSQL die lokale Datei. Kritische Transaktionen verwenden eine eigene Verbindung und einen gemeinsamen Advisory Lock. Sitzungen, Bestellungen und unveränderliche Druckdateien liegen dauerhaft in der Datenbank. Vorschau und öffentlicher Testshop nutzen getrennte Schemata. Es werden keine bestehenden lokalen Kundendaten automatisch übertragen. [Betrieb, Cloud-Druckspeicher und Testjobs](VERCEL.md).

Die technisch notwendige Sitzung hat ein zufälliges 256-Bit-Token im HttpOnly-/SameSite-Lax-Cookie; die Datenbank speichert dessen Hash. Standardlaufzeit: zwei Stunden. HTTPS aktiviert zusätzlich `Secure`. Anmeldung rotiert Cookie und CSRF-Token. Passwörter: scrypt, individueller Salt und konstanter Hashvergleich. Kein Konto wird anhand einer ungeprüften Übereinstimmung der Gast-E-Mail nachträglich mit Bestellungen verknüpft.

Gastlinks tragen ein separates 256-Bit-Zugriffstoken im URL-Fragment. Es geht dadurch nicht als URL zum Server. Der Client entfernt das Fragment und sendet das Token im Authorization-Header. Der Server prüft den Hash und hinterlegt einen ausschließlich auf diese Bestellung begrenzten Sitzungszugang. Damit funktioniert auch anschließendes Neuladen ohne erneuten Token in der Adresszeile. Abmeldung oder Sitzungsablauf löschen diesen Zugang. Jeder, der den persönlichen E-Mail-Link besitzt, kann die betreffende Bestellung sehen; deshalb vertraulich behandeln. `Referrer-Policy: no-referrer` verhindert Refererweitergabe.

Adminansichten prüfen die serverseitige Rolle. Kunden erhalten ausschließlich Bestellungen mit ihrer eigenen Konto-ID. Zustandsänderungen benötigen JSON, CSRF-Token und bei Browseranfragen eine erlaubte Origin. Anmeldeversuche werden sitzungsbezogen begrenzt. Vor öffentlichem Betrieb sind ein verteilter Missbrauchsschutz, E-Mail-Verifikation, Kontowiederherstellung und ein Lösch-/Auskunftsverfahren zu ergänzen.

## Situationsbeschreibung

Sie liegt ausschließlich in einer flüchtigen Map der laufenden Serverinstanz und im Arbeitsspeicher der geöffneten Oberfläche. Kein LocalStorage, SessionStorage, Cookieinhalt, Datenbankfeld, Analyseevent oder Bestellsnapshot enthält sie. Die API verwendet POST; die Beschreibung wird nicht in URLs, Fehlern oder Logs ausgegeben. Der Worker räumt abgelaufene Sitzungen auf. Abmeldung, Ablauf und Serverneustart verwerfen den Text. Ein Clienttimer leert auch das sichtbare Textfeld und die Sitzungsauswahl bei Ablauf.

Der Testberater ist ausdrücklich **regelbasiert, keine externe KI**. Er liefert nur IDs vorhandener Verse; Zitat, Quelle und Erklärung kommen aus dem lokalen geprüften Bestand. Unbekannte Themen werden nicht als vermeintlich passende Antwort ausgegeben. Eine zukünftige KI darf nur IDs/Erklärungen liefern; Zitattext muss weiterhin aus dem freigegebenen Bestand kommen. Anbieter, Auftragsverarbeitung, Speicherpraxis, Löschung und Produktlizenz müssen vor dieser Erweiterung geprüft sein.

## Gestaltung und Druck

`archenlicht-package-layout-v4-farbe` integriert die sechs unveränderten farbigen PNG-Blankomotive aus dem v2-Paket. Dimensionen und Textflächen werden je Originalbild aus dem neuen Manifest übernommen. Das Bild wird proportional vollständig in die Testfläche eingepasst; zusätzliche leere Fläche setzt den Papierhintergrund fort. Neue Textboxen samt Bildversatz werden gemeinsam skaliert. Vergrößerte Texte erhalten Abstand zu den Dekorzweigen. Kein Motivname, Logo oder alter fester Vers wird in eine Personalisierung übernommen. Hüllenansichten und Kamera-Overlay richten sich nach den tatsächlichen Modellabmessungen; SVG und PNG behalten dieselben Maße. [Integration und Prüfgrenzen](DESIGNPAKET.md).

Es gibt keine freigegebenen echten Podbase-Schablonen. Modellvorlagen und Freigaben bleiben simuliert; `productionApproved` bleibt ausdrücklich `false`. Die 962 × 1.634/1.635 px großen Ausgangsbilder sind keine hochauflösenden Produktionsmaster. Die 300-dpi-Metadaten des Exports ändern daran nichts.

Schrift wird serverseitig mit den mitgelieferten Fonts in SVG-Pfade umgerechnet. Der Browser zeigt genau dieses SVG; `sharp` rastert dasselbe SVG zu PNG. Der SHA-256-Hash umfasst normalisierte Konfiguration und vollständiges SVG. URL: `/prints/<hash>.png`. Die Assets bleiben unverändert und erhalten immutable Cacheheader. Die PNGs messen im Testsatz 1.200 × 2.400 Pixel mit 300-dpi-Metadaten. Das ist eine **Testfläche**, keine Fertigungsfreigabe. Vorschauen zeigen einen Kamera-Overlay; das Drucklayout hält die simulierte Kamerazone sowie Ränder frei.

Widmungen sind auf 32 Zeichen und eine Zeile begrenzt; Versstellen erhalten eine Zeile, Originalauszüge höchstens drei. Der Renderer misst die tatsächlichen Caveat-Glyphen, zentriert ihre sichtbaren Grenzen und verkleinert nur bis zur im Paket definierten Mindestgröße. Überlauf und fehlende Glyphen blockieren den Warenkorbzugang mit einer Korrekturaufforderung. Es gibt kein Abschneiden, Umformulieren oder stilles Font-Fallback. Fremde `quote`-/`printText`-Eingaben werden abgewiesen. `Bearbeiten` aktualisiert die bestehende Positions-ID.

Konfigurationen speichern Motivschlüssel, Layout- und Modellversion, Bild- und Schriftprüfsumme, Versstelle, exakten Originalauszug und Widmung strukturiert. Das gespeicherte SVG bettet die Original-PNG ein und enthält Text als Pfade; spätere Änderungen an Schrift, Layout oder Katalog verändern vorhandene Bestelldateien nicht.

Die Geschenkkarte liegt als einseitiger 10 × 15-cm-Entwurf vor. In Podbase wird sie einmalig für das Händlerkonto aktiviert. Deshalb wird kein erfundenes Beilagenfeld in den API-Auftrag gesendet. Die Hüllendateien enthalten keine Marke. Wortmarke und Boot befinden sich im Shop, auf der Karte und im Social-Profil.

Das nachgereichte `Archenlicht-CI-Book.pdf` legt `Logoentwürfe/Archenlicht-02.png` als Original fest. Die öffentliche Logodatei ist bytegleich, unverändert und im Verhältnis 2:1 eingebunden. Es gibt keine nachgezeichnete Ersatzwortmarke. Desktop: 176 px, mobil: 144 px; im Kartenentwurf 42 mm. Karte und Social-Profil enthalten die Original-PNG als eingebettetes Bild. Für einen anderen Markennamen sind `BRAND.name`, freigegebene Masterdatei und anschließend die Markenassets gemeinsam zu aktualisieren. Farbwerte stehen in `BRAND.colors` und den CSS-Variablen. Die Schriftauswahl ist eine lizenzierte Umsetzung der im CI-Book vorgeschlagenen Hierarchie, keine Nachahmung der Logo-Handschrift.

## Zahlungsfluss: Stripe für beide Methoden

### Freiwillig gespeicherte Kundendaten (Erweiterung 4. November 2026)

Zusätzliche Tabellen werden beim Start additiv angelegt; bestehende Nutzer und Bestellungen bleiben erhalten:

- `account_profiles`: eine freiwillige Lieferadresse je Konto sowie eine Versionsnummer. `checkout_preferences` hält den ausdrücklich gewählten Speicherwunsch und die Ausgangsversion zur Bestellung fest. Die Adresse wird in der Zahlungstransaktion nach Bestätigung übernommen. Änderungen oder Löschung im Konto erhöhen die Version, damit verspätete Zahlungen keine bereits widerrufene Adresse wiederherstellen.
- `payment_customers`: serverseitige Konto-ID → Anbieter-Customer-ID, getrennt nach `local` und `stripe_test`. Keine Zuordnung anhand der Liefer-E-Mail und keine Übernahme von Customer-IDs aus Clientdaten. Customer-Erstellung mit stabilem Stripe-Idempotency-Key.
- `local_payment_methods`: ausschließlich fiktive Demo-Karten mit Marke, letzten vier Ziffern und Ablaufdatum. Anlage nur nach ausdrücklicher Auswahl bei einer erfolgreichen lokalen Kartentestzahlung des eigenen Kontos. Doppelte Zahlungsereignisse können eine entfernte Karte nicht wiederherstellen.

Neue eigene Kontorouten: `GET/PUT/DELETE /api/account/address`, `GET /api/account/payment-methods`, `DELETE /api/account/payment-methods/:id`. Sie verlangen Anmeldung und bei Änderungen CSRF. Eine fremde Nutzer-ID kann nicht als Ziel übergeben werden. Das Bootstrap liefert ausschließlich die Adresse des aktuell angemeldeten Kontos; bei Gästen `account: null`.

Beim gehosteten Stripe-Checkout für angemeldete Kunden werden `customer` und `saved_payment_method_options[payment_method_save]=enabled` gesetzt. Die freiwillige Auswahl findet in Stripe statt; `allow_redisplay=always` stammt aus dieser Zustimmung. Die Wiederanzeige ist auf `always` begrenzt. Kein automatisches `setup_future_usage`, keine spätere unbeaufsichtigte Belastung durch den Shop. Karte und PayPal bleiben reguläre bestätigungspflichtige Käufe.

Karten im Konto werden direkt bei Stripe abgefragt und auf diesen Customer, Testmodus, Kartentyp und erteilte Wiederanzeigefreigabe gefiltert. Zum Entfernen wird die Eigentümerschaft erneut per Stripe-API geprüft, bevor `detach` aufgerufen wird. Nur sichere Anzeigemetadaten gelangen in die Antwort. Kartennummern und Prüfnummern werden weder abgefragt noch gespeichert. Zahlungen mit zugeordnetem Customer müssen zusätzlich beim unabhängigen Statusabgleich exakt diese Customer-ID zurückgeben.

1. Der Server prüft Warenkorb, gespeicherte Druckfreigabe je Modell/Motiv und aktuellen Adapterkatalog. Weggefallene Varianten blockieren die Zahlung.
2. Eine Bestellung samt Snapshot wird vor Zahlung gespeichert. Preise und Mengen kommen aus serverseitigen Daten.
3. Im lokalen Modus folgt ein klar gekennzeichneter Simulator ohne echte Zahlungsdaten. Im Stripe-Testmodus entsteht eine gehostete Checkout Session mit den im Stripe-Dashboard verfügbaren dynamischen Zahlungsarten und bestellbezogenem Idempotency-Key.
4. Ein Stripe-Webhook benötigt eine HMAC-Signatur auf dem unveränderten Body und einen Zeitstempel innerhalb von fünf Minuten. Nur Testereignisse werden akzeptiert.
5. Zusätzlich wird die Checkout Session über die Stripe-API unabhängig geladen. Erst `paid` + `complete` + `livemode=false` mit exakt passender Checkout-ID, Bestellreferenz, EUR und Gesamtbetrag darf `acceptPayment` aufrufen.
6. Event-ID und Bestell-ID sichern gegen erneute Verarbeitung. Zahlungsmarkierung und Queueeintrag entstehen gemeinsam in einer Transaktion. Die Erfolgsseite kann ohne bestätigte Zahlung keinen Auftrag anlegen.

PayPal wird später **über Stripe** abgewickelt; keine direkte PayPal-API, keine separaten PayPal-API-Schlüssel und kein zweiter Zahlungswebhook. Testzugänge und Webhook sind eingerichtet; Karte und Link sind im Testkonto verfügbar, PayPal noch nicht. Das SDK ist auf Version 23.1.0 und die API auf 2026-10-28.endive festgelegt. Die bestätigte Kleinunternehmerregelung deaktiviert automatische Steuererhebung ausdrücklich; ein Steuerbetrag ungleich null sperrt die Zahlungsübernahme. `stripe_payments` dokumentiert den bestätigten Zahlungsbeleg dauerhaft. [Stripe-Plan und Prüfnachweise](STRIPE.md). Live-Schlüssel bleiben gesperrt.

## Fulfillment und Neustarts

Die Queue besitzt einen eindeutigen Eintrag je Shopbestellung. Ein Worker beansprucht ihn atomar und markiert die erste Übermittlung bereits vor Netzwerkarbeit als begonnen. Parallel arbeitende Worker dürfen nur abgleichen. Eine nach Ablauf einer Lease noch unklare Übermittlung erzeugt keinen zweiten Create-Aufruf.

Statusfolge: `ready` → `sending` → `production` → `shipped`. Netzwerkfehler führen zu `uncertain`; ausdrückliche Ablehnung zu `rejected`. Vor jeder Create-Möglichkeit wird die externe Shopbestell-ID beim Anbieter gesucht. Ein Neustart übernimmt den dauerhaften Zustand. Bei unklarem Status ohne Treffer wird gehalten und Jonas informiert; es erfolgt keine blinde Neusendung.

Der lokale Podbase-Adapter speichert den Anbieterzustand in einer eigenen Tabelle mit eindeutigem `external_id`. Er kann Ablehnung oder Verbindungsabbruch **nach Annahme** simulieren. Alle Positionen gehören zu einem Anbieterauftrag. Statusabgleich prüft Anbieter-ID und externe Bestell-ID. Automatischer lokaler Testversand erfolgt nach etwa 16–20 Sekunden, sonst kann Jonas ihn gezielt auslösen.

`PodbaseAPI` verwendet `x-api-key`, `GET /catalog`, `POST /orders`, `GET /orders/{id}` sowie paginiertes `GET /orders` zum Abgleich. Es sendet `buyerInfo.name`, internationale Telefonnummer und E-Mail, Lieferadresse mit Postleitzahl/Land, Economy-Versand-ID und alle sechs Pflichtfelder je Position. Druckdateien sind direkte unveränderliche PNG-URLs. Der API-Client ist im laufenden Testserver **nicht aktiviert**; Produktions-Create ist zusätzlich gesperrt. Eine echte Integration muss aktuelle Katalog-IDs, In-stock-Werte, genehmigte Modellschablonen, öffentliche HTTPS-Dateien und Konto-/Beilagenfreigaben übernehmen.

## Nachrichten und Fehlerfälle

Mail-Outbox mit Eindeutigkeit `(order_id, kind)`: Bestätigung, Admin-Fehlernachricht, Versandnachricht. Die vorbereitete Bestätigung bleibt bis bestätigter Zahlung zurückgehalten. Aktuell bedeutet `local-delivered` ausschließlich „im lokalen Testpostfach verfügbar“. Kein SMTP-/API-Versand findet statt.

Bei Podbase-Ablehnung bleibt die Bestellung bezahlt und offen. Jonas sieht Nummer, verständlichen Grund und einen durch Admin-Anmeldung geschützten Link. Manuelles Wiederanstoßen ist nur für ausdrücklich abgelehnte Aufträge vorgesehen; unklare Fälle müssen zuerst abgeglichen werden.

## Auswertung

- Besuch: neu angelegte technisch notwendige Sitzung; keine IP, kein User-Agent, kein Fingerprint. Laufzeit konfigurierbar, standardmäßig zwei Stunden. Ein Statusbesuch in einer neuen Sitzung zählt ebenfalls als Besuch.
- Produktansicht/Warenkorbzugang: eindeutige Kombination aus Besuch, Ereignisart, Produktart und Motiv. Wiederholtes Bearbeiten erhöht diese Besuchszahl nicht.
- Bezahlte Bestellung: genau eine serverseitig bestätigte Bestellung nach Zahlungszeitpunkt im ausgewählten Intervall. Neue Events oder Aktualisieren der Statusseite zählen nicht erneut.
- Stück: Summe der Mengen der bezahlten Positionen. Ein gemischter Auftrag kann in beiden Produkttypen erscheinen; der Gesamtauftrag wird weiterhin einmal gezählt.
- Produkt-Kaufquote: im Zeitraum kaufende Besuche **mit Produktansicht im selben Zeitraum** geteilt durch Besuche mit entsprechender Produktansicht. Herkunftsquote: im Zeitraum kaufende Besuche aus den im Zeitraum gestarteten Sitzungen geteilt durch diese Sitzungen. Absolute Bestellungen können durch Zeitgrenzen davon abweichen. Alle Nenner werden angezeigt.
- Quellen: `tiktok`, `gemeinde`, `sonstige`, `unbekannt`; erste Herkunft einer Sitzung bleibt bestehen. Kampagne: nur technische ASCII-Kennung mit maximal 40 Zeichen.
- Anlass: freiwillig nach Zahlung, getrennt von Produktart. Hürdenfeedback: ausschließlich aktiv gewählter Grund, keine Interpretation eines Abbruchs. Keine Beraterfreitexte.

Zeitraumgrenzen der Oberfläche verwenden Europe/Berlin einschließlich Sommer-/Winterzeit. Der Testserver schreibt nur `mode=test`; Test-/Livedaten sind für separate Datenspeicher und getrennte Auswertungsfilter vorbereitet. Livebetrieb wird aktuell beim Start zurückgewiesen.

## Betrieb

Defaultbindung `127.0.0.1:3000`. Ein persistenter lokaler Datenträger hält Bestellungen und PNGs. Für Sicherungen den Server ordentlich beenden und dann den gesamten `data/test`-Ordner kopieren; beim laufenden SQLite-WAL nicht nur die Hauptdatei kopieren. Dateien mit Lieferdaten und Statuslinks nicht öffentlich ablegen. Tests verwenden eigene Datenbanken unter dem ignorierten `test-results/`.

Ein Livehost muss SQLite-Persistenz und einen dauerhaften Worker garantieren oder auf eine geeignete gemeinsame Datenbank/Queue umgestellt werden. Flüchtige Serverless-Dateisysteme erfüllen dies nicht. Zugangsdaten gehören in serverseitige Secretverwaltung. Echte Mailzustellung, Webhookwiederholung, Backups, Monitoring, Löschung und ein freigegebener Produktionsauftrag sind noch Teil der Live-Voraussetzungen.
