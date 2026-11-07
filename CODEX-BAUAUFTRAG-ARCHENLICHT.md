# Bauauftrag an Codex: Webshop Archenlicht

Baue für mich, Jonas, einen deutschsprachigen, mobil gut bedienbaren Webshop für christliche Handyhüllen mit Print-on-Demand-Anbindung an Podbase. Setze den Shop im bereitgestellten Projekt tatsächlich um und prüfe beide Kaufwege bis zum Versandstatus. Diese Datei enthält den Auftrag vollständig. Du brauchst keinen Zugriff auf den ursprünglichen Chat.

## Arbeitsweise und Ergebnis

- Prüfe zuerst Projektstruktur, vorhandenen Stack und lokale Projektanweisungen. Nutze vorhandene Technik, sofern sie passt. Bei einem leeren Projekt wähle einen wartbaren Stack für Shop, persistente Bestellungen, geschützte Konten und serverseitige Integrationen. Dokumentiere die Wahl kurz.
- Liefere eine lokal startbare Anwendung mit Testdaten, Startbefehlen und einer Beispielkonfiguration ohne Geheimnisse. Trenne Test- und Livebetrieb. Fehlende Händlerkonten, Druckdateien oder Lizenzen sollen die Entwicklung der übrigen Funktionen nicht aufhalten.
- Implementiere die Schnittstellen nach aktuellen offiziellen Dokumentationen. Prüfe die Abläufe mit Testzahlungen und einem lokalen Podbase-Testadapter. Kennzeichne simulierte Ergebnisse. Veröffentlichung, echte Zahlung und kostenpflichtige Produktionsaufträge sind separate Schritte.

## Marke und Startseite

Verbindliche Logo-Referenz: [Originalentwurf Nr. 2 – Archenlicht](Logoentwürfe/Archenlicht-02.png). Verwende den handschriftlichen Schriftzug mit dem geschwungenen Bootsrumpf aus der ersten Entwurfsrunde.

Verwende **Archenlicht** als zentral austauschbaren Arbeitsnamen. Der Auftritt ist ruhig, poetisch und verständlich. Nutze Warmweiß, Salbeigrün und tiefes Waldgrün. Kombiniere gut lesbare Bedienelemente mit handschriftlichen Verszeilen. Die Wortmarke trägt einen kleinen Bootsrumpf aus einem Linienzug. Sie erscheint im Shop, auf der Geschenkkarte und im Social-Media-Profil. Die Hüllen, ihre Produktvorschauen und ihre Druckdateien bleiben frei von Markenaufdrucken.

Zeige zuerst die fertige Kollektion. Platziere direkt daneben **„Hülle mit Wunschvers gestalten“**. Erkläre das Sortiment schon auf dem ersten Bildschirm, etwa mit „Christliche Handyhüllen mit deinem Vers“. Als poetische Zeile passt „Ein Vers für den Weg. Ein Stück Hoffnung für deinen Alltag.“ Sprich Eigenkäufer und Schenkende gleichermaßen an. Gestalte den gesamten Kaufweg auch für Besucher, die auf dem Smartphone über TikTok oder einen Gemeinde-QR-Code einsteigen.

## Sortiment und Preise

Verkaufe zunächst ausschließlich in Deutschland, in Euro, mit Versand innerhalb Deutschlands. Beide Testpreise sind Endpreise einschließlich Versand und der festen Kartenbeilage.

| Produkt | Preis | Auswahl |
|---|---:|---|
| Fertiges Vers-Motiv-Paar | 29,90 € | Design und exaktes Handymodell |
| Personalisierte Wunschvers-Hülle | 34,90 € | Handymodell, Versstelle, freigegebenes Motiv und optionale kurze Widmung |

Starte mit einer breiten Auswahl an iPhones und Samsung-Geräten und genau einem Hüllentyp, der **Podbase Tough-Standardhülle**. Veröffentliche eine Modell-Design-Kombination erst, wenn die konkrete Variante bei Podbase bestellbar ist und ihre Druckvorschau geprüft wurde. Sperre weggefallene Varianten auch in bestehenden Warenkörben vor Zahlung. Pflege Produkte im Projektkatalog. Ich liefere Motive und Versstellen, Codex ergänzt sie. Ein Produktpflege-Backend gehört nicht zum Startumfang.

### Die sechs festen Motive von „Ruhe und Geborgenheit“

| Titel für den Shop | Versstelle | Illustration |
|---|---|---|
| Unter seinen Flügeln | Psalm 91,4 | Ein schützender Flügel umrahmt die handschriftliche Versstelle. Einziger Drucktext ist „Psalm 91,4“. |
| Nach dem Sturm | Markus 4,39 | Unter einem kleinen Boot geht eine Welle in eine ruhige Linie über. |
| Absetzen | Matthäus 11,28 | Ein abgestellter Rucksack am Wegrand, die Träger locker am Boden. |
| Ganz nah | Psalm 131,2 | Ein Kind lehnt seine Wange an die Schulter seiner Mutter. Eine durchgehende Linie zeichnet beide. |
| Im Schatten | Psalm 121,5 | Eine offene Hand liegt im Schatten eines Blatts. |
| Getragen | Jesaja 40,11 | Ein kleines Lamm schaut aus der Gewandfalte eines Hirten. |

