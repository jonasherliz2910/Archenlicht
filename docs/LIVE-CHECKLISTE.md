# Verkaufsstart Archenlicht – geprüfter Stand

Geprüft am **8. November 2026**, Ausgangsstand `a1c2156` mit anschließend vorbereiteter Resend-Anbindung, veröffentlichter Shop
`https://www.archenlicht.de`, Vercel-Projekt `jonas-4eb6/archenlicht`.

**Ergebnis: funktionsfähiger Testshop, noch nicht für echte Verkäufe bereit.**
Die öffentliche API meldet `mode=test` und `paymentMode=sandbox`.
Der Server sperrt Livezahlungen und echte Produktion. Jonas hat den begrenzten
Resend-Testversand an `info@archenlicht.de` freigegeben; die Production-Konfiguration
ist eingerichtet. Die Einrichtung hat keine neuen Mails, Zahlungen oder
Produktionsaufträge ausgelöst. Die Abnahme mit einer neuen Testbestellung steht aus.

## Bestätigte Betreiberzuordnung

Jonas hat am 8. November 2026 ausdrücklich bestätigt, dass Archenlicht über
**Herzly Marketing GbR**, vertreten durch **Julian Isaak und Laura Herliz**, läuft.
Geschäftsanschrift: **Stettiner Straße 27, 36251 Bad Hersfeld**.
Shopname bleibt **Archenlicht**. Versandadresse, Antwortadresse und Kundenkontakt
sollen **info@archenlicht.de** verwenden. Die Herzly-Rechtstexte dienen als
Grundlage; insbesondere die Datenschutzerklärung ist auf den tatsächlichen
Archenlicht-Shop anzupassen, nicht unverändert zu kopieren.

