# Archenlicht lokal testen

## Neue Modellauswahl

Auf der Produktseite oder im Schritt „Modell“ der Wunschvers-Gestaltung auf die Modellfläche mit „Ändern“ klicken. Es öffnet sich die Auswahl mit Apple, Samsung und Google. Neuere Reihen stehen jeweils oben. Über das Suchfeld lassen sich alle Marken durchsuchen, beispielsweise mit `iPhone18`, `Pixel11 pro` oder `S26+`. Ein Klick auf eine Modellkarte übernimmt das genaue Gerät und aktualisiert Vorschau und alle Modellflächen. Schließen oder Escape behält die bisherige Auswahl. Nicht verfügbare beziehungsweise nicht freigegebene Modell-/Motivkombinationen sind gesperrt. Im Warenkorb „Bearbeiten“ muss das gespeicherte Gerät erneut in der Auswahl erscheinen.

## Google Pixel auswählen

In der Modellwahl gibt es zusätzlich **Google · Pixel**. Die Gruppe wird sowohl bei den fertigen Motiven als auch bei der Wunschvers-Gestaltung und in der mobilen Auswahl angezeigt. Enthalten sind Pixel 6, 6 Pro, 6a, 7, 7 Pro, 7a, 8, 8 Pro, 8a, 9, 9 Pro, 9 Pro XL, 9a, 10, 10 Pro, 10 Pro XL, 10a, 11, 11 Pro und 11 Pro XL. Wähle beispielsweise Pixel 8 für ein fertiges Motiv und Pixel 10a für einen Wunschvers. Vorschau, Warenkorb, Bearbeiten und Testbestellung sollen jeweils das genaue Modell behalten. Die breite Pixel-Kameraleiste ist eine simulierte Testschablone.

## Aktuelle Modelle von Apple und Samsung

Ergänzt sind unter anderem iPhone 16e, iPhone 17 samt Air/e/Pro/Pro Max, iPhone 18 Pro und Pro Max, Galaxy S25 Plus/Edge/FE, Galaxy S26/Plus/Ultra/FE, Galaxy A56/A36/A26/A17, A57/A37/A27 sowie Z Flip8. Die öffentliche Podbase-Tough-Liste wurde am 4. November 2026 abgeglichen. Es handelt sich weiterhin um lokale Testvarianten; vor echtem Verkauf sind die konkreten Händler-API-IDs und Druckschablonen zu prüfen.

## Start

Im Projektordner `Start-Shop.cmd` starten und http://localhost:3000 öffnen. Keine echten persönlichen Daten, Konto-Passwörter oder Zahlungsdaten eingeben. Es handelt sich um einen lokalen Entwicklungsstand.

`Start-Shop.cmd seed` stellt zwei vollständige Demobestellungen bereit. `Start-Shop.cmd test` führt die isolierten automatisierten Tests aus. Sie ändern die Shop-Demodaten nicht. `Start-Shop.cmd check` prüft die JavaScript-Syntax und erforderliche Schriftdateien.

## Weg 1: TikTok, Kollektion, Gast, PayPal

1. Eine neue Browsersitzung öffnen; vorhandene Sitzungen behalten ihre erste Herkunft bei.
2. `http://localhost:3000/kollektion/unter-seinen-fluegeln?utm_source=tiktok&utm_campaign=fluegel-video` aufrufen.
3. Beispielsweise **iPhone 15** wählen. Drucktext soll ausschließlich **Psalm 91,4** sein. Der Testpreis beträgt 29,90 €.
4. „In den Warenkorb“ wählen. Vorschau, Modell und vollständigen Drucktext prüfen. Zur Kasse gehen und als Gast fortfahren.
5. Testadresse verwenden: Mara Mustermann, mara@example.test, +4915112345678, Testweg 12, 10115 Berlin, Deutschland.
6. PayPal auswählen und zur lokalen Testzahlung wechseln. Dort steht ausdrücklich **lokaler Zahlungssimulator**. Erfolgreich bestätigen.
7. Auf der Statusseite erscheinen Zahlung und Produktion, nach etwa 20 Sekunden die **simulierte** Sendungsnummer.
8. Optional „Als Geschenk“ auswählen.
9. Mit Jonas’ lokalem Adminzugang unter `/konto` anmelden; `/auswertung` öffnen. Bestätigung und einmalige Versandnachricht im Testpostfach prüfen. Die Bestätigung enthält den persönlichen Gaststatuslink. In einer anderen Sitzung kann dieser Link die betreffende Bestellung öffnen; ein bloß erratener Bestellpfad darf dies nicht.

## Weg 2: Gemeinde-QR, Wunschvers, Bearbeiten, Karte, Konto

