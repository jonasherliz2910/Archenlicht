# Verkaufsstart am 16. November 2026

Archenlicht ist seit 20:48 Uhr MEZ unter https://www.archenlicht.de für
Bestellungen freigeschaltet. Die Hauptdomain https://archenlicht.de leitet
einschließlich Pfad und Query auf www um.

Der Nutzer hat ausdrücklich um den sofortigen Verkaufsstart gebeten und
bestätigt, die bestehende Preisgestaltung unverändert lassen zu wollen.
Die zuvor erläuterte Frage der durchgestrichenen zukünftigen Vergleichspreise
ist damit keine rechtliche Freigabe; die Darstellung wurde nicht geändert.
Eine zusätzliche externe Backupkopie wurde auf Nutzerwunsch zurückgestellt.
Das verschlüsselte lokale Backup und der erfolgreiche Wiederherstellungstest
bleiben erhalten. Es wurde kein kostenpflichtiger Dienst gebucht.

## Freigabe

- Cloudflare-Worker: `archenlicht-shop`.
- `CHECKOUT_ENABLED=true` und `PODBASE_SUBMISSION_ENABLED=true` gemeinsam
  in einer neuen Version veröffentlicht.
- Version: `6eae40e6-a636-430d-a84d-807d49b7303e`, 100 Prozent Traffic.
- Deployment: `0f3ff447-7801-4457-b49d-4db28d55b82f`.
- Vorgängerversion: `c6cc3592-a042-4419-93f9-7e5704399930`.
- Code, Assets, übrige Secret-Bindings und Durable-Object-Zuordnung unverändert;
  vor Veröffentlichung anhand der Cloudflare-Versionen abgeglichen.
- Die ignorierte lokale Produktionskonfiguration enthält ebenfalls die beiden
  aktivierten Schalter, damit ein späterer Abgleich sie nicht versehentlich schließt.
- Keine Podbase-Store-Einstellungen geändert. Die vom Nutzer bestätigte manuelle
  Produktionsfreigabe bleibt maßgeblich: bezahlte Shopbestellungen werden
  übergeben; der Betreiber muss sie bei Podbase zur Produktion freigeben.

## Prüfung vor und nach der Umschaltung

Stripe bestätigte unmittelbar vor Freigabe aktive Live-Zahlungen und
Auszahlungen. Der Live-Webhook unter der öffentlichen www-Shopadresse ist
aktiv und abonniert die vier benötigten Checkout-Ereignisse. Podbase lieferte
den echten Katalog mit 28 Produktgruppen. Keine offenen alten Livebestellungen
vorhanden, die durch Aktivierung unbeabsichtigt weiterverarbeitet würden.

Nach Veröffentlichung bestätigen die öffentliche Health- und Bootstrap-API:
Livebetrieb, Checkout aktiv, echte Stripe-Zahlungen und echte Podbase-Übergabe,
keine Zahlungssimulation und keine Fulfillment-Simulation. Die Modellauswahl
verwendet jetzt die Live-Freigaben. 67 Standard- und 41 Magnetmodelle bleiben
für die sechs Motive freigegeben (402 bzw. 246 Kombinationen). Die sieben
zurückgestellten Modelle ohne ausreichend belegte Druckkontur bleiben gesperrt.

Startseite, Kollektion, Produkt, Bundle, Personalisierung, Kasse und Rechtstexte
antworten öffentlich mit HTTP 200. Ein leerer Warenkorb wird regulär abgelehnt,
statt eine geschlossene Kasse zu melden. Unsig­nierte Stripe-/Resend-Webhooks
bleiben gesperrt; der Jobs-Endpunkt verlangt weiterhin Authentifizierung.

Separater Headless-Edge-Browsercheck mit 390 und 1440 Pixel Breite:
Nach dem Sturm, iPhone 14 Pro, Hellblau und MagSafe lassen sich auswählen
und für 34,99 EUR in den Warenkorb legen. Die Kasse öffnet sich und bietet
den aktivierten Button „Weiter zur Zahlung“. Keine JavaScript-Fehler und kein
horizontaler Überlauf. Der Gewährleistungshinweis wurde nach vollständigem
Bildladen zusätzlich visuell geprüft. Der eigene Prüf-Warenkorb wurde geleert.
Der Browser blockierte absichtlich POST auf `/api/checkout`: keine neue
Live-Zahlung, Bestellung, Bestellmail oder Podbase-Produktion durch diesen Check.

Die zuvor erfolgreich abgeschlossene echte Stripe-Sandboxzahlung und real
zugestellte Bestellmail sind in `ZAHLUNGSABNAHME-2026-11-16.md` dokumentiert.
Es wird keine schon erfolgte Live-Kundenzahlung oder neue tatsächliche
Podbase-Lieferung behauptet.

Nachweise ohne Veröffentlichung von Zugangsdaten liegen ignoriert unter
`test-results/shop-launch/`: `preflight.json`, `prepared-version.json`,
`verification.json`, `browser.json` sowie Browserbilder. Hilfsskripte dort
nicht blind erneut ausführen: die vorbereitenden Skripte erwarten den
geschlossenen Ausgangszustand.

## Betrieb

Eingehende bezahlte Bestellungen im Adminbereich und bei Podbase kontrollieren
und bei manueller Freigabe rechtzeitig bestätigen. Die bestehenden dauerhaften
Hintergrundjobs übernehmen Statusabgleich, Mailwiederholungen und Tracking.
Externe/regelmäßige Sicherungen und die Prüfung des zuletzt ausgebliebenen
GitHub-Build-Auslösers bleiben als dokumentierte Betriebsaufgaben bestehen;
der aktive Worker läuft unabhängig vom geöffneten PC.

Bei einem tatsächlichen technischen Problem können beide Verkaufsschalter
gemeinsam auf `false` gesetzt werden. Bereits bezahlte Aufträge müssen dabei
gesondert kontrolliert werden; ein Rollback ist kein Storno oder Refund.
