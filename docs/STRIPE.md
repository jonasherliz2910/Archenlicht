# Stripe Payments und Tax · Archenlicht

## Gewählter Ablauf

Am 7. November 2026 wurde die Stripe CLI **1.55.8** mit npm global installiert. `stripe agent setup --client codex --yes` installierte das offizielle Stripe-Agent-Plugin. Der MCP-Aufruf `stripe_implementation_planner` erhielt den Geschäftskontext und die vorhandene Node-/Vercel-/Neon-Integration. Der angenommene Entscheidungspfad lautet: Stripe als einziger Anbieter → Webbrowser → physische Produkte → regulärer Checkout → Integration im bestehenden Shop → gehosteter Checkout. [Stripe-Integrationsleitfaden](https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted).

Der vorhandene Warenkorb bleibt maßgeblich für Preis, Menge, Modell, Gestaltung und die in Deutschland validierte Lieferadresse. Stripe zeigt den Zahlungsabschluss. Es gibt keine wiederkehrenden Zahlungen, kein Connect und keine unbeaufsichtigten späteren Abbuchungen. Adaptive Pricing ist deaktiviert: Es bleiben feste EUR-Endpreise von 29,90 € beziehungsweise 34,90 € einschließlich Deutschlandversand und Kartenbeilage.

## Kleinunternehmerregelung und Tax

