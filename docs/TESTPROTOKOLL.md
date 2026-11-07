# Testprotokoll · aktualisiert am 7. November 2026

## Vercel-Backend und dauerhafte Cloud-Daten

**43 automatisierte Prüfungen bestanden, 0 fehlgeschlagen; ein Neon-Test ist in der normalen Suite absichtlich übersprungen.** Dieser zusätzliche Test wurde separat mit echter Neon-Verbindung erfolgreich ausgeführt. 30 JavaScript-Dateien sind syntaktisch geprüft. Die lokale Suite umfasst zusätzlich asynchrone Transaktionen mit Rollback und konkurrierenden Verbindungen sowie den nativen Vercel-Einstieg mit Routing, CSRF und geschütztem Jobzugriff.

Der echte Neon-Test nutzt ausschließlich ein zufälliges eigenes Schema: zwei Hüllenarten in einem Gastkauf, wiederholte Zahlungsbestätigung ohne zweiten Anbieterauftrag, simuliertes Tracking, Kontokauf mit freiwillig gespeicherter Adresse und Demo-Karte. Mehrere neue Serverinstanzen erhalten Sitzung, Warenkorb, Kontodaten und bytegleiche PNGs. Gespeicherte SVGs referenzieren deduplizierte Originalmotive; bei Auslieferung entsprechen sie exakt dem kanonischen Renderer. Die private Beratungssituation erscheint in keinem gespeicherten Asset. Das isolierte Testschema wird anschließend entfernt.

Die geschützte Vercel-Vorschau `archenlicht-g29osmqdt-jonas-4eb6.vercel.app` wurde erfolgreich gebaut und über den angemeldeten Vercel-CLI-Zugriff in **34 HTTP-Schritten** geprüft: Startseite, Kollektion, Produktseite, Gestalter, JavaScript, CSS und Font erreichbar; Bootstrap mit sechs Motiven und 74 Testmodellen; sichere Sitzungscookies; Vorschau und SVG/PNG; Gastkauf mit beiden Hüllenarten und PayPal-Simulator; Kontokauf mit Karten-Simulator und freiwilliger Datenübernahme; Kontobestellungen; Entfernen der gespeicherten Adresse und Demo-Karte; identisches PNG beim erneuten Abruf. Fremde Bestellungen antworten mit 404, unautorisierte Jobs mit 403, Serverquellen und `.env.local` mit 404. Vorschauen verwenden `archenlicht_preview`, getrennt vom öffentlichen Schema.

Keine echten Zahlungen, E-Mails oder Podbase-Aufträge. Die Windows-Browseranbindung ist weiterhin nicht erreichbar (`Computer Use native pipe is unavailable`, Betriebssystemfehler 2). Deshalb sind die Abläufe per HTTP/API und Datenbank geprüft; eine visuelle Browser- und Mobilabnahme wird nicht behauptet. [Hosting und Betriebsgrenzen](VERCEL.md).

## Ursprüngliche Vercel-Diagnose und Startfehler

**40 automatisierte Tests bestanden, 0 fehlgeschlagen.** 24 JavaScript-Dateien syntaktisch geprüft. Die drei neuen Prüfungen reproduzieren eine nicht-JSON-Hosting-Antwort und den fehlgeschlagenen Bootstrap. Die Oberfläche zeigt einen verständlichen Fehler und lässt eine vollständige Neuladung zu; reguläre JSON-Antworten und verständliche API-Fehler bleiben erhalten.

Das ursprüngliche öffentliche Deployment wurde per HTTP geprüft: `/` 200, `/api/bootstrap`, `/api/health` und `/kollektion` 404. Fehlende Serverrouten waren die bestätigte Ursache. Erst nach der Frontend-Korrektur wurde die oben dokumentierte Backend-/Hosting-Anpassung umgesetzt; die früheren Frontend-Tests allein belegen keine Cloud-Migration.

## Erweiterung: Designpaket v2 Farbe und vollständige Hüllenansichten