1. Neue Sitzung: `http://localhost:3000/gestalten?utm_source=gemeinde&gemeinde=muster-gemeinde`.
2. „Vers für meine Situation finden“ wählen. Beispiel: „Vor mir liegt ein Neuanfang und ich habe Angst.“
3. Es sollen **drei unterschiedliche Stellen** aus dem Testbestand mit wortgetreuem Zitat und getrennt gekennzeichneter Erklärung erscheinen. Die lokale Testberatung ist regelbasiert.
4. Eine Stelle auswählen; anschließend ein Motiv, beispielsweise „Nach dem Sturm“, und **Samsung Galaxy S24** wählen. Widmung „Für Anna · 2026“ ergänzen.
5. Vollständigen Drucktext und PNG-Datei über die Vorschau öffnen. Modellschablonen und Motive sind Entwürfe. Die Datei enthält denselben Satz und dieselbe Illustration wie die Vorschau.
6. In den Warenkorb legen. „Bearbeiten“ wählen, Widmung auf „Für Anna · 2027“ ändern und speichern. Danach soll weiterhin **eine** Position vorhanden sein.
7. Zur Kasse gehen. Über den freiwilligen Kontolink ein eigenes Testkonto mit mindestens zwölf Zeichen Passwort erstellen oder das Demokonto verwenden: `anna@example.test` / `Nur-Test-Anna-2026!`.
8. Karten-Testzahlung wählen und im lokalen Simulator bestätigen. Gesamtpreis: 34,90 €. Keine echte Kartennummer nötig.
9. `/konto` zeigt nur Bestellungen dieses Kontos. Auf der Bestellung wird später die simulierte Sendungsnummer angezeigt.
10. Jonas’ Auswertung soll beide bezahlten Testkaufarten auseinanderhalten. Beide Einzelkäufe zusammen ergeben 64,80 € und zwei Stück. Zusätzlich vorhandene Demo- oder eigene Testkäufe erhöhen diese Gesamtzahl entsprechend.

## Stabile Motivlinks

- `/kollektion/unter-seinen-fluegeln`
- `/kollektion/nach-dem-sturm`
- `/kollektion/absetzen`
- `/kollektion/ganz-nah`
- `/kollektion/im-schatten`
- `/kollektion/getragen`

TikTok: `?utm_source=tiktok&utm_campaign=<kurze-kennung>`. Gemeinde: `?utm_source=gemeinde&gemeinde=<kurze-kennung>`. Unbekannte angegebene Quellen werden als „Sonstige“ gezählt; ohne Kennzeichnung als „Unbekannt“. Keine Personen- oder Situationstexte in Linkparameter schreiben.

## Fehlerfälle

Jonas’ Zugang steht in `data/test/admin-access.txt`. Unter `/auswertung` gibt es „Testfälle steuern“ für Beratung und Podbase. Die Einstellungen gelten flüchtig für den laufenden lokalen Prozess; danach auf **Normal** zurückstellen.

| Fall | Vorgehen / erwartetes Ergebnis |
|---|---|
| Beratungsausfall | Auf „Ausfall“ stellen, Beratung aufrufen. Ein kurzer Grund und alle sechs Ersatzmotive erscheinen. |
| Keine passenden Stellen | „Keine passenden Stellen“ wählen oder einen unpassenden Begriff eingeben. Keine erfundenen Zitate; sechs Ersatzmotive. |
| Zu lange Widmung | Mehr als 32 Zeichen oder besonders breite Zeichenfolge versuchen. Server prüft zusätzlich zur Eingabebegrenzung; konkrete Kürzungsmöglichkeit. |
| Zu langer Vers | Automatisierter Test fügt vorübergehend einen überlangen Testauszug ein. Die Vorschau lehnt ihn ab; der normale Katalog bleibt unverändert. |
| Variante weggefallen | Über geschützte Test-API deaktivieren; bestehender Warenkorb darf damit nicht zur Zahlung. Siehe Beispiel unten. |
| Zahlung abbrechen | Im lokalen Zahlungssimulator abbrechen. Keine Produktion, Warenkorb bleibt erhalten. |
| Doppelte Zahlung | Automatisierte Tests senden sechs parallele Bestätigungen und erneute Providerereignisse. Genau ein Fulfillmentauftrag. |
| Podbase lehnt ab | Adapter auf „Auftrag ablehnen“ stellen, neuen Testkauf bezahlen. Bezahlter offener Fall und Adminnachricht, kein Druckauftrag. |
| Antwort unterbrochen | „Antwort nach Annahme unterbrechen“ einstellen. Nach Zahlung zunächst unklar, danach Anbieterabgleich; genau ein Anbieterauftrag. |
| Serverneustart | Automatisierter Test beendet nach Annahme die Shopinstanz und öffnet dieselbe Datenbank erneut. Wiederaufnahme ohne Duplikat. |
| Fremde Bestellung | Pfad ohne berechtigtes Konto oder Gasttoken aufrufen. Kein Zugriff; eigene Bestellhistorie bleibt begrenzt. |
| Situationsablauf | Abmelden oder Sitzung ablaufen lassen. Text ist weg. Test prüft zusätzlich sämtliche persistenten Tabellen auf die Testbeschreibung. |
| Status neu laden | Mehrfach aktualisieren. Bezahlte Bestellungen, Stück und Versandmails werden nicht erneut gezählt. |

