# Stripe-Liveintegration – 10. November 2026

## Verifizierter Kontostand

Das Livekonto `acct_1UZFl50jS9LUiVLq` gehört zu Herzly Marketing GbR.
Stripe meldet `charges_enabled=true`, `payouts_enabled=true` und aktive
Kartenzahlungen. Der eingeschränkte Liveschlüssel ist lokal und in Vercel
Production als Secret hinterlegt. Schlüsselwerte gehören nicht in Git.
Die Live-Zahlungsmethoden-Konfiguration ist `pmc_1UZFlc0jS9LUiVLqJuu5ZRt4`.
Kartenzahlung ist verfügbar; PayPal ist in diesem Konto nicht aktiviert.

Ein **unbezahlter** Live-Checkout wurde mit dem echten Schlüssel erstellt und
danach geschlossen: zwei Positionseinheiten à 39,99 €, 5 % Bundle-Rabatt
(4,00 €), Endbetrag 75,98 €, EUR, kein separater Umsatzsteuerbetrag.
Freiwillige Kartenspeicherung und Abruf der gespeicherten Karten funktionieren.
Die Prüfung erzeugte keine Zahlung und keinen Podbase-Auftrag. Prüfkunde und
temporärer Rabatt wurden gelöscht. Der Checkout ist abgelaufen.

Die Kleinunternehmerbehandlung bleibt nach Betreiberangabe unverändert:
`automatic_tax=false`, Hinweis auf § 19 UStG. Es wurde keine steuerliche
Registrierung erstellt oder eine Steuerpflicht neu bewertet.

## Technisch implementiert

- Getrennte Test-/Live-Schlüssel, Stripe-Kunden, Bestellungen, Zahlungsbelege,
  Mailaufträge und Fulfillmentverarbeitung; keine Übernahme alter Testaufträge.
- Checkout kann ausdrücklich geschlossen bleiben. Ein offener Livecheckout
  verlangt aktivierte Auftragsübergabe und freigegebene Modell-/Motivvarianten.
- Signierte Stripe-Ereignisse werden durch erneuten API-Abruf verifiziert:
  Bestellung, Betrag, Währung, Zahlungsstatus, Kunde und Steuerbehandlung.
- Zahlungsereignisse und Lieferaufträge werden dauerhaft und einmalig gespeichert.
  Vercel `waitUntil` übernimmt den ersten Bearbeitungslauf; eine Unterbrechung
  löscht keinen Auftrag aus der Datenbank.
- Podbase erhält echte Produkt-/Varianten-IDs und unveränderliche PNG-Druckdateien
  anhand der Originalvorlage. Gewählter Text, Farbe und MagSafe bleiben erhalten.
- `UNAPPROVED` bedeutet **wartet auf Freigabe**, nicht „in Produktion“.
  Es gibt keinen automatischen Aufruf zur kostenpflichtigen Produktionsfreigabe.
  Die Einstellung „Manually“ im Podbase-Store muss bestehen bleiben.
- Bei einer verlorenen Übergabeantwort wird zuerst die externe Bestell-ID
  abgeglichen; es gibt keine blinde zweite Auftragserstellung. Worker mit
  abgelaufener Sperre dürfen keinen verspäteten POST mehr ausführen.
- Bestellbestätigung nach verifizierter Zahlung, Versandmail erst nach
  `FULFILLED` mit Sendungsnummer, Fehlerhinweise an info@archenlicht.de.
  Resend-Nachweise und dauerhafte Idempotenz bleiben bestehen.
- Teststeuerungen sind im Livebetrieb serverseitig gesperrt. Im Adminbereich
  können Bestell- und Versandstatus ausdrücklich abgeglichen werden.

## Prüfungen

Lokale Tests mit isolierten Anbieterantworten decken beide Kaufwege,
MagSafe/Freitext/Farbe, Rabatte, falsche Beträge, Test-/Live-Verwechslungen,
Webhook-Wiederholungen, manuelle Produktionsfreigabe, verlorene Antworten,
Versandmails und einen geschlossenen Checkout ab. Die bestehende Testsammlung
für Drucklayouts, Konten, Newsletter und Sicherheitsgrenzen wurde ebenfalls
ausgeführt; eine abweichende Fehlermeldung wurde korrigiert und nachgeprüft.

Zusätzlich bestand der Live-Ablauf mit simulierten Stripe-/Podbase-/Resend-
Antworten auf einer **echten isolierten Neon-Testdatenbankstruktur**, einschließlich
neuer Serverinstanz. Diese Teststruktur wurde anschließend entfernt.