**37 automatisierte Tests bestanden, 0 fehlgeschlagen.** 22 JavaScript-Dateien syntaktisch geprüft. Vorrangige Anleitung `UPDATE-ZUERST-LESEN.md` gelesen; neue PNGs bytegleich unter `public/assets/designpaket-v2-farbe/` eingebunden, alte Assetdateien erhalten. Flügel/Lamm 962 × 1.634 px, übrige vier 962 × 1.635 px. Neue Textpositionen stammen aus dem v2-Manifest; die vergrößerte Schrift bleibt erhalten. Bei „Im Schatten“ wurde die Referenzfläche nach tatsächlicher Pixelprüfung schmaler gesetzt, damit die Zweige nicht berührt werden.

Layout `archenlicht-package-layout-v4-farbe` hält das gesamte Originalbild und alle Textblöcke proportional im Modellcanvas. Bildversatz ist in den Textpositionen enthalten. PNG übernimmt die tatsächlichen SVG-Abmessungen. Die Hüllenansicht folgt den Modellmaßen und nutzt `contain`, passende Hintergrundfarbe und automatische Höhe; aktive `cover`-Anwendung auf diese Druckbilder wurde entfernt. Andere Produktbilder bleiben unverändert.

Zwölf Shopentwürfe sowie 24 feste/personalisierte Exporte auf synthetischen schmalen/breiten Flächen (1.000 × 2.400 und 1.400 × 2.400 px) wurden erzeugt und visuell kontrolliert: [Kollektion](previews/designpaket-v2-farbe/vergleich.png), [schmal/breit](previews/designpaket-v2-farbe/schmal-breit.png). Die 24 SVG-/PNG-Paare haben identische gerenderte Pixel; Bild- und Textgrenzen liegen vollständig innerhalb des Canvas. Die Geometrieproben sind keine bestätigten Podbase-Vorlagen und werden nicht in den Shopkatalog eingefügt.

Browserprüfung erneut technisch blockiert: `Computer Use native pipe is unavailable`, Betriebssystemfehler 2, auch nach Wiederholung und Sitzungsreset. Deshalb keine Browserabnahme behauptet. `productionApproved` bleibt `false`.

Nach Neustart des lokalen Shops zusätzlich per HTTP bestätigt: sechs neue Blankodateien bytegleich ausgeliefert, zwölf Vorschauen einschließlich individueller Quellmaße mit identischem SVG/Hash zum Renderer, PNG bytegleich zum Export, Shopseiten HTTP 200 und 74 unveränderte Testmodelle. Vorher/nachher-Prüfsummen bestätigen sämtliche bisherigen gespeicherten SVGs, PNGs und Bestellpositions-Snapshots unverändert; Anzahl der Konten gleich. Serverfehlerlog ohne Laufzeitfehler, lediglich Hinweis auf die optionale fehlende `.env`.

## Anpassung: durchgehender Hintergrund und größere Schrift

**36 automatisierte Tests bestanden, 0 fehlgeschlagen.** Layoutversion `archenlicht-package-layout-v3`: leere Papierbereiche werden oben und unten aus dem Originalbildrand fortgesetzt, die Illustration bleibt unverzerrt. Die Vorschau richtet ihre Höhe nach dem Druckbild, sodass der Rahmen keine zusätzlichen Leerbalken erzeugt. Referenzen, Originalauszüge und Widmungen verwenden größere Schriftbereiche; bei seitlichen Zweigen bleibt zusätzlicher Abstand.

Der neue Pixeltest prüft an allen sechs Motiven die Farbübergänge, Papiertextur bis zum Rand und freie Originalbildpixel im Abstand um die vergrößerten Texte. Zwölf aktualisierte Exporte sind im [Vergleichsbild](previews/designpaket/vergleich.png) sichtbar. Die bestehenden Überlauf-, Druckdatei-, Kaufweg- und Datenschutzprüfungen bleiben bestanden. Browserabnahme weiterhin offen wie unten dokumentiert.

## Erweiterung: geliefertes Designpaket

**35 automatisierte Tests bestanden, 0 fehlgeschlagen.** 22 JavaScript-Dateien syntaktisch geprüft. Alle sechs PNG-Blankomotive sind bytegleich mit der Übergabe integriert; Caveat stimmt ebenfalls bytegleich überein. Getrennte Textflächen, horizontal zentrierte Glyphen, proportionale Skalierung, Mindestgrößen, einzeilige Referenzen/Widmungen, höchstens drei Auszugszeilen, fehlende Glyphen und blockierter Warenkorbzugang bei Überlauf sind geprüft. Gespeicherte alte SVGs bleiben bei Layoutänderungen unverändert.