### Geschützte lokale Test-API

Nur für Jonas’ Adminsitzung mit deren CSRF-Token. Kein öffentlicher Produkteeditor. Beispielbody für `POST /api/admin/test`:

```json
{
  "variant": {
    "modelId": "iphone-15",
    "designId": "unter-seinen-fluegeln",
    "available": false
  }
}
```

Zum Wiederherstellen `available: true`. Produktion fortschalten: `{ "advanceOrder": "<shop-bestell-id>" }`. Explizit abgelehnten Auftrag nach Klärung erneut versuchen: `{ "retryOrder": "<shop-bestell-id>" }`. Der Server gleicht vorher erneut ab. **Unklare** Fälle können darüber nicht blind neu gesendet werden.

## Stripe-Tests nach Einrichtung

1. Jonas richtet einen Stripe-Testzugang ein und aktiviert Karte sowie PayPal als Stripe-Zahlungsmethode.
2. `.env` nach README setzen: `PAYMENT_MODE=sandbox`, ausschließlich `sk_test_…`, korrektes Webhooksecret und erreichbare Rücksprungadresse. Podbase/Mail bleiben lokal.
3. Stripe-Testwebhook oder Stripe-CLI-Forwarding auf `/api/webhooks/stripe` einrichten. Ereignisse: `checkout.session.completed`, `checkout.session.async_payment_succeeded`.
4. Beide Kaufwege erneut ausführen. Sie müssen zu **Stripe Checkout** führen. Für Karte laut Stripe-Dokumentation die Testkarte `4242 4242 4242 4242`, ein zukünftiges Datum und einen Test-CVC verwenden. Für PayPal dem von Stripe angebotenen Testablauf folgen.
5. Webhook auslösen, wiederholen und einen abgebrochenen Checkout prüfen. Anbieter-ID, Betrag, EUR, Bezug und bezahlter Status müssen serverseitig übereinstimmen. Nur die erfolgreiche Rückkehr ist kein Nachweis.
6. Im Stripe-Testkonto und im lokalen Shop die zwei Zahlungen vergleichen. Erst dieses Verfahren ist eine echte Stripe-Sandboxtestabnahme. Die vorhandenen HTTP-Fixtures ersetzen sie nicht.

## Lieferdaten und Karten wiederverwenden (4. November 2026)

1. Mit einem Testkonto anmelden und eine Hülle in den Warenkorb legen. An der Kasse Lieferdaten eingeben und das freiwillige Speicherhäkchen setzen.
2. Kartenzahlung wählen. Im lokalen Simulator die Checkbox „Demo-Karte für spätere Einkäufe speichern“ auswählen und die Testzahlung bestätigen.
3. Unter `/konto` sollen Lieferdaten und die markierte Demo-Visa mit Endung 4242 erscheinen. Abmelden und erneut anmelden: die Daten sind weiterhin vorhanden.
4. Eine weitere Bestellung beginnen: Die Lieferfelder sind vorausgefüllt. Bei Kartenzahlung steht die vorhandene Demo-Karte zur Auswahl. Die nächste Bestellung muss weiterhin selbst bestätigt werden.
5. Für ein Geschenk abweichende Lieferdaten eingeben und den Speicherhaken **nicht** wählen. Die gespeicherte Standardadresse bleibt erhalten.
6. Im Konto Adresse ändern oder entfernen und die Karte entfernen. Beides betrifft nur das eigene Konto. Nach Entfernen steht die Karte beim nächsten Testkauf nicht mehr zur Auswahl.
7. Mit einem Konto, das bereits bezahlt bestellt, aber noch nichts freiwillig gespeichert hat: „Daten aus meiner letzten Bestellung übernehmen“ wählen, Angaben prüfen und erst mit „Lieferdaten speichern“ übernehmen.

Im echten Stripe-Testmodus befindet sich die freiwillige Kartencheckbox **im gehosteten Stripe-Checkout**, nicht im lokalen Simulator. Dort wird die Karte bei Zustimmung gespeichert und dem selben angemeldeten Konto später erneut angeboten. Hierfür fehlen weiterhin Händler-Testzugänge; die zusätzlichen Schnittstellen sind mit kontrollierten Antwortfixtures geprüft.

## Noch ausstehende Mobilabnahme

Die direkte Edge-Automation wurde technisch abgelehnt, obwohl Jonas zugestimmt hat. Sobald Browserzugriff verfügbar ist, beide Wege bei **390 × 844** und **360 × 800** sowie Desktop prüfen: keine horizontalen Überläufe, lesbare Schrift, Modellwahl, Bildschirmtastatur, drei Empfehlungen, Vorschau, Bearbeiten, Gast/Konto, Testzahlung, Status und Adminansicht. Auch echtes Smartphone mit Gemeinde-/TikTok-Link ist vor Verkauf sinnvoll. Bis dahin ist dieser Punkt ausdrücklich offen.