## Bereitstellung und Freigabeschalter

Projekt: `jonas-4eb6/archenlicht`, Domain: `https://www.archenlicht.de`.
Production ist für die technische Vorbereitung auf `SHOP_MODE=live`,
`PAYMENT_MODE=live`, `PODBASE_MODE=production`, `PRINT_MODE=podbase`,
`MAIL_MODE=resend` eingestellt. Preview/Development behalten Testzugänge;
die gemeinsam gespeicherten Umgebungsvariablen wurden dafür ausdrücklich
nach Zielumgebung getrennt.

**CHECKOUT_ENABLED=false und PODBASE_SUBMISSION_ENABLED=false bleiben gesetzt.**
Es werden keine Live-Varianten automatisch freigegeben. Der Shop zeigt
„Verkaufsstart in Vorbereitung“. Die Umstellung allein erlaubt keine Käufe.

Live-Webhook: `we_1UaHJy0jS9LUiVLqSrykrcc7`, Ziel
`https://www.archenlicht.de/api/webhooks/stripe`, API `2026-10-28.endive`.
Ereignisse: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`.
Der Live-Webhook wurde nach Prüfung des bereitgestellten Handlers aktiviert.
Ein korrekt signiertes Diagnoseereignis ohne existierende Bestellung wird mit
HTTP 200 ignoriert, falsche Signaturen mit 401 und Testereignisse mit 400
abgewiesen. Der ehemalige Sandbox-Webhook auf der nun umgestellten öffentlichen
Domain wurde deaktiviert. Ein vollständiger Zahlungsnachweis über einen
tatsächlich bezahlten Live-Checkout steht weiterhin aus.

Veröffentlichtes Deployment:
`https://archenlicht-k3yok6314-jonas-4eb6.vercel.app`,
`dpl_AVjbAKZG7JLqVwhmvi3tNWDf6gpu`, Code `fc444d8`.
Die geschützte Bereitstellung bestand vor Promotion die Prüfung von Bootstrap,
Checkout-Sperre, Signaturen und geschütztem Worker. Die Produktionsdatenbank
enthielt danach unverändert acht Testbestellungen, davon drei bezahlt, und
keine Livebestellungen. Es wurden keine Varianten auf Livefreigabe umgestellt.
Die öffentliche Seite bestand anschließend 16 Browserprüfungen bei 360, 390 und
1440 Pixeln: Startseite, Produkt, Personalisierung, Konto, geschlossene Kasse
und MagSafe-Warenkorb. Keine JavaScript-Fehler oder horizontalen Überläufe.
Die Screenshots liegen lokal unter `test-results/live-release/`.

## Vor öffentlichem Verkauf weiterhin offen

1. Verbindliche Rechtstexte und Versand-/Rückgabebedingungen ersetzen die
   öffentlich sichtbaren Arbeitsentwürfe. Die technischen Änderungen sind keine
   rechtliche Freigabe dieser Entwürfe.
2. Reale Druck- und Musterprüfung sowie ausdrückliche Freigabe der angebotenen
   Modellvarianten. Das MagSafe-Muster ist vorbereitet, aber nicht durch uns bestellt.
3. Kartenbeilage: Aktivierung vom Betreiber bestätigt; **eine Karte je Hülle**
   bei Mehrfachbestellungen ist noch nicht durch Podbase belegt.
4. Produktions-/Versand-/Karten-/Zahlungskosten und Lieferzeit abschließend prüfen.
5. Häufige automatische Status-/Mailwiederholungen und einen für kommerziellen
   Verkauf geeigneten Hostingtarif einrichten. Der derzeitige Vercel-Cron läuft
   einmal täglich; unmittelbare Bearbeitung bei Zahlung und manuelle Abfrage
   ersetzen keinen regelmäßigen Versandabgleich. Kein Tarif wurde gekauft.
6. Passwortwiederherstellung, Betriebsüberwachung und Wiederherstellung aus
   Datenbanksicherungen abschließend abnehmen.
7. Danach kontrollierte echte Zahlung durch den Betreiber einschließlich
   Bestellmail und unfreigegebener Podbase-Übergabe prüfen; erst dann die
   Freigabeschalter öffnen. Keine echte Zahlung wurde in dieser Prüfung ausgelöst.

Rollback: vorheriges geprüftes Testdeployment wieder promovieren und die
Production-Umgebungswerte vor einer erneuten Bereitstellung auf die dokumentierte
Testkonfiguration zurücksetzen. Ein Rollback ersetzt keine Klärung bereits
bezahlter Liveaufträge; diese dürfen nie in Testadapter geraten.
