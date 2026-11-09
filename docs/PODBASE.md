# Podbase-Anbindung

Geprüfter Stand: 9. November 2026. Dieser Bericht aktualisiert die Podbase-
und Druckangaben der älteren Live-Checkliste; er ist keine Verkaufsfreigabe.

## Aktiver Onlinebetrieb

- `https://www.archenlicht.de`, Vercel-Team `jonas-4eb6`, Projekt `archenlicht`.
- Echter Katalogzugriff mit serverseitigem Schlüssel: `PODBASE_MODE=catalog`.
- `GET /catalog` und `GET /orders` erfolgreich authentifiziert. Beim Abgleich
  waren im verbundenen Podbase-Store noch keine Aufträge vorhanden.
- 74 Standardmodelle und 47 magnetische Varianten aktuell lagernd und zugeordnet.
- `PRINT_MODE=podbase` ist jetzt ausschließlich für Vercel Production gesetzt.
  Original-Druckvorlagen liegen für 63 Standardmodelle und 37 MagSafe-Modelle vor.
  Modelle ohne passende Vorlage sind nicht kaufbar, auch nicht durch direkte
  manipulierte Warenkorbanfragen. Alte Warenkörbe bleiben erreichbar/bearbeitbar.
- Feste Motive, eigene Texte, Farben und MagSafe bleiben im Auftragsabbild erhalten.
  Die Druckdatei verwendet die zur tatsächlich gewählten Variante gehörende Vorlage.
- Die öffentliche PNG ist 2000 × 3400 Pixel bei 300 dpi; Motiv und Schrift werden
  gegen Sicherheitskontur und Kamera geprüft. Die Hüllendarstellung bleibt schematisch.
- `SHOP_MODE=test`, `PAYMENT_MODE=sandbox`; automatische Anbieterübermittlung
  bleibt deaktiviert. Ein Katalogzugriff ist noch keine fertige Auftragsanbindung.

## Echte Testübergabe bestanden, keine Produktionsfreigabe

Jonas bestätigte am 9. November erneut `Order approval: Manually` und lieferte
die Kontakttelefonnummer für den vorbereiteten Verbindungstest. Die frühere
Bitte, noch kein kostenpflichtiges Muster zu bestellen, bleibt maßgeblich.

Übermittelt nach ausdrücklicher Freigabe: eine Standardhülle für iPhone 14 Pro, Motiv „Nach dem Sturm“,
Hellblau. Die aktuelle öffentliche Druckdatei wurde einschließlich Abmessungen,
Prüfsumme, Bestand und Produkt-/Variantenbezug geprüft. Der Entwurf ist als
`INTEGRATIONSTEST - NICHT FREIGEBEN` gekennzeichnet. Kontaktdaten und genaue
Anfragedaten liegen ausschließlich in ignorierten lokalen Dateien.

Jonas hat den konkreten unfreigegebenen Verbindungstest ausdrücklich genehmigt.
Der einmalige POST wurde von Podbase angenommen; anschließend wurden Produkt,
Variante, Stückzahl, unveränderte Druckdatei, Kontakt- und Lieferdaten per GET
abgeglichen. Der Anbieterstatus ist bestätigt **UNAPPROVED**. Eine spätere
erneute GET-Suche findet denselben Auftrag; es gab keine erneute Übermittlung.
Externe Referenz: `AL-INTEGRATION-20261109-01`. Der Auftrag bleibt im Dashboard
liegen, bis Jonas ihn prüft und später ggf. storniert; niemals automatisch freigeben.

Podbase besitzt keine getrennte kostenlose Sandbox. Bei
manueller Freigabe bleiben importierte Aufträge laut Anbieter `UNAPPROVED`;
eine spätere Freigabe würde die kostenpflichtige Bearbeitung auslösen.

Das vorbereitete Übergabewerkzeug prüft vor einem möglichen Import den
gespeicherten Entwurf, die öffentliche Bildprüfsumme, den aktuellen Bestand und
bereits vorhandene Aufträge. Es schreibt vor dem einmaligen POST einen
dauerhaften lokalen Versuchsnachweis. Ein unklarer Ausgang wird nur abgeglichen,
nicht automatisch erneut gesendet. Es gibt keine automatische Produktionsfreigabe.
Die Testübergabe gehört nicht zum Kundencheckout und erzeugt keine Shopumsätze.

Bei dieser echten Übergabe wurde festgestellt, dass Podbase die externe ID in
der Antwort um die Store-Kennung ergänzt. `PodbaseAPI` normalisiert deshalb
nur das ausdrücklich konfigurierte `storeId`-Präfix, erhält die Rohkennung als
`providerExternalOrderId` und gleicht alle Seiten auf Duplikate ab. Fremde
Store-Präfixe und ähnlich endende Kennungen werden nicht zugeordnet. Der spätere
Live-Worker muss die verifizierte Store-Kennung beim Erzeugen des Adapters übergeben.

## Im Dashboard belegte Kosten

Jonas zeigte am 9. November 2026 die Detailansicht von `PBO-4SQ-2V5-2TK5`.
Status weiterhin `Unapproved`; Standardhülle iPhone 14 Pro, SKU `IP14P-GL-T`,
Menge 1, Economy Delivery nach Deutschland. Der Screenshot nennt:

| Position | Betrag |
| --- | ---: |
| Hülle / Subtotal, vor Umsatzsteuer | 9,95 € |
| Shipping & Handling, vor Umsatzsteuer | 3,95 € |
| Umsatzsteuer gesamt (19 %) | 2,64 € |
| Grand Total | **16,54 €** |