Jonas hat die **Kleinunternehmerregelung** ausdrücklich bestätigt. Deshalb werden weder Umsatzsteuer aufgeschlagen noch eine Steuerregistrierung angelegt. Shop und Stripe Checkout zeigen den Hinweis auf § 19 UStG. Jede neue Stripe-Bestellung trägt `small_business_de` als dauerhafte Steuerbehandlung; `automatic_tax.enabled` ist ausdrücklich `false`, und ein Zahlungsabschluss wird nur mit einem Steuerbetrag von null akzeptiert. Diese Konfiguration setzt Jonas’ Angabe um, sie prüft nicht eigenständig seine steuerrechtliche Berechtigung. [§ 19 UStG](https://www.gesetze-im-internet.de/ustg_1980/__19.html).

Stripe Tax wurde im tatsächlichen Testkonto geprüft: Einstellungen `pending`, Geschäftsadresse fehlt, keine aktive Registrierung. Es wird derzeit keine automatische Steuererhebung verwendet. Bei einem späteren Wechsel der Steuerbehandlung müssen Geschäftsadresse, zutreffender Produktsteuercode, Registrierung und die Übernahme der tatsächlichen Lieferadresse in die Steuerberechnung zusammen eingerichtet und getestet werden. `automatic_tax` allein reicht dafür nicht. [Stripe Tax mit Checkout](https://docs.stripe.com/tax/checkout/page).

## Änderungen gegenüber der bisherigen Vorbereitung

- Offizielles **Stripe Node SDK 23.1.0**, API-Version **2026-10-28.endive**, begrenzte Zeitüberschreitungen und Wiederholungen, Idempotency-Key je Bestellung und Konto.
- Testschlüssel `rk_test_` und `sk_test_` unterstützt; Live-Schlüssel abgewiesen. Eingeschränkte Testschlüssel mit den benötigten Berechtigungen sind bevorzugt. Keine API-Schlüssel, Providerfehler oder vollständigen Kartendaten in Browserantworten oder Logs.
- Dynamische Zahlungsmethoden aus Stripe statt einer im API-Aufruf festgeschriebenen Kartenzahlung oder PayPal-Auswahl. Im geprüften Konto sind **Karte und Link verfügbar, PayPal noch nicht verfügbar**. Der Shop verspricht deshalb keine konkrete, nicht aktivierte Zahlungsart. Eine optionale `STRIPE_PAYMENT_CONFIGURATION` kann die Dashboard-Konfiguration auswählen.
- Bestehende Konten bekommen eine serverseitig gebundene Stripe-Customer-ID. Die freiwillige Stripe-Speicheroption und freigegebene Karten bleiben erhalten. Keine automatische Speicherung über `setup_future_usage`. Gastbestellungen erhalten keine kontogebundene Speicheroption.
- Die Lieferadresse wird für diese steuerfreien Deutschland-Bestellungen bereits im Shop geprüft und unveränderlich zur Bestellung gespeichert. Sie wird nicht in ein zusätzliches Stripe-Adressformular oder automatisch in ein wiederverwendbares Stripe-Customer-Adressbuch kopiert. Das Speichern im Shopkonto bleibt ein eigener ausdrücklicher Wunsch und erfolgt erst nach Zahlung.
- Rückkehradressen stammen aus der geprüften Origin der Anfrage. So funktionieren Vorschau, Vercel-Adresse und eigene Shopdomain mit ihrer jeweiligen Sitzung. Ein frei übermitteltes `returnOrigin` im JSON wird nicht übernommen.
- SDK-Prüfung der Webhook-Signatur auf dem unveränderten Body, zusätzliche Zeitprüfung, getrenntes Größenlimit für Webhooks. Verarbeitung von Erfolg, verzögertem Erfolg, verzögertem Fehlschlag und Ablauf. Fremde Checkout-Sessions werden ignoriert; verspätete Ablaufereignisse setzen eine bezahlte Bestellung nicht zurück.
- Unabhängiger Stripe-Abgleich von Checkout-ID, Zahlungsmodus, Testmodus, `paid`/`complete`, Bestellreferenz, Metadaten, Kundenbezug, EUR-Gesamtbetrag und steuerfreier Behandlung. `stripe_payments` dokumentiert Checkout-ID, PaymentIntent, Steuerbehandlung und bestätigten Steuerbetrag. Zahlung, Beleg und genau ein Fulfillmentauftrag entstehen gemeinsam in der bestehenden Transaktion.

## Konfiguration und Schlüssel

Vercel-Projekt: `jonas-4eb6/archenlicht`. `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` werden als **Secret** in der Vercel-Umgebungsverwaltung hinterlegt, ausschließlich per Standardeingabe an die CLI. `PAYMENT_MODE=sandbox` schaltet den Stripe-Testcheckout ein; `SHOP_MODE=test`, `PODBASE_MODE=local` und `MAIL_MODE=local` bleiben gesetzt.

Webhookziel: `https://archenlicht.vercel.app/api/webhooks/stripe`. Ereignisse: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Der angelegte Endpunkt ist ausschließlich im Stripe-Testmodus aktiv. Bei lokalem CLI-Forwarding ist dessen eigenes Signing-Secret zu verwenden, nicht das Secret dieses gehosteten Endpunkts.

`SHOP_ALLOWED_ORIGINS` enthält die eigenen HTTPS-Shopdomains ohne abschließenden Slash. Vercel-Vorschauadressen werden zusätzlich aus Vercels Servervariablen übernommen. Der veröffentlichbare Stripe-Schlüssel wird für den serverseitig erzeugten gehosteten Checkout nicht benötigt.

Die vom Nutzer bereitgestellte Datei `Stripekey.txt` ist in `.gitignore` und `.vercelignore` ausgeschlossen. Lokale Prüfdateien, Cookies und Signing-Secrets liegen nur in ignorierten Verzeichnissen. Sie gehören nicht in GitHub oder Prüfberichte. Die öffentlich enthaltene `.env.example` enthält ausschließlich leere Felder.

## Nachweise und verbleibende Kontoeinrichtung

Die lokale Suite umfasst die bisherigen Kauf-, Konto-, Modell- und Drucktests sowie neue Prüfungen für eingeschränkte Schlüssel, Steuerabweichungen, Metadaten, Fehlerausgaben und die tatsächlichen Checkout-HTML-Funktionen. Signierte Webhook-Fixtures größer als 20 KB, Replay, gespeicherter Zahlungsbeleg und verspäteter Ablauf sind geprüft.

Ein separater Test mit dem bereitgestellten echten Stripe-Testschlüssel erzeugt Gast- und Konto-Checkouts für jeweils beide Hüllenarten, prüft 64,80 EUR, null Steuer, sichere Rückkehradresse, freiwillige Kartenspeicherung und ausstehenden Status. Er beendet seine eigenen unbenutzten Checkout-Sessions und entfernt nur die von ihm erzeugten Test-Customer. Dieser Test läuft nur mit `RUN_STRIPE_SANDBOX_TESTS=1` und geschützter `STRIPE_SECRET_KEY`.

Die Vercel-Vorschau wurde zusätzlich mit echten Stripe-API-Aufrufen über den Gast- und Kontokauf geprüft. Ausstehende Sessions erzeugen keinen Druckauftrag und übernehmen keine Adresse ins Konto. Eine im Browser abgeschlossene Zahlung und deren echte Stripe-Webhook-Zustellung werden gesondert geprüft; API-Erstellung und signierte Fixtures allein gelten nicht als Nachweis einer abgeschlossenen Kartenzahlung.

Das Stripe-Konto meldet noch keine abgeschlossene Unternehmenseinrichtung und keine Freigabe für echte Zahlungen. PayPal benötigt Verfügbarkeit und Aktivierung im Stripe-Konto. Podbase, Produktion und E-Mails bleiben simuliert. Der Integrationsstand ist ein Stripe-Testshop, kein freigegebener Liveverkauf.
