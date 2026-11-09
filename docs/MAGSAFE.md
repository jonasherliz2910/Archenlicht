# Optionale magnetische Hüllen

Stand: 9. November 2026. Die Preise entsprechen Jonas' Auftrag:

| Gestaltung | Standard | MagSafe-kompatibel |
|---|---:|---:|
| Kollektion | 29,99 € | 34,99 € |
| Personalisiert | 34,99 € | 39,99 € |

Das Häkchen ändert ausschließlich `configuration.magsafe`. Motiv, Farbe,
Handymodell, eigener Text bzw. gewählter Vers und Widmung bleiben erhalten.
Der Server berechnet den Preis; Preise und Produkt-IDs aus Kundeneingaben
werden nicht übernommen. Bestehende Bestellsnapshots werden nicht umgeschrieben.

## Produktzuordnung

`server/podbase-magsafe-map.json` wurde aus einem ausschließlich lesenden Abruf
von `https://open-api.podbase.com/catalog` erzeugt. Es enthält die exakten IDs
für 27 iPhone-Modelle unter `MagSafe Tough Phone Case` (`PBP-37-2FY-223Z`) und
20 Samsung-/Google-Modelle unter `Magnetic Tough Phone Case` (`PBP-4HU-2II-223I`).
Der aktuelle Bestand wird getrennt je Hüllenart geprüft, beim Checkout erneut.
Fehlende, umbenannte oder ausverkaufte Varianten werden nicht durch normale
Hüllen ersetzt. Ein Modellwechsel entfernt keinen gesetzten Haken; bei einer
nicht verfügbaren Kombination muss der Kunde die Auswahl selbst ändern.

Warenkorb, Checkout, gespeicherte Bestellung, Stripe-Positionen und Mailvorlagen
zeigen die Hüllenart. Die Podbase-Payload übernimmt Produkt-ID und Varianten-ID
aus dem serverseitigen Bestellsnapshot und die unveränderliche Druckdatei.

## Druck und Betriebsgrenzen

Die bisherige Vorschau bleibt beim Umschalten bildgleich. Für den vorbereiteten
Modus `PRINT_MODE=podbase` wurden zusätzlich 37 magnetische Varianten anhand
der offiziellen Druckanforderungen und gemeinsamen Geräteschablonen zugeordnet.
Zehn weitere magnetische Varianten besitzen in den vorliegenden Unterlagen
keinen vollständigen Nachweis und sind in diesem Druckmodus gesperrt.
Die Prüfungen decken alle sechs Motive und einen mehrzeiligen Wunschtext ab.

Der öffentliche Shop bleibt im bisherigen Testbetrieb. Diese Änderung aktiviert
weder Livezahlungen noch kostenpflichtige Podbase-Produktion. Das ist weiterhin
Teil der gesonderten Startvorbereitung; siehe `STARTVORBEREITUNG-2026-11-09.md`.

## Prüfung

- Vier Preise, abgewiesene manipulierte Angaben, Standard-/MagSafe-Umschaltung.
- Unveränderte Gestaltung für alle 47 zugeordneten Modelle, einschließlich
  freiem Text, vorgeschlagenem Vers, Farbe und Widmung.
- 259 Kombinationen auf 37 magnetischen Original-Druckvorlagen.
- Gemischter Warenkorb, Bearbeitung, immutable Bestellsnapshots, lokale
  Zahlungsbestätigung, einmaliger simulierter Druckauftrag und genaue Payload.
- Bestandswechsel vor Zahlung sowie fehlende und falsche Varianten.
- Stripe-Anfrage und Mailinhalt mit lokalen Providerantworten; kein Mailversand.
- Browser: 320/390/1440 Pixel, normale und personalisierte Produkte, Preise,
  Modellwechsel, Warenkorb, Bearbeitung und Kasse; keine Bestellung ausgelöst.

## Primärquellen

- [MagSafe Tough Phone Case](https://www.podbase.com/custom/tech-accessories/magsafe-tough-phone-case)
- [Magnetic Tough Phone Case](https://shop.podbase.com/products/magnetic-tough-phone-case)
- [Podbase Druckanforderungen](https://help.podbase.com/hc/en-us/articles/26709497957532-How-to-prepare-print-files-for-Podbase-API)

Die magnetische Befestigung ergänzt kein kabelloses Laden bei Geräten, die
dieses nicht unterstützen. Der Shop weist bei der Auswahl darauf hin.