Die zwölf festen und personalisierten Testexporte wurden im [Vergleichsbild](previews/designpaket/vergleich.png) visuell auf Textausrichtung und Abstand zu den Dekorzweigen kontrolliert. [Integrationsdetails und Prüfgrenzen](DESIGNPAKET.md). Reale Modellschablonen, physische Lesbarkeit und Produktionsmuster sind weiterhin offen; `productionApproved` bleibt `false`.

Nach Neustart auf `http://localhost:3000` zusätzlich am laufenden Server geprüft: sechs Blankodateien bytegleich ausgeliefert, zwölf Vorschauen mit identischer normalisierter Konfiguration und identischem SVG/Hash zum Renderer, ein PNG bytegleich zum Export, Seiten und statische Dateien HTTP 200, 74 Modelle im Bootstrap. Vorher/nachher-Prüfsummen bestätigen sämtliche vorhandenen SVGs, PNGs und Bestellpositions-Snapshots unverändert; die Anzahl der Konten bleibt gleich. Das Serverfehlerlog enthält nur den Hinweis auf die optionale fehlende `.env`, keine Laufzeitfehler.

Die Windows-Browserbedienprüfung konnte nicht starten: `Computer Use native pipe is unavailable`, Betriebssystemfehler 2. Die App-Ermittlung wurde gemäß Wiederherstellungsanleitung wiederholt und nach Sitzungsreset erneut versucht. Es gab in diesem Durchlauf keine Browserinteraktion; die visuelle Browser- und Mobilabnahme bleibt offen.

## Erweiterung: übersichtliche Modellauswahl

30 automatisierte Tests einschließlich drei neuer Prüfungen für markenübergreifende Suche, Schreibweisen ohne Leerzeichen, Plus-Zeichen, Modellreihensortierung, unveränderte Modell-/Varianten-IDs und die Sperre nicht verfügbarer oder nicht freigegebener Kombinationen. 19 JavaScript-Dateien syntaktisch geprüft.

Die neue Oberfläche verwendet einen nativen modalen Dialog mit Markenflächen, Suche, Modellkarten, Auswahlmarkierung, Escape-Schließen und Fokusrückkehr. Fertige Hüllen, Wunschvers-Schritt und mobile Vorschau verwenden dieselbe Auswahl. Die Modell-ID bleibt unverändert der Eingang für die bestehenden Vorschau-, Warenkorb- und Bestellprüfungen. Die visuelle Bedienprüfung konnte in diesem Durchlauf wegen wechselnder Fensterpositionen und fehlerhafter Eingabekoordinaten der Computeranbindung noch nicht abgeschlossen werden; sie wird nicht als bestanden ausgewiesen.

## Erweiterung: aktuelle Modelle aller drei Marken

**27 automatisierte Tests bestanden, 0 fehlgeschlagen.** 26 zusätzliche Modelle aus der öffentlichen Podbase-Tough-Liste wurden ergänzt; der lokale Katalog umfasst damit 74 Modelle (27 Apple, 27 Samsung, 20 Google). Alle bisherigen 48 Modell- und Varianten-IDs bleiben erhalten. Bestehende Bestellungen werden nicht umgeschrieben.

Die öffentliche Produkt-JSON-Antwort wies sämtliche 26 Ergänzungen am 4. November als verfügbar aus; die geprüften Modellbezeichnungen stehen in `podbase-modelle-2026-11-04.json`. Das bestätigt das öffentliche Angebot, nicht den Bestand oder die API-IDs im Händlerkonto. Varianten, Druckvorlagen, Zahlungen, Versand und Freigaben im lokalen Shop bleiben simuliert.

Zusätzlich als gemeinsamer HTTP-Kauf geprüft: iPhone 18 Pro Max, Galaxy S26 Ultra, Pixel 11 Pro XL, Galaxy Z Flip8, iPhone Air und Galaxy A57, mit festen und personalisierten Hüllen. Vorschau-Hashes, Modellbezug, vollständige Anbieterpositionen, PayPal-Testzahlung und Testversand stimmen überein. Nicht bestätigte Modelle wie iPhone 18 ohne Pro, Pixel 11a, Galaxy S27 und Z Fold8 werden nicht ergänzt. Der Layouttest deckt jetzt 6 × 74 = 444 feste Modell-/Motivkombinationen ab.

