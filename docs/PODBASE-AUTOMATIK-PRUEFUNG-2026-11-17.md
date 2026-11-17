# Automatische Podbase-Verarbeitung: Nachprüfung am 17. November 2026

## Ergänzende Korrekturen

- Ein Neustart während der Vorbereitung kann `sending` hinterlassen, obwohl
  noch kein Import versucht wurde. Maßgeblich ist jetzt der dauerhaft gespeicherte
  Versuchszähler unmittelbar vor dem POST. Bei `attempts=0` wird die Vorbereitung
  nach Ablauf der Sperre automatisch fortgesetzt. Bereits versuchte Importe werden
  weiterhin zuerst abgeglichen und nicht blind erneut angelegt.
- Eine von Podbase bestätigte Auftrags-ID wird unter der aktiven Auftragssperre
  sofort gespeichert, bevor eine weitere Statusabfrage beginnt. Unterbricht diese
  Abfrage, kann der Hintergrundlauf den Auftrag direkt über seine ID abrufen.
- Fehler einer lesenden API-Anfrage und Zugriffsprobleme werden nicht mehr als
  endgültige Ablehnung der bezahlten Bestellung eingestuft. Echte Ablehnungen oder
  Stornierungen des Anbieters bleiben Fälle mit Handlungsbedarf.
- `GET /api/jobs/status` liefert ausschließlich Laufzähler, Zeitpunkte und den
  tatsächlich gespeicherten Cloudflare-Alarm. Der bestehende geheime Job-Zugang
  ist erforderlich. Diese Abfrage führt selbst keine Bestellverarbeitung aus.

## Geprüfte Fälle

61 unterschiedliche Tests bestanden; ein zusätzlicher optionaler Neon-Test war
nicht aktiviert. Die Prüfungen verwenden isolierte lokale Daten und simulierte
Anbieter; sie erzeugen keine echten Zahlungen, E-Mails oder Druckaufträge.

- Beide Kaufwege, passende Produkt-/MagSafe-Variante und unveränderte Druckdatei.
- Öffentliche PNG-Rückrufe während eines laufenden Imports sowohl bei einer
  Anfrage als auch während des Cloudflare-Alarms, ohne gegenseitige Blockade.
- Fünf wartende bezahlte Aufträge, über mehrere Alarme abgearbeitet: exakt ein
  Anbieterauftrag je Bestellung. Parallele Worker und gleichzeitige Bestellungen.
- Neustart vor dem ersten POST, verlorene Antwort nach Annahme, gespeicherte
  Anbieter-ID mit anschließend fehlgeschlagener Statusabfrage.
- Wiederholte Zahlungsereignisse, Zahlungsbetrag/-zuordnung, aktive Sperren,
  Datenbankausfälle und dauerhaft geplanter Wiederholungsversuch.
- Bestellbestätigung, interne Fehlermeldung und Versandmail mit Tracking;
  wiederholte Aufrufe erzeugen keine doppelten Nachrichten.
- Ein unklarer, möglicherweise angenommener Import ohne Treffer bleibt erhalten,
  wird weiter abgeglichen und gemeldet. Keine automatische kostenpflichtige
  Doppelproduktion zur Umgehung der Unklarheit.

## Kontrolle im laufenden Shop

Produktionsbuild erfolgreich. Version
`d86d61a8-d0a0-475d-8dec-dceba48b8e0c` veröffentlicht; alle 16 vorhandenen Bindings
einschließlich Geheimnissen und bestehendem Durable Object vor Aktivierung geprüft.

Lesender Abgleich aller in der Datenbank hinterlegten Live-Checkouts mit Stripe:
eine bezahlte Bestellung, eindeutig einem Podbase-Auftrag zugeordnet, kein
Fehlerfeld. Bestellbestätigung und vorherige interne Fehlermeldung sind jeweils
einmal als zugestellt bestätigt. Stand 15:12 MEZ: Podbase noch `UNAPPROVED`.
Die vom Nutzer eingestellte Freigabe nach einer Stunde ist damit noch nicht als
ausgeführt belegt; auch Fertigung und Zustellung sind noch nicht nachgewiesen.

Die geschützte Diagnose bestätigt einen gespeicherten zukünftigen Alarm und keine
Fehlversuche des Hintergrundplaners. Zwischen zwei ausschließlich lesenden
Kontrollen stieg der Laufzähler selbstständig von 149 auf 150; der nächste
Abgleich wurde wieder gespeichert. Dabei wurde kein `/api/jobs`-Aufruf zum
Anstoßen verwendet. Zu diesem Zeitpunkt war kein Auftrag zum Abgleich fällig.
Private Prüfnachweise liegen im ignorierten
Ordner `test-results/fulfillment-recovery/`.

Diese Prüfungen sind keine Garantie für ausfallfreie Fremdanbieter oder jede
denkbare Last. Ein dauerhafter Anbieterfehler, eine tatsächliche Ablehnung oder ein
nicht auflösbarer Übertragungsausgang kann Betreiberhandeln erfordern. Bezahlte
Aufträge bleiben dabei gespeichert; die interne Fehlermeldung wird an Archenlicht
gerichtet. Kein neuer Liveauftrag wurde für diese Nachprüfung erstellt.
