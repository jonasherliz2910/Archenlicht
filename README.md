# Archenlicht

Deutschsprachiger Webshop für christliche Handyhüllen. **Lokal startbarer Entwicklungsstand im Testbetrieb**, umgesetzt nach `CODEX-BAUAUFTRAG-ARCHENLICHT.md`. Nach Jonas’ Ergänzung werden **Kartenzahlung und PayPal über Stripe Checkout** vorbereitet. Eine separate direkte PayPal-Integration wird nicht benötigt.

## Direkt auf diesem Rechner starten

Die Bibliotheken und Schriften sind bereits installiert. Im Projektordner:

```powershell
.\Start-Shop.cmd
```

Anschließend **http://localhost:3000** öffnen. Das Startfenster offen lassen; `Strg+C` beendet den Server. Alternativ funktioniert `Start-Shop.ps1`. Beide Startdateien finden auch die hier bereits vorhandene Node-Laufzeit ohne globalen PATH-Eintrag.

Weitere Befehle:

```powershell
.\Start-Shop.cmd check
.\Start-Shop.cmd test
.\Start-Shop.cmd seed
.\Start-Shop.cmd dev
.\Start-Shop.cmd assets
.\Start-Shop.cmd design-previews
```

`dev` startet mit automatischem Serverneustart bei Änderungen. Kein Buildschritt nötig. Für die Oberfläche die Browserseite neu laden. `assets` erzeugt Geschenkkarte, Social-Profil und Motivübersicht neu. Bei einer Namensänderung erst ein freigegebenes neues Master-Logo bereitstellen; der Originalschriftzug wird niemals automatisch umgezeichnet.

`design-previews` erzeugt zwölf Shopentwürfe aus dem integrierten Designpaket v2 Farbe sowie 24 Exporte auf schmalen und breiten synthetischen Testflächen. [Kollektion vergleichen](docs/previews/designpaket-v2-farbe/vergleich.png) und [schmal/breit vergleichen](docs/previews/designpaket-v2-farbe/schmal-breit.png). Die PNG-Blankomotive bleiben unverändert; neue Textflächen und Bildversatz werden gemeinsam proportional gerendert. Alte Assets und gespeicherte Bestellexporte bleiben erhalten. [Details und Produktionsgrenzen](docs/DESIGNPAKET.md).

Auf einem anderen Rechner: **Node.js 24 oder neuer**, dann `npm install`, `npm run seed`, `npm start`. Alternativ `pnpm install` mit der beiliegenden Lockdatei. Die Fonts samt SIL-Lizenzen liegen im Projekt; kein externer Schriftabruf.

## Was bereits funktioniert

Das hinzugekommene [CI-Book](Archenlicht-CI-Book.pdf) wurde berücksichtigt: Original-Logo Nr. 2 unverändert im Seitenverhältnis 2:1, Warmweiß `#FCF8EF`, Salbei `#A6B99B`, Waldgrün `#163E29`, lesbare Fließtexte und vorgeschaltete Modellwahl auf dem Handy. Der Originalschriftzug wird als PNG eingesetzt; Karten- und Profil-SVG betten dieselbe Bilddatei ein. Eine Vektorfassung des Logos wird damit nicht vorgetäuscht.

- Sechs stabile Produktseiten, mobil gestaltete Oberfläche, ein Tough-Hüllentyp und 74 **simulierte** iPhone-, Samsung-Galaxy- und Google-Pixel-Modelle.
- Kollektion: **29,90 €**; Wunschvers: **34,90 €**, jeweils als Test-Endpreis einschließlich Deutschlandversand und fester Geschenkkarte.
- Wunschvers-Gestalter mit neun quellenbelegten kurzen Testauszügen, Motiv, Modell und optionaler Widmung. Die lokale regelbasierte Testberatung liefert drei unterschiedliche Stellen oder die sechs Ersatzmotive.
- Sechs unveränderte Blankomotive aus dem gelieferten Designpaket. Versstelle, Originalauszug und optionale Widmung werden separat mit der mitgelieferten Caveat-Schrift gemessen, zentriert und gerade eingesetzt. Überlauf verhindert den Warenkorbzugang.
- Vorschau und unveränderlicher PNG-Testexport aus demselben Layout; aktuell 1.200 × 2.400 px / 300 dpi auf **simulierten** Geräteschablonen. Schrift ist in Pfade umgewandelt. Die neuen farbigen Ausgangsmotive messen je nach Motiv 962 × 1.634 oder 1.635 px; Hochskalieren ergänzt keine Bilddetails. Hüllen ohne Markenaufdruck, `productionApproved: false`.
- Serverseitiger Warenkorb, Bearbeiten derselben Position, Mengen, Gastkauf, freiwilliges Kundenkonto, geschützte Bestellhistorie und Gaststatuslinks.
- Lokaler PayPal-/Karten-Zahlungssimulator; vorbereitete **Stripe-Checkout-Testintegration für beide Zahlungsarten**, signierter Webhook und unabhängiger Zahlungsabgleich.
- Persistente Fulfillment-Warteschlange, einmalige Übergabe aller Positionen, Abgleich bei unklarer Antwort, Wiederaufnahme nach Neustart, Fehlerfall und Adminnachricht.
- Simulierte Produktion, Tracking und einmalige Versandnachricht. Testpostfach sowie Herkunfts-, Motiv-, Produktart- und Anlassauswertung nur für Jonas.
- Vorbereitete Informationsseiten einschließlich Impressum, Datenschutz, AGB und Widerruf, ausdrücklich als Arbeitsentwürfe markiert.