Verwende für die festen Motive als Grundgestaltung das Bild und die handschriftliche Versstelle. Die Arbeitstitel stehen auf den Produktseiten. Gib jedem Motiv eine stabile Adresse. Nutze bei fehlenden finalen Illustrationen klar gekennzeichnete Entwürfe im Testbetrieb. Verfolge ihre Druckfreigabe je Modell getrennt.

## Wunschvers, KI-Beratung und Druckvorschau

1. Ermögliche die Auswahl einer bekannten Versstelle oder den Einstieg **„Vers für meine Situation finden“**. Eine Situationsbeschreibung darf für den Kauf freiwillig bleiben.
2. Der Berater darf aus einem geprüften Bibelbestand über die sechs Kollektionstexte hinaus auswählen. Zeige bei erfolgreicher Empfehlung **drei unterschiedliche vorhandene Stellen**. Zu jeder gehört eine kurze, getrennt gekennzeichnete Erklärung des Bezugs zur Situation. Ein Klick übernimmt die Stelle in die Vorschau. Lade jedes Zitat wortgetreu aus der freigegebenen Quelle. Die KI wählt Stellen und erläutert sie.
3. Für den Druck auf personalisierten Hüllen nutze **einen kurzen Originalauszug plus Versstelle**, das gewählte Motiv und optional eine separate Widmung, etwa Name oder Datum. Bevorzuge verständliches, heutiges Deutsch. Übersetzung, Bezugsquelle und Rechte für digitale Nutzung und Produktdruck sind offen. BasisBibel und Hoffnung für alle sind Prüfkandidaten. Nutze bis zur Klärung geeignete Testdaten im Testbetrieb und sperre die entsprechende Livefunktion.
4. Halte die Situationsbeschreibung ausschließlich für die aktuelle Sitzung verfügbar, damit Kunden sie ändern können. Verwirf sie beim Sitzungsablauf. Halte sie aus URLs, Logs, Fehlerberichten, Analysen, Kundenkonto, Bestellungen und Podbase heraus. Prüfe auch die Speicherpraxis des eingesetzten KI-Dienstes vor Livebetrieb.
5. Fällt die Beratung aus oder fehlen passende Stellen, erkläre den jeweiligen Grund in einem kurzen Satz und zeige die sechs kuratierten Motive.
6. Erzeuge Vorschau und hochauflösende Druckdatei aus demselben versionierten Layout. Berücksichtige je Gerätemodell den Kameraausschnitt, Druckränder und lesbare Schrift. Wenn Text nicht hineinpasst, zeige eine konkrete Korrekturmöglichkeit. Übernimm nur die tatsächlich dargestellte Gestaltung in den Auftrag.

## Warenkorb, Bestellung und Versand

