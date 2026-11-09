# Newsletter und Willkommensrabatt

## Ablauf

- Das schließbare Newsletter-Fenster erscheint nach sechs Sekunden auf Start-, Kollektions-, Gestaltungs- und Bundle-Seiten. Nach dem Schließen oder Anmelden bleibt es während derselben Browsersitzung ausgeblendet. Kein Popup an der Kasse, im Konto oder auf Rechtsseiten. Der Footer verlinkt dauerhaft `/newsletter`.
- Vorname, Nachname, E-Mail und ausdrücklich angekreuzte Einwilligung werden serverseitig validiert und gespeichert. Kein Kundenkonto nötig.
- Eine neutrale Bestätigungsmail enthält einen 48 Stunden gültigen Link. Das Öffnen allein bestätigt nichts; ein zusätzlicher Klick auf der Website ist erforderlich, damit Mail-Linkscanner niemanden anmelden.
- Erst nach Bestätigung folgt die Willkommensmail mit einem zufälligen persönlichen Code. Wiederholte Bestätigung erzeugt weder eine neue Mail noch einen zweiten Code. Erneute Anmeldung bereits aktiver Adressen löst keine Mail aus. Unbestätigte Adressen können frühestens nach 24 Stunden einen neuen Link anfordern.
- Abmeldung über die Website oder den standardisierten One-Click-Mailheader. Ein bereits ausgestellter Code bleibt gültig. Eine erneute Anmeldung erzeugt keinen zweiten Rabattanspruch.
- Es werden keine laufenden Newsletter-Kampagnen automatisch versendet. Dafür ist später eine separate, ausdrücklich beauftragte Kampagne an aktive Abonnenten erforderlich.

## Rabatt und Bestellungen

5 % auf nicht reduzierte Hüllen, einmal pro bestätigter E-Mail-Adresse. Kein Mindestbestellwert und kein künstliches Ablaufdatum. Standard, Wunschtext und MagSafe sind eingeschlossen. Ab zwei Hüllen gilt der vorhandene Bundle-Rabatt (5 %, ab vier 10 %), sodass kein Newsletter-Rabatt zusätzlich eingelöst werden kann. Es gibt keine erhöhten oder fingierten Vergleichspreise.

Der Code wird an der Kasse zusammen mit derselben E-Mail-Adresse geprüft. E-Mail- oder Codeänderungen setzen die angezeigte Rabattfreigabe zurück. Beim Checkout validiert der Server erneut und speichert Preis, Rabatttyp und Centbetrag unveränderlich in der Bestellung. Stripe bekommt einen einmal verwendbaren, bestellgebundenen Coupon über genau diesen Centbetrag. Bestellansicht und Bestellmail zeigen denselben Newsletter-Rabatt.

Eine Datenbankreservierung verhindert parallele Einlösungen. Nach bestätigter Zahlung ist der Rabatt verbraucht. Lokaler Abbruch bzw. nachgewiesener Stripe-Abbruch oder Ablauf gibt die Reservierung frei. Die Rückkehr von Stripe allein storniert keine noch bezahlbare Session: Im Warenkorb kann die begonnene Zahlung ausdrücklich abgebrochen werden. Bei unklarer Einrichtung einer Stripe-Zahlung bleibt der Code vorsorglich reserviert; Support muss den Zahlungsstatus abgleichen, bevor er ihn freigibt. Testeinlösungen und ein späterer Livebetrieb verwenden getrennte Einlösungsbereiche.

## Speicherung und Versand

Neue Tabellen: `newsletter_subscribers`, `newsletter_consents`, `newsletter_limits`, `newsletter_mail`, `newsletter_redemptions`. SQLite und Neon nutzen dieselben Definitionen. Namen und Adresse bleiben ausschließlich im serverseitigen Datenspeicher und im notwendigen Mailpayload. Bestätigungs- und Abmeldetoken werden in der Abonnententabelle nur gehasht gespeichert; Links enthalten keine E-Mail-Adresse. Datenbankzugriff bleibt geschützt. Einwilligungstext und Version liegen in `public/newsletter-policy.js`; Anforderung, Bestätigung und Abmeldung werden zeitlich dokumentiert.

`NEWSLETTER_MODE=local` speichert Mails ausschließlich im lokalen Testpostfach. `NEWSLETTER_MODE=resend` sendet Bestätigung und Willkommenscode mit dem vorhandenen Resend-Schlüssel, Webhook und `MAIL_PUBLIC_URL`. Dieser Schalter ist unabhängig vom auf Testempfänger beschränkten Bestellversand. Er aktiviert weder echte Zahlungen noch Podbase-Aufträge.

Durable Mail-Outbox, Idempotenzschlüssel, Versand-Leases, Backoff, Zustellereignisse und Rückläufer-/Beschwerdesperre werden wiederverwendet. Unklare Versandversuche werden nur innerhalb des 23-Stunden-Sicherheitsfensters wiederholt und danach zur manuellen Prüfung gehalten. Der vorhandene Joblauf verarbeitet Warteschlangen; für zeitnahe Wiederholungen bei Störungen ist vor Verkaufsstart weiterhin eine häufigere Hintergrundverarbeitung nötig (derzeit täglicher Vercel-Cron). Gehashte Zugriffszähler begrenzen Anmeldungen nach Adresse, Sitzung und globalem Tageslimit. Unbestätigte Anmeldungen einschließlich Mailpayload werden nach 30 Tagen im Bereinigungslauf entfernt.

Die vorhandene Datenschutzerklärung bleibt insgesamt ein gekennzeichneter Arbeitsentwurf. Der Newsletter-Abschnitt ist ergänzt; abschließende Betreiber-, Auftragsverarbeiter-, Aufbewahrungs- und Datenschutzprüfung gehört weiter zu den offenen Live-Voraussetzungen. Grundlage für die ausdrückliche Einwilligung: [§ 7 UWG](https://www.gesetze-im-internet.de/uwg_2004/__7.html). Technische Versandwiederholungen: [Resend-Idempotenz](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Nachweise

`tests/newsletter.test.js` prüft Double-Opt-in, Wiederholungen, E-Mail-Bindung, nicht kombinierbare Rabatte, Centbeträge, parallele Bestellungen, Reservierung, Einlösung, Abmeldung, CSRF, Rate Limits, Löschung und Resend-Wiederholungsschlüssel. Bestehende Bundle-, Mail-, Shop- und Stripe-Tests schützen die bisherigen Kaufwege.

Browsernachweis: 320, 390 und 1440 px, Escape/Schließen, erneuter Seitenaufruf ohne Popup, vollständige Anmeldung, Bestätigung, personalisierte MagSafe-Hülle 39,99 € → 37,99 €, E-Mail-Änderung, lokale Testzahlung, Bestellansicht und Abmeldung. Screenshots und Testdaten liegen ausschließlich in `test-results/newsletter-browser/`.

Zusätzlich am 09.11.2026 geprüft: echter Neon-Datenspeicher in einem anschließend gelöschten isolierten Testschema, einschließlich Neustart, Einlösung und Abmeldung. Echte Stripe-Sandbox-Session mit 29,99 € Zwischensumme, 1,50 € Newsletter-Rabatt und 28,49 € Gesamtbetrag; unbezahlt beendet und Reservierung wieder freigegeben. Keine echte Zahlung, Produktion oder Nachricht an einen externen Empfänger in diesen Prüfungen.