## Testzugänge und Beispielbestellungen

### Lieferdaten und Karten für spätere Bestellungen

Angemeldete Kunden können an der Kasse freiwillig **„Lieferdaten für nächste Bestellungen speichern“** wählen. Erst nach bestätigter Zahlung wird die Adresse im Konto hinterlegt. Beim nächsten Kauf werden Name, Straße, Ort, Postleitzahl, Telefonnummer und E-Mail vorausgefüllt. Die Auswahl ist standardmäßig aus; ein abweichender Geschenkempfänger überschreibt die gespeicherten Angaben nicht automatisch.

Unter `/konto` können Kunden die Lieferdaten bearbeiten, entfernen oder aus ihrer letzten bezahlten Bestellung übernehmen und ausdrücklich speichern. Bestehende Konten erhalten durch die Erweiterung keine automatisch gespeicherten Adressen. Änderungen gelten für künftige Einkäufe; die ursprünglichen Bestellsnapshots bleiben erhalten.

Für Kartenzahlungen legt der Stripe-Testadapter eine beständige, serverseitig an die Konto-ID gebundene Customer-Zuordnung an. Stripe Checkout bietet eine **freiwillige Speichercheckbox** und zeigt zuvor freigegebene Karten erneut an. Ohne Auswahl wird keine neue Karte zur Wiederanzeige gespeichert. Es wird kein automatisches `setup_future_usage` gesetzt. Der Shop erhält keine vollständige Kartennummer oder Prüfnummer. Im Konto zeigt er Marke, letzte vier Ziffern und Ablaufdatum und bietet Entfernen an.

Im aktuellen lokalen Betrieb ist dieser Ablauf mit einer ausdrücklich markierten **Demo-Visa ···· 4242** umgesetzt. Die Checkbox dafür erscheint im lokalen Zahlungssimulator. Echte Karten werden erst nach Einrichtung der Stripe-Testzugänge getestet. Karte und Adresse sind zwei voneinander unabhängige freiwillige Entscheidungen. Gäste erhalten keine kontogebundene Speicherfunktion.

Zusatztests für Zustimmung, Abbruch, neue Sitzung, Serverneustart, Aktualisierung/Löschung, verspätete Ereignisse, fremde Konten, native Stripe-Checkbox, Customer-Bindung und sicheres Entfernen. Mit den v2-Prüfungen für Originalmaße, schmale/breite Flächen, SVG-/PNG-Identität, Randfortsetzung und größere Schrift vom 5. November 2026: **Gesamt 37 Tests bestanden.**

Jonas’ Zugang wird beim ersten Start zufällig erzeugt und steht ausschließlich lokal in **`data/test/admin-access.txt`**. Anmeldung unter `/konto`, anschließend `/auswertung`. Die Admin-Zugangsdaten stehen nicht im Quellcode oder im öffentlich ausgelieferten Verzeichnis.

`seed` legt genau zwei simulierte Demokäufe an: TikTok → feste Flügelhülle → PayPal sowie Gemeinde → Wunschvers → Karte → Kundenkonto. Beide besitzen simulierte Sendungsnummern und Nachrichten. Zusammen: **2 Bestellungen, 2 Stück, 64,80 € Testumsatz**. Wiederholtes Seeden erzeugt keine weiteren Demokäufe.

Das bewusst öffentliche lokale Demokonto lautet **`anna@example.test`**, Passwort **`Nur-Test-Anna-2026!`**. Dort erscheint nur die personalisierte Demobestellung. Keine echten personenbezogenen Daten verwenden.

Beispiellinks:

```text
http://localhost:3000/kollektion/unter-seinen-fluegeln?utm_source=tiktok&utm_campaign=fluegel-video
http://localhost:3000/gestalten?utm_source=gemeinde&gemeinde=muster-gemeinde
```