- Zeige pro Warenkorbposition Vorschau, genaues Gerät, vollständigen Drucktext einschließlich Widmung und Preis. **„Bearbeiten“** aktualisiert dieselbe Position. Ein separates Freigabe-Häkchen ist nicht vorgesehen.
- Ermögliche **Gastbestellung oder freiwilliges Kundenkonto**. Gäste erhalten einen persönlichen, geschützten Statuslink per E-Mail. Im Konto sieht jeder Kunde ausschließlich seine eigenen Bestellungen und deren Versandstatus.
- Biete **PayPal und Kartenzahlung** an. Nutze Anbieter-Testumgebungen und gehostete Zahlungsfelder oder Checkoutflächen. Prüfe Betrag, Währung, Bestellbezug und bestätigten Zahlungsstatus serverseitig. Eine Rückkehr auf die Erfolgsseite allein löst keinen Auftrag aus.
- Ermittle Produktvarianten über den Podbase-Katalog. Erzeuge bei bestätigter Zahlung genau einen Fulfillmentauftrag pro Shopbestellung mit allen Positionen. Übermittle über die dokumentierte API externe Bestell-ID, Produkt- und Varianten-ID, Versandart, benötigte Empfänger- und Lieferdaten sowie die direkte URL zur unveränderlichen Druckdatei je Position. Prüfe die tatsächlich vorgeschriebenen Felder einschließlich Telefonnummer. Bewahre API-Schlüssel serverseitig auf.
- Sichere die Übergabe dauerhaft gegen doppelte Zahlungsereignisse, parallele Verarbeitung und Neustarts ab. Bei unklarem Übermittlungsstatus zuerst mit Podbase abgleichen. Bei Ablehnung bleibt die bezahlte Bestellung offen. Informiere Jonas sofort per E-Mail mit Bestellnummer, verständlichem Fehlergrund und geschütztem Auftragslink.
- Rufe Produktionsstatus und Tracking regelmäßig ab. Stelle die Sendungsnummer im Konto und auf der Gaststatusseite bereit und versende die Versandmail einmalig. Nutze zum Abgleich die Anbieter-Auftragsnummer und die externe Bestell-ID. [Podbase Open API](https://open-api.podbase.com/api-docs/) · [Integrationsleitfaden und Musterprüfung](https://help.podbase.com/hc/en-us/articles/26709382744604-Podbase-API-integration-guide)
- Plane für alle Aufträge die feste, einseitige **10 × 15 cm große Geschenkkarte zum Selbstbeschriften** ein. Hinterlege die Aktivierung und Musterprüfung der festen Beilage in der Podbase-Einrichtung. Im Launch-Checkout gibt es kein Feld für einen gedruckten Kartentext. Diese Erweiterung kommt erst bei bestätigtem Versand im selben Paket. [Podbase-Kartenbeilage](https://help.podbase.com/hc/en-us/articles/26709214523676-Does-Podbase-offer-packing-inserts)

## Organische Herkunft und Auswertung

Das Werbebudget beträgt **0 €**. Videos entstehen außerhalb des Shops. Liefere stabile Produktseiten mit messbaren TikTok-Links und kennzeichenbare Gemeinde-QR-Links zur Versvorschau. Erfasse die Herkunft datensparsam und führe unbekannte Quellen gesondert auf.

Implementiere eine nur für Jonas zugängliche Auswertungsseite mit wählbarem Zeitraum. Zeige absolute Werte und zu jeder Quote ihren Nenner. Dokumentiere, wie ein Besuch, ein Warenkorbzugang, eine bezahlte Bestellung und ein verkauftes Stück gezählt werden. Vermeide Doppelzählungen durch Aktualisieren der Bestätigungsseite.

- Vergleiche fertige und personalisierte Hüllen sowie die sechs Motive einzeln. Weise Besuche mit Produktansicht, Warenkorbzugang und Kauf aus.
- Vergleiche Besuche und bezahlte Bestellungen nach TikTok, Gemeinde-QR und sonstiger oder unbekannter Herkunft.
- Frage nach Zahlung freiwillig „Für wen ist die Hülle?“ mit „Für mich“, „Als Geschenk“, „Beides“ und „Keine Angabe“. Führe den Kaufanlass getrennt von der Produktart.
- Ermögliche freiwilliges Feedback zu Kaufhürden wie Preis, fehlendem Modell oder Gestaltung. Leite aus einem Abbruch keinen vermeintlichen Grund ab. Verwende keine Versberater-Freitexte für Analysen. Für den Start genügt die geschützte Ansicht ohne CSV-Export.

## Abnahme und Übergabe

Prüfe die folgenden Wege am laufenden Shop, insbesondere im mobilen Layout. Berichte für jeden Weg, was wirklich getestet, was simuliert und was noch offen ist.

1. TikTok-Link → feste Flügelhülle → Modellwahl → Gastwarenkorb → PayPal-Testzahlung → ein simulierter Podbase-Auftrag → Statusmail und Tracking.
2. Gemeinde-QR → Situation → drei belegte Verse → Auswahl, Motiv und Widmung → Modellvorschau → Warenkorb bearbeiten → Kartentestzahlung → dieselbe Gestaltung in der Druckdatei. Prüfe auch Konto und Bestellhistorie.
3. Prüfe KI-Ausfall, unpassende Empfehlungen, zu langen Drucktext, weggefallene Variante, abgebrochene Zahlung, doppeltes Zahlungsereignis und unterbrochene Podbase-Antwort. Nach einer Podbase-Ablehnung müssen offener Fall und Benachrichtigung in der Testumgebung nachvollziehbar sein.
4. Prüfe Zugriffsgrenzen für fremde Bestellungen und Auswertung, das Verwerfen der Situationsbeschreibung und die Kennzahlen für beide Testkäufe. Trenne Testdaten von echten Verkaufszahlen.
5. Übergib Start- und Testanleitung, Konfiguration, Testergebnisse und eine kurze Liste der Live-Voraussetzungen mit Zuständigkeiten. Dazu gehören Markenname und Domain, Händlerkonten, Versand-E-Mail, Hosting, freigegebene Bibelquelle samt Nutzungsrechten, endgültige Druckassets, Geräteschablonen, Kartenmuster und reale Gesamtkosten. Bereite die benötigten deutschen Shop- und Informationsseiten vor. Jonas liefert Betreiberangaben und freigegebene Rechtstexte.

**Fertig für die technische Übergabe** ist eine startbare, durchgehend testbare Anwendung. **Fertig für den Verkauf** ist sie nach geklärten Live-Voraussetzungen und einem ausdrücklich freigegebenen Musterauftrag, dessen Druckbild, Kosten und Tracking geprüft wurden.