**Steuerliche Angabe durch Jonas bestätigt:** Nach Rückfrage erklärt Jonas,
dass die Herzly Marketing GbR die Kleinunternehmerregelung nutzt. Diese Angabe
gilt als Vorgabe für Archenlicht; die bestehende Einstellung ohne gesonderten
Umsatzsteuerausweis und mit deaktivierter automatischer Steuerberechnung bleibt
erhalten. Dies ist eine Betreiberangabe, keine eigenständige steuerliche Prüfung.
Der abweichende öffentliche Herzly-Preishinweis „zzgl. USt.“ wird nicht übernommen.
Archenlicht ist keine separate umsatzsteuerliche Unternehmereinheit allein
durch seinen Shopnamen.
[§ 2 UStG](https://www.gesetze-im-internet.de/ustg_1980/__2.html),
[§ 19 UStG](https://www.gesetze-im-internet.de/ustg_1980/__19.html),
[Herzly](https://www.herzly.de/).
Es war keine Änderung der bisherigen Steuereinstellung nötig.

## Bereits erledigt

- Eigene Domain/HTTPS, GitHub-Veröffentlichung, Vercel und Neon-Datenbank.
- Kollektion, Wunschversgestaltung, Warenkorb, Gast-/Kontokauf und freiwillig gespeicherte Lieferdaten.
- Sechs Motive, neun Farben, mobile Darstellung und modellabhängige Vorschauen; alle 54 Farbkombinationen geprüft.
- Aktuelle Codefassung: 62 automatisierte Tests bestanden, zwei externe Integrationstests ohne aktivierte Testzugänge übersprungen. Desktop-/Mobilgrößen im Testbrowser geprüft.
- Eine durch Jonas abgeschlossene Stripe-Sandboxzahlung mit echtem Webhook und genau einem simulierten Fulfillmentauftrag ist dokumentiert.
- Kleinunternehmerbehandlung im Testcheckout umgesetzt und durch Jonas ausdrücklich auch für die Betreiber-GbR bestätigt.

## 1. Automatische E-Mails – Testversand freigegeben, Abnahme offen

**Befund:** Resend-Schlüssel vorhanden. Jonas hat die bereits genehmigte Testmail
in den Posteingang verschoben; über die Ordnerliste wurde `INBOX` bestätigt,
`INBOX.Junk` ist leer. Das belegt noch keine bessere Zustellung neuer Mails.
SPF, DKIM und DMARC bestanden beim ursprünglichen Empfang.
Der eingeschränkte Schlüssel erlaubt keine Domainverwaltung
(HTTP 401 `restricted_api_key`); dies belegt keinen ungültigen Versandschlüssel.
In Vercel Production ist `MAIL_MODE=resend-test` mit dem einzigen Testempfänger
`info@archenlicht.de` und Startgrenze `2026-11-08T19:42:43.712Z` konfiguriert.
Preview/Development bleiben lokal. Der Adapter verarbeitet ausschließlich neue
Testbestellungen an den ausdrücklich freigegebenen Empfänger. Details: [MAIL.md](MAIL.md).

- [x] Resend-Adapter und HTML-/Textvorlagen von `Archenlicht <info@archenlicht.de>` mit bestätigten Betreiberangaben vorbereiten.
- [x] Bestätigung nach Zahlung, simulierte Versandmail und Adminalarm implementieren und automatisiert prüfen.
- [x] Dauerhafte Versandzustände, begrenzte Wiederholungen und Schutz vor Parallel-/Doppelversand ergänzen; alte simulierte Bestellungen ausschließen.
- [x] Resend-Webhook durch Jonas angelegt, Signing-Secret geschützt hinterlegt; eigene signierte Diagnoseanfrage angenommen, ungültige und alte Signaturen abgewiesen.
- [x] Begrenzten Testversand nach ausdrücklicher Freigabe durch Jonas konfigurieren; nur neue Testbestellungen an `info@archenlicht.de`.
- [ ] Neue Stripe-Sandboxbestellung abschließen und echte Resend-Zustellereignisse abnehmen.
- [ ] Zustellung, Rückläufer und Spam-Einstufung mit genehmigten Testempfängern prüfen.
- [ ] Versandmail mit echtem Podbase-Tracking sowie häufige, zuverlässige Hintergrundverarbeitung für Livebetrieb abnehmen.

**Abnahme:** Genau eine Bestätigung pro bezahltem Auftrag; nachvollziehbare
Versand-/Fehlermeldungen. Resend-Idempotency-Keys gelten 24 Stunden, daher bleibt
ein dauerhafter Versandnachweis nötig.
[Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)

## 2. Podbase – weiterhin simuliert

**Befund:** Ausschließlich `LocalPodbase` aktiv. Alle 74 Modelle verwenden
`SIM-TOUGH`/`SIM-VARIANT-*`. Ein vorbereiteter API-Client ist vorhanden,
aber kein angeschlossener Händlerzugang. Die Shopliste belegt keine aktuelle
Podbase-Verfügbarkeit.

- [ ] Jonas: Händlerstore, API-Zugang, Zahlungsquelle und manuelle Auftragsfreigabe einrichten.
- [ ] Tatsächliche Varianten, Bestand, Versandarten und Kosten übernehmen; regelmäßig und vor Checkout abgleichen.
- [ ] Übergabe, Fehlerabgleich und echtes Tracking zunächst mit manuell unbestätigten Aufträgen prüfen.

**Abnahme:** Genau ein nachprüfbarer Podbase-Auftrag pro Bestellung.
Kostenpflichtige Musterfreigabe separat durch Jonas. Podbase testet in der
Produktionsumgebung; manuelle Freigabe verhindert die sofortige kostenpflichtige
Verarbeitung.
[Podbase-Anleitung](https://help.podbase.com/hc/en-us/articles/26709382744604-Podbase-API-integration-guide)

## 3. Druck und Muster – Bildschirmprüfung bestanden, Produktion offen

**Befund:** Vorschau und PNG stimmen überein, beim schwarzen Boot online
pixelgenau geprüft. Alle 888 Modell-/Motiv-/Hüllenart-Layouts halten die geprüfte
Geometrie ein. Diese verwendet illustrative Testschablonen; die Druckassets
bleiben `productionApproved: false`.

- [ ] Echte Podbase-Druckschablonen je veröffentlichter Variante übernehmen.
- [ ] Effektive Bildauflösung, Anschnitt, Kamera, Flip-Falz und Schrift auf realen Druckflächen prüfen.
- [ ] Muster bestellen und Druckfarben, Lesbarkeit, Material und Passform tatsächlich prüfen.
- [ ] Freigabe pro Modell-/Motivkombination dokumentieren.
- [ ] Die versprochene 10 × 15-cm-Kartenbeilage bei Podbase bestätigen und im Musterpaket prüfen.

Die Beilage ist eine Karte zum Selbstbeschriften, kein kaufbarer Gutschein.
Eine Bildschirmvorschau ersetzt keine Musterfreigabe.

## 4. Preise und Verkaufsinformationen – teilweise festgelegt

**Befund:** 29,90 € / 34,90 € einschließlich Deutschlandversand und Kartenbeilage
sind hinterlegt. Kleinunternehmerangabe gesetzt. Reale Kosten und verbindliche
Lieferzeiten fehlen.

- [ ] Hülle/Druck, Beilage, Versand, Zahlungsgebühren und zutreffende Steuern pro Variante erfassen.
- [ ] Ersatzlieferungen, Rückabwicklungen und laufende Hosting-/Mail-/Domainkosten berücksichtigen.
- [ ] Endpreise, Lieferzeiten, Reklamations- und Rücksendeadresse bestätigen.
- [ ] Rechnung, Zahlungsbeleg und Erstattungsablauf festlegen und prüfen.

**Abnahme:** Belegte Kalkulation und vollständige Käuferinformationen.

## 5. Rechtliche Angaben – offen, Entwürfe öffentlich sichtbar

**Befund:** Impressum, Datenschutz, AGB und Widerruf sind weiterhin Entwürfe.
Die Datenschutzerklärung behauptet lokale SQLite-Speicherung, obwohl der Shop
Neon/Vercel nutzt. Betreiberangaben fehlen. Diese öffentlichen Angaben sind
bereits vor weiteren öffentlichen Tests zu korrigieren.

- [x] Betreiberbezeichnung, Vertreter, Geschäftsanschrift und Archenlicht-Kontaktadresse durch Jonas bestätigt.
- [x] Kleinunternehmerregelung der Betreiber-GbR durch Jonas bestätigt.
- [ ] Rücksendeangaben und passende geprüfte Rechtstexte bereitstellen.
- [ ] Datenschutz auf tatsächliche Dienstleister, Zwecke, Fristen und Betroffenenrechte abstimmen; Verträge prüfen.
- [ ] Widerrufsbelehrung/Musterformular für Standard- und individuelle Waren einrichten; keinen pauschalen POD-Ausschluss behaupten.
- [ ] **Online-Widerrufsfunktion** mit Bestätigungsschritt und Eingangsbestätigung implementieren. Die Textseite genügt dafür nicht. [§ 356a BGB](https://www.gesetze-im-internet.de/bgb/__356a.html)
- [ ] Rechte an Motiven und verwendeter Bibelübersetzung für kommerziellen Druck dokumentieren; der Versbestand ist als Testquelle markiert.
- [ ] Hersteller-/Produkt-/Sicherheitsangaben mit Podbase klären. [GPSR, insbesondere Artikel 19](https://eur-lex.europa.eu/eli/reg/2023/988/oj/deu)
- [ ] Verpackungsverantwortung und Nachweise für das konkrete Liefermodell klären; keine automatische POD-Befreiung annehmen. [ZSVR](https://www.verpackungsregister.org/themen/versand-und-onlinehandel)

**Abnahme:** Rechtlich geprüfte Betreiber- und Produktangaben sowie passende
Funktionen im tatsächlichen Kaufweg.

## 6. Livezahlung und Betrieb – Umstellung erforderlich

**Befund:** Verfügbarer Stripe-Schlüssel erneut als Testschlüssel bestätigt;
Webhook aktiv mit `livemode=false`. Karte/Link sind im Testzugang verfügbar,
PayPal nicht. Damit ist der Livekontostatus nicht verifiziert. Ein Wechsel der
Dashboardansicht ändert den Shop nicht.

- [ ] Livekontofreigabe, Livezugang, eigener Live-Webhook und gewünschte Zahlungsmethoden prüfen.
- [ ] Livefähigen Adapter implementieren; erwarteten Modus strikt prüfen und Test-/Livekunden sowie Bestellungen trennen.
- [ ] Signatur-, Betrags-, Bestellbezug- und Duplikatprüfungen erhalten; Fehler-/Erstattungsfälle testen.
- [ ] Passwortwiederherstellung, E-Mail-Verifikation und dauerhafte Anmeldebegrenzung ergänzen. Bisherige Begrenzung gilt nur pro Sitzung im flüchtigen Serverspeicher.
- [ ] Test-/Vorschau- und Produktionsdatenbanken/Secrets trennen; die Vercel-Variablen gelten derzeit gemeinsam für Production, Preview und Development.
- [ ] Zeitnahe Hintergrundverarbeitung ohne offene Shopseite einrichten; der Cron läuft nur täglich.
- [ ] Backups, Aufbewahrung, Wiederherstellung und Fehleralarme praktisch nachweisen; ein vorhandener Datenbankdienst ersetzt keinen Wiederherstellungstest.
- [ ] **Hostingtarif:** CLI bestätigt `hobby`. Für den Verkauf einen kommerziell geeigneten Tarif oder Host wählen. Es wurde kein Upgrade beauftragt.

[Stripe-Livecheckliste](https://docs.stripe.com/get-started/checklist/go-live),
[Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Cron-Grenzen](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).

## 7. Gesamten Kaufweg abnehmen – Testteile bestanden, reale Kette offen

- [ ] Gast/Konto und feste/personalisierte Hülle auf Desktop und echtem Smartphone prüfen.
- [ ] Bestellung → Zahlung → genau eine Bestätigung → genau ein Podbase-Auftrag → realer Versand → Trackingmail.
- [ ] Abbruch, doppelte Webhooks, Mailausfall, Providerfehler und ausverkaufte Varianten kontrollieren.
- [ ] Musterqualität/Kosten durch Jonas bestätigen, Erstattung/Widerruf durchspielen.
- [ ] Testdaten von echten Verkaufszahlen trennen; erst danach ausdrücklich zum Verkauf freigeben.

## Nächste Arbeitsreihenfolge

1. Resend-Automatik samt zuverlässiger Hintergrundverarbeitung vorbereiten.
2. Parallel: Podbase-Zugang, Betreiberangaben/Rechtstexte und Hostingentscheidung durch Jonas.
3. Varianten/Schablonen anbinden, Kosten kalkulieren und Muster prüfen.
4. Rechtstexte, Widerrufsfunktion, Kontobetrieb und getrennten Live-Zahlungsbetrieb fertigstellen.
5. Vollständige Abnahme und ausdrückliche Verkaufsfreigabe.

Lokale Prüfbelege: `test-results/launch-audit/public-pages.json`,
`.tools/resend-receipt-evidence.json`, `.tools/launch-audit.mjs` sowie die
vorhandenen Design-/Kaufwegtests. Ignorierte Nachweise enthalten teilweise
technische Kontometadaten und werden nicht veröffentlicht.