Ein Gemeinde-QR-Code kann den zweiten Link enthalten. Die Gemeinde-Kennung ist ein technisches Kampagnenzeichen, keine Situationsbeschreibung. Alle Motivadressen und weitere Beispiele stehen in [der Testanleitung](docs/TESTANLEITUNG.md).

## Konfiguration und Zahlungsanbieter

Ohne `.env` startet ausschließlich der lokale Testbetrieb. `.env.example` enthält keine Geheimnisse. Eine lokale `.env` wird ignoriert und niemals ausgeliefert.

Für den späteren **Stripe-Testmodus**:

```dotenv
SHOP_MODE=test
PAYMENT_MODE=sandbox
STRIPE_SECRET_KEY=sk_test_HIER_DEIN_TESTSCHLUESSEL
STRIPE_WEBHOOK_SECRET=whsec_HIER_DEIN_TEST_WEBHOOK_SECRET
PODBASE_MODE=local
MAIL_MODE=local
```

Karte und PayPal werden im Stripe-Konto als Zahlungsmethoden eingerichtet. PayPal-Verfügbarkeit und Aktivierung müssen für Jonas’ Konto geprüft werden. Gehostete Checkoutflächen erfassen die Zahlungsdaten; der Shop selbst hat keine Kartenfelder.

Webhookziel: `POST /api/webhooks/stripe`, Ereignisse `checkout.session.completed` und `checkout.session.async_payment_succeeded`. Bei lokalem Stripe-CLI-Forwarding das **CLI-Webhooksecret** verwenden. Kein Secret hier eintragen oder committen. Bestellbezug, Checkout-ID, bestätigter Status, Testmodus, Betrag und Währung werden serverseitig geprüft. Der Rücksprung allein gilt nie als Zahlungsnachweis.

**Noch keine echten Stripe-Sandboxzahlungen durchgeführt:** Händler-Testzugänge fehlen. Die Schnittstelle ist mit kontrollierten HTTP-Fixtures automatisiert geprüft. Im aktuellen Betrieb sind sämtliche Zahlungen lokal simuliert. Podbase und Mail bleiben auch bei Stripe-Testzahlungen lokal.

## Modellauswahl

Die Modellfläche öffnet eine Auswahl mit Apple, Samsung und Google, einer Suche über alle Marken und Modellkarten. Neuere Reihen stehen oben. Die aktuelle Auswahl ist markiert und bleibt bei „Bearbeiten“ erhalten. Die Auswahl ist auch mit der Tastatur bedienbar; Escape schließt das Fenster.

## Technik und Übergabe

Repository: [jonasherliz2910/Archenlicht](https://github.com/jonasherliz2910/Archenlicht). Für Vercel sind ein nativer Function-Einstieg, dauerhafte Neon-Datenhaltung und geschützte Testjobs eingerichtet. [Konfiguration und Hosting-Hinweise](docs/VERCEL.md).

Der Shop verwendet **Node.js 24, natives HTTP und HTML/CSS/JavaScript**. Lokal speichert er in SQLite, auf Vercel in Neon PostgreSQL. Konten, Bestellungen, Zahlungsereignisse, Druckdateien und Queue bleiben serverseitig erhalten. `sharp` rastert Druckdateien; `opentype.js` erzeugt identische Schriftpfade für Vorschau und Druck. Die Cloud-Anpassung bleibt ein Testbetrieb; echte Stripe- und Podbase-Produktionsabläufe benötigen weiterhin die dokumentierten Freigaben.

- [Technik, Datenschutz und Betrieb](docs/TECHNIK.md)
- [Testanleitung und Fehlerfälle](docs/TESTANLEITUNG.md)
- [Testprotokoll und tatsächliche Prüfgrenzen](docs/TESTPROTOKOLL.md)
- [Live-Voraussetzungen und Zuständigkeiten](docs/LIVE-CHECKLISTE.md)
- [Offizielle Schnittstellen- und Textquellen](docs/QUELLEN.md)
- [Motivübersicht als Entwurf](docs/previews/motiv-entwuerfe.png)
- [Geschenkkarte 10 × 15 cm als PNG](public/assets/geschenkkarte-entwurf.png), [bearbeitbares SVG](public/assets/geschenkkarte-entwurf.svg)
- [Social-Profil als PNG](public/assets/social-profil.png), [SVG](public/assets/social-profil.svg)

**Offen:** Browser- und Mobilabnahme. Am 5. November war die Windows-Computeranbindung auch nach Wiederherstellungsversuchen nicht erreichbar (native Pipe fehlt). Die neuen Bildexporte und HTTP-Abläufe wurden geprüft; visuelle Browserprüfung und Bedienprüfung gelten weiterhin nicht als bestanden.

Der Livebetrieb ist im Code gesperrt. Es wurden keine Website veröffentlicht, keine echten E-Mails verschickt und keine kostenpflichtigen Produktionsaufträge angelegt.