## Erweiterung: Google Pixel

**26 automatisierte Tests bestanden, 0 fehlgeschlagen.** Der Testkatalog enthält 17 Google-Pixel-Modelle (Pixel 6 bis 10 einschließlich a-, Pro- und Pro-XL-Varianten), insgesamt 48 Modelle und 288 feste Modell-/Motivkombinationen. Apple- und Samsung-Varianten-IDs bleiben unverändert. Alle Modelle sind weiterhin simuliert.

Zusätzlich per HTTP, SQLite und lokalen Adaptern geprüft: alle Pixel-Vorschauen mit breitem Kameraausschnitt, Varianten in Bootstrap und Druckpartner-Testkatalog, feste Pixel-8-Hülle und personalisierte Pixel-Hülle gemeinsam bestellen, dieselbe Warenkorbposition von Pixel 10 Pro XL auf Pixel 10a ändern, entfernte Variante vor Zahlung sperren, Druckdatei mit identischem Hash, simulierte Zahlung, ein Auftrag mit beiden Positionen und Tracking bis Testversand. Reale Podbase-Varianten, Geräteschablonen und Musterfreigaben bleiben offen.

Sichtbar in der integrierten VS-Code-Shopvorschau geprüft: aktualisierte Markenliste, Google-Einträge im Auswahlmenü der festen Flügelhülle, Auswahl von Pixel 10a sowie anschließender Wechsel von Modellbeschriftung und breiter Kameraleiste. Das Menü wurde per nativer UI bedient und die Vorschau als Screenshot kontrolliert. Eine vollständige mobile Bedien- und Checkoutabnahme bleibt offen; die separate Browseranbindung ist weiterhin nicht erreichbar.

## Erweiterung: freiwillig gespeicherte Lieferdaten und Karten

**25 automatisierte Tests bestanden, 0 fehlgeschlagen.** 17 JavaScript-Dateien syntaktisch geprüft. Die sieben zusätzlichen Tests gegenüber dem Stand vom 3. November prüfen:

- Adresse nach ausdrücklichem Opt-in und bestätigter Zahlung, spätere Sitzung und abweichenden Geschenkempfänger ohne stilles Überschreiben.
- Zahlungsabbruch sowie verspätete Zahlung nach Adressänderung oder Entfernung.
- Demo-Karte freiwillig speichern, wiederverwenden, entfernen und keine Wiederherstellung durch Zahlungsreplays. Keine vollständigen Nummern-/CVC-Felder.
- Trennung von Konten, fremde Karten-IDs, Gäste und Ablehnung unzulässiger Speicheroptionen vor Zahlung.
- Persistenz nach Neustart mit unveränderten Nutzerkonten.
- Native Stripe-Speichercheckbox und Wiederanzeigefilter ohne automatisch gesetztes `setup_future_usage`.
- Stripe-Customer-Erstellung mit Idempotenz, feste Bindung an Konto-ID statt Liefer-E-Mail, Filter auf sichere Kartenmetadaten, Eigentümerprüfung vor `detach` und Ablehnung fremder Customer bei Zahlungsbestätigung.

Die Stripe-Fälle verwenden kontrollierte HTTP-Fixtures. Echte Stripe-Sandboxzahlungen und visuelle Browserabnahme bleiben gemäß unten dokumentierter Grenzen offen. Es wurden keine echten Karten gespeichert oder gelöscht.

## Vorheriger Abnahmestand · 3. November 2026

## Tatsächlich ausgeführte Prüfungen

Node.js **24.22.1**, Windows. 15 JavaScript-Dateien syntaktisch geprüft. **18 automatisierte Tests bestanden, 0 fehlgeschlagen**. Tests starten eigene echte HTTP-Server mit eigenen SQLite-Datenbanken. Keine echten Zahlungen, E-Mails oder Podbase-Produktionsaufträge.