Die 1,89 € Umsatzsteuer in der Produktzeile sind bereits in den 2,64 €
Gesamtsteuer enthalten und werden nicht zusätzlich addiert. Beim aktuellen
Shoppreis von 29,99 € ergibt sich für genau diesen Auftrag eine Differenz von
13,45 € vor Zahlungsgebühren, weiteren Kosten und möglichen Rückabwicklungen.
Die Kalkulation belegt weder andere Modelle/Hüllenarten noch Mehrstückversand
oder eine Kartenbeilage. Der Screenshot nennt `WALLET` als Zahlungsart; daraus
folgt keine bestätigte Abbuchung von der zuvor hinterlegten Karte.

Jonas zeigte anschließend die leere Liste unter `Products / My Products`.
Der Weg über diese Liste ermöglicht für den unfreigegebenen API-Testauftrag
keine Bildprüfung. Der konkrete Grund für den fehlenden Produkteintrag ist
nicht verifiziert; es wird kein zusätzliches manuelles Produkt angelegt.
Der direkte erneute API-Abgleich bestätigt weiterhin denselben Auftrag,
Status UNAPPROVED, die zugeordnete Druckdatei-URL sowie die unveränderte,
öffentlich abrufbare PNG-Prüfsumme. Damit ist die Dateizuordnung belegt,
nicht die physische Druckqualität oder eine bereits erfolgte Verarbeitung.

## Noch offen

1. Aktive Zahlungsquelle in Podbase prüfen. Der Auftrag nennt WALLET; Jonas
   hatte zuvor eine Karte hinterlegt. Keine Aufladung, Zahlung oder Freigabe
   ist für diese Prüfung beauftragt.
2. Weitere Varianten, MagSafe und Mehrstück-/Bundle-Versand kalkulieren;
   die Kosten für die einzelne Standardhülle sind oben belegt. Das `price`-Feld
   im API-Auftrag ist ein Referenz-Verkaufspreis, keine Kostenabfrage.
3. Reale Auftragsverarbeitung mit bezahlten Livebestellungen verbinden, Test-
   und Liveaufträge trennen, manuelle Freigabe korrekt anzeigen sowie Ablehnung,
   Abbruch, unbekannte Antworten und Tracking behandeln. Der jetzige Shop-Worker
   verwendet ausdrücklich weiterhin `LocalPodbase`.
4. Zeitnahe Hintergrundabfragen und echte Versandmails abnehmen. Die API bietet
   derzeit GET-Auftragsabfragen, aber keinen dokumentierten Tracking-Webhook.
5. Fehlende Vorlagen, physische Druckqualität und vereinbarte Produktbeilagen
   vor entsprechender Verkaufsfreigabe klären. Kein physisches Muster wurde bestellt.

Stripe-Livefreigabe und die übrigen Startvoraussetzungen bleiben separate Aufgaben.

## Prüfungen

- 14 zusätzliche Tests: Katalog, Ausfall-/Bestandsprüfung, MagSafe-Zuordnung,
  sämtliche 37 magnetischen Druckvorlagen mit allen Motiven und Wunschtext,
  Auftragsdaten und Produktionssperren.
- Standard-Druckvorlagen und Kaufwege wurden unmittelbar zuvor mit 28 bestandenen
  Tests unter der aktualisierten Bildbibliothek geprüft.
- Bereitgestellte Version und öffentliche Domain: feste Standardhülle,
  personalisierte Standardhülle und personalisierte MagSafe-Hülle jeweils vom
  API-Entwurf bis zur anonym abrufbaren PNG und zum Warenkorb geprüft.
  Fehlende Vorlage wird mit HTTP 409 gesperrt. Temporäre Testwarenkörbe geleert.
- Aktuelle OpenAPI-Beschreibung stimmt mit dem vorhandenen Schema vom 3. November
  überein; unterstützt werden Katalog, Auftrag anlegen und Aufträge abfragen.
- Zwei zusätzliche Abgleichtests bestanden: tatsächliches Store-Präfix,
  fremde/ähnliche Kennungen, Duplikate über Seitengrenzen und unvollständige Antworten.
- Desktop und Mobilansicht mit Original-Druckvorschau visuell geprüft; MagSafe
  erhält Modell und Farbe, fehlende Vorlagen sind im Auswahlfenster deaktiviert.
- Genau ein genehmigter externer Testauftrag, Status UNAPPROVED. Keine echte
  Zahlung, keine Shop-Bestellung und keine Produktionsfreigabe ausgelöst.

Nachweise (ignoriert): `.tools/podbase-readiness-2026-11-09.json`,
`.tools/podbase-print-configuration.json`, `.tools/podbase-print-public.json`,
`.tools/podbase-test-order-review.json`, `test-results/podbase-print-live/`.
Der echte Annahme-/Abgleichnachweis liegt in `.tools/podbase-test-handoff-state.json`;
die private Anbieterantwort wird nicht veröffentlicht.

Quellen: [Podbase-Integrationsanleitung](https://help.podbase.com/hc/en-us/articles/26709382744604-Podbase-API-integration-guide),
[OpenAPI](https://open-api.podbase.com/api-docs/),
[Druckdateianforderungen](https://help.podbase.com/hc/en-us/articles/26709497957532-How-to-prepare-print-files-for-Podbase-API).
