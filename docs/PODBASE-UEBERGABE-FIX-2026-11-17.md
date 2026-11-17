# Podbase-Übergabe am 17. November 2026

Eine bezahlte Livebestellung blieb nach einer unterbrochenen Übertragung im
Zustand `uncertain`. Die Zahlung war bei Stripe vollständig bezahlt und nicht
erstattet; bei Podbase war bei mehrfacher vollständiger Suche kein zugehöriger
Auftrag vorhanden. Die Bestellung und ihre Druckdatei waren in der Shopdatenbank
erhalten. Kunden- und Zugangsdaten gehören nicht in dieses Dokument.

## Korrektur

- Cloudflare serialisierte sämtliche Anfragen und Hintergrundläufe über dieselbe
  Warteschlange. Damit konnte der vom Druckpartner während des Bestellimports
  benötigte Druckdatei-Abruf hinter dem noch laufenden Import warten. Exakte
  unveränderliche Druckdateipfade dürfen bei GET/HEAD jetzt parallel antworten.
  Geschäftsaktionen, sonstige Pfade und Hintergrundläufe bleiben serialisiert.
- Produktions-PNGs werden vor dem Import fertiggestellt und gespeichert.
- Podbase darf laut OpenAPI beim Anlegen nur `orderId` zurückgeben. In diesem
  Fall liest der Adapter anschließend den tatsächlichen Auftrag und Status ab.
- Interne Fehlerprotokolle enthalten nun Phase, Bestell-ID, Fehlertyp und
  HTTP-Status, ohne Zugangsdaten oder Lieferdaten zu protokollieren.
- Die Schutzmechanismen gegen doppelte Übergaben bleiben aktiv: vollständiger
  Anbieterabgleich, exakte externe ID, Lease und genau ein zulässiger POST.
  Ein unklarer Ausgang wird weiterhin nur abgeglichen, nicht blind wiederholt.

## Wiederherstellung der bestehenden Bestellung

Nach Prüfung von Zahlung, fehlender Erstattung, aktuellem Variantenbestand,
unverändertem Bestellabbild und öffentlicher Druckdatei wurde ausschließlich der
betroffene Auftrag einmal kontrolliert erneut bereitgestellt. Vorher erfolgte
eine erneute vollständige Suche bei Podbase. Ein lokaler einmaliger Nachweis
verhindert das versehentliche erneute Ausführen dieses Wiederherstellungsschritts.

Der korrigierte Live-Worker hat den Auftrag übergeben. Die erste Antwort blieb
zunächst unklar; der anschließende lesende Abgleich fand exakt einen Auftrag und
verknüpfte ihn mit der bestehenden Shopbestellung. Kein zweiter Import wurde
ausgeführt. Empfänger, Adresse, Versandart, Produkt, Variante, Stückzahl und
Druckdatei stimmen mit der bezahlten Bestellung überein.

Stand 14:50 MEZ: Podbase `UNAPPROVED`, Shop `awaiting_approval`, Anbieter-ID
gespeichert und Fehlerfeld leer. Die Bestellung ist über die Admin-Kundendetails
abfragbar. Jonas bestätigte anschließend die automatische Podbase-Freigabe nach
einer Stunde. Die Produktionsfreigabe und der spätere Versand sind damit noch
nicht nachgewiesen und dürfen nicht als abgeschlossen dargestellt werden.

## Prüfung und Bereitstellung

- 25 relevante Tests bestanden, ein optionaler Neon-Integrationstest ohne
  separat konfigurierte Testdatenbank übersprungen. Darunter: paralleler
  Druckdatei-Rückruf während laufender Bestellübertragung, Warteschlangengrenzen,
  Neustart, verlorene Antwort, Duplikatschutz, Zahlungsprüfung und Tracking.
- Ein veralteter Testfall für ein gesperrtes Modell verwendet jetzt iPhone 17e;
  iPhone 18 Pro besitzt inzwischen eine Vorlage. Keine Modellfreigabe geändert.
- Web- und Cloudflare-Produktionsbuild erfolgreich.
- Onlineversion `9de22e07-ef98-4403-82fd-ce1528092ef4`; sämtliche 16 bestehenden
  Bindings einschließlich Datenbank, Schlüsseln und Durable Object erhalten.
- Private Prüf- und Wiederherstellungsnachweise liegen ausschließlich im
  ignorierten Ordner `test-results/fulfillment-recovery/`.

Die ursprüngliche Zusage einer vollständig bewiesenen Livekette war zu weitgehend.
Dieser Vorgang belegt nun die tatsächliche Übergabe dieser Bestellung. Die
physische Fertigung und Zustellung sind weiterhin über Podbase zu verfolgen.