| Prüfung | Ergebnis / tatsächliche Grenze |
|---|---|
| TikTok → Flügelhülle → iPhone 15 → Gast → PayPal → Produktion → Tracking | Vollständig über HTTP/API, SQLite und lokalen Zahlungs-/Podbase-Adapter geprüft. Drucktext nur Psalm 91,4. Kein Browserklicktest. |
| Gemeinde → Situation → drei unterschiedliche Stellen | Lokal regelbasiert geprüft; alle Zitate exakt mit vorhandenem Testbestand verglichen. Quellen einzeln beim offiziellen Textangebot nachgeprüft. Keine externe KI. |
| Wunschvers → Motiv → Samsung Galaxy S24 → Widmung → Warenkorb bearbeiten | Aktualisierung derselben Positions-ID, Änderung 2026 → 2027, Preis 34,90 € geprüft. |
| Karte → Bestellkonto → Produktion → Tracking | HTTP/API mit lokalem Kartenadapter. Kontoanmeldung, Abmeldung, erneute Anmeldung und eigene Historie geprüft. |
| Druckidentität | Bestellsnapshot-Hash = bestätigte Vorschau. PNG tatsächlich abgerufen, 1.200 × 2.400 px und 300 dpi geprüft. Gerasterte Pixeldaten mit exakt dem Vorschau-SVG verglichen. Keine Textfonts oder Marke im Druck-SVG. |
| Original-Logo / CI | Original-PNG im öffentlichen Shop bytegleich zur gelieferten Datei, 2:1; unverändert auch in Karten-/Profil-SVG eingebettet. Farbwerte und 300-dpi-Kartenformat geprüft. |
| Alle festen Modell-/Motivkombinationen | 6 Motive × 31 simulierte Modelle geprüft; zugehörige Versstelle und Templateversion vorhanden. Alle 9 personalisierbaren Testauszüge durch den Renderer geprüft. Keine reale Podbase-Verfügbarkeitsbestätigung. |
| Beratung ausgefallen / unpassende Eingabe | Jeweils verständlicher Grund und sechs kuratierte Ersatzmotive. Keine erfundenen Stellen. |
| Druck zu lang / fremder Zitattext | Überlange Testquelle, Widmung >32 Zeichen, nicht darstellbare Zeichen und eingespeister Drucktext werden abgelehnt. |
| Variante vor Zahlung entfernt | Bereits vorhandener Warenkorb wird vor Checkout blockiert. Nach Zahlungsbeginn entfernte Variante wird als bezahlter offener Fall gehalten. |
| Lieferdaten | Deutschlandpflicht, fünfstellige PLZ und internationale Pflichttelefonnummer geprüft. |
| Zahlungsabbruch / ungeprüfte Erfolgsseite | Kein Fulfillment; Warenkorb nach Abbruch weiter vorhanden. |
| Doppelte/parallele Zahlungsereignisse | Sechs parallele lokale Bestätigungen und weitere Event-ID: genau ein Queueeintrag und ein Anbieterauftrag. |
| Falscher Betrag / Währung / Bestell-ID / Provider-ID / Status | Jeder Fall serverseitig abgewiesen. |
| Podbase-Ablehnung | Bestellung bleibt bezahlt, Queue `rejected`, ein offener Fall, genau eine Adminnachricht mit Nummer, Grund und geschütztem Auftragslink. |
| Antwort unterbrochen nach Annahme | Zunächst `uncertain`, danach Abgleich → `production`. Ein Auftrag, ein Create-Versuch. |
| Neustart / parallele Worker | Gleiche Datenbank nach Neustart sowie zwei gleichzeitig arbeitende Shopinstanzen geprüft. Kein zweiter Produktionsauftrag; eine Versandnachricht. |
| Unklarer Auftrag ohne Anbietertreffer | Gehalten und gemeldet; keine automatische Neusendung. |
| Mehrere Positionen und Mengen | Ein Anbieterauftrag mit beiden Positionen und Mengen 2/3; serverseitige Gesamtsumme 164,50 €. |
| Gaststatuslink / fremde Zugriffe | Fremder Bestellpfad abgewiesen. Richtiger separater Gasttoken erlaubt nur seine Bestellung; erneutes Laden über begrenzte Sitzung möglich. Fremde Konten, Warenkorbpositionen und Adminzugriffe gesperrt. |
| CSRF und Dateigrenzen | Falsche Origin oder CSRF abgewiesen. `.env`, Datenbank und Serverquellen nicht öffentlich abrufbar. |
| Verwerfen der Situation | Keine Testbeschreibung in Bestellungen, Events, Mail, Besuch, Sitzung, Nutzer, Assets, Anbieterauftrag oder Feedback. Abmeldung und Ablauf löschen den flüchtigen Text. |
| Kennzahlen | Genau 2 Käufe, 2 Stück, 64,80 €, je 1 TikTok/Gemeinde und Kollektion/Wunschvers. Bearbeiten, doppelte Events und Aktualisieren zählen nicht erneut. Geschenk-Anlass separat gespeichert. |
| Stripe Checkout für Karte und PayPal | Kontrollierte HTTP-Fixtures prüfen beide Methodentypen, Positionen, Europreise, Mengen, Bestellreferenz, deutsche Oberfläche und Idempotency-Key. Beide führen ausschließlich zur Stripe-API. |
| Stripe-Statusabgleich | `paid`, `complete` und `livemode=false` erforderlich; Live-Schlüssel abgewiesen. |
| Stripe-Webhook | HMAC, Zeitfenster, gefälschter Body und Replay geprüft. Signierter Webhook allein genügt nicht: unabhängiger Stripe-GET entscheidet. Auch PayPal über Stripe geprüft; gefälschter Betrag im Event wird nicht übernommen. |

