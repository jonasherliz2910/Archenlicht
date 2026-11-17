# Technischen Fehlerkasten aus Kundenansicht entfernt

Auf ausdrücklichen Wunsch wurde der gesamte Kasten „Deine bezahlte Bestellung
bleibt offen“ einschließlich Anbieterdiagnose aus der Bestellstatus-Seite
entfernt. Die Statusschritte, reguläre Statusnachricht und Sendungsnummer
bleiben erhalten. Es wird kein Fortschritt zu Produktion oder Versand erfunden.
Die gespeicherten Fehlermeldungen, Administratorübersicht und internen
Fehlermails wurden nicht verändert.

Geprüft im Browser bei 390 und 1440 px mit bezahlten Testdaten für uncertain
und rejected: kein Fehlerkasten, nur „Bezahlt“ markiert, keine Scriptfehler
oder Überbreite. Die Sendungsnummer und alle drei Statusschritte werden für
shipped weiterhin angezeigt. Produktionsbuild erfolgreich.

Veröffentlicht auf archenlicht-shop als Version
029ab9ce-ffe0-4d35-a5cd-7c57b2f18441 (100 Prozent Traffic).
Die vorhandenen 16 Bindings wurden vor Aktivierung abgeglichen; die beiden
Verkaufsschalter und Providerkonfiguration bleiben unverändert.

## Separat offener Betriebsfall

Die vom Nutzer gezeigte bezahlte Livebestellung ist laut lesender Datenbank-
Prüfung tatsächlich in uncertain, ohne provider_id und mit einem protokollierten
Übermittlungsversuch. Die lesende Podbase-Suche über alle verfügbaren Seiten
fand zur externen Bestell-ID keinen Auftrag. Das ist durch die Änderung der
Kundenansicht nicht behoben. Der Nutzer wurde darüber informiert. Kein Reset
des Versuchszählers, kein erneuter POST, keine Erstattung und keine
Produktionsfreigabe vorgenommen. Dieser Übergabefall muss separat geklärt werden.

Die konkreten Bestelldaten und Prüfergebnisse bleiben in den ignorierten
Dateien unter test-results/order-status-box/. Sie werden nicht veröffentlicht.