Die Zeilen beschreiben einzelne Assertions innerhalb der 18 Tests; es handelt sich nicht um 29 voneinander unabhängige Testläufe.

## Im laufenden Shop vorbereitet

Zwei dauerhafte, ausdrücklich simulierte Demobestellungen sind unter `data/test` vorhanden. Die Auswertung zeigt 64,80 € Testumsatz aus diesen beiden Aufträgen, zuzüglich späterer eigener Tests. Geschenkkarte und Social-Profil wurden tatsächlich als SVG und PNG erzeugt; die Motivübersicht wurde visuell als Bild geprüft. Diese Bildprüfung ist **keine Browserprüfung**.

## Nicht durchgeführt / offen

- **Browser-/Mobilprüfung:** Der Computerzugriff auf Microsoft Edge meldete zweimal „Computer Use was not approved to use Microsoft Edge“. Der zweite Versuch erfolgte nach Jonas’ ausdrücklicher Zustimmung. Die technische Freigabe blieb trotzdem gesperrt. Kein Desktop- oder Smartphone-Browser-Kaufweg wird deshalb als bestanden ausgewiesen. Keine Browser-Screenshots erzeugt.
- **Echte Stripe-Sandbox:** Zugangsdaten und aktivierte Zahlungsmethoden fehlen. HTTP-Fixtures und lokaler Simulator sind keine Anbieterzahlungen. Stripe ist auf Jonas’ Wunsch der zentrale spätere Anbieter für Karte und PayPal.
- **Echte Podbase-Aufträge, Livekatalog und Tracking:** Keine Händlerverbindung und kein bezahlter Musterauftrag. Test-IDs tragen `SIM-`. Der API-Client ist vorbereitet und gesperrt; keine Produktionsfreigabe.
- **Endgültiger Produktdruck:** Motive, Schablonen, Farbe, Beschnitt, Kameraausschnitt und physische Lesbarkeit müssen je Variante geprüft werden. Die SVG-/PNG-Identität ersetzt kein Muster.
- **Kartenbeilage:** Druckentwurf vorhanden; Aktivierung im Podbase-Konto und gemeinsamer Paketversand nicht praktisch bestätigt.
- **Echter Mailversand, Livehosting und Rechtstexte:** Nicht eingerichtet oder freigegeben.
- **Externe KI / moderne Bibelquelle:** Nicht aktiviert; Anbieter-Speicherpraxis und Nutzungsrechte offen.

## Reproduzieren

```powershell
.\Start-Shop.cmd check
.\Start-Shop.cmd test
```

Testergebnisse erscheinen direkt im Terminal. Isolierte Testdaten bleiben im ignorierten `test-results/` für Fehlersuche erhalten. Es werden keine echten Verkaufszahlen erzeugt.
