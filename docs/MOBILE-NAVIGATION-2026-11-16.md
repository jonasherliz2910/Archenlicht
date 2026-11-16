# Mobile Konto- und Warenkorb-Navigation

Gemeldet: Die beiden Aktionen rechts oben reagieren auf dem Handy nicht.
Bei der Prüfung war der Konto-Link durch zwei ältere mobile CSS-Regeln
ausgeblendet. Der Warenkorb ließ sich im Chromium-Test öffnen; der konkrete
ursprüngliche Browser des Nutzers ist nicht bekannt. Eine identische Ursache
für beide gemeldeten Symptome ist damit nicht belegt.

## Änderung

- Konto-Link bleibt auch unter 680 px sichtbar.
- Mobile Konto- und Warenkorb-Links haben mindestens 44 × 44 px große
  Tippflächen; die dekorativen SVGs und der Zähler fangen keine Pointer ab.
- Bei sehr kleinen Bildschirmen wird das Logo etwas schmaler, damit alle drei
  Aktionen einschließlich Menü ohne Überlappung in die Kopfzeile passen.
- Konto und Warenkorb verwenden die bereits vorhandene native Link-Navigation
  (`data-reload`) unabhängig vom SPA-Router. Sitzung, Anmeldung und Warenkorb
  bleiben serverseitig erhalten. Die Desktop-Darstellung bleibt unverändert.

## Prüfung

Chromium (Edge), Firefox und WebKit jeweils bei 320, 360, 390, 430, 680, 768,
900 und 1440 px: beide Links, direktes Tippen auf die Symbolposition, offenes
Menü, kein horizontaler Überlauf. Zusätzlich Produkt- und Bundle-Seite,
gescrollte Kopfzeile, Einlegen einer Hülle, Registrierung eines ausschließlich
lokalen Testkontos und Erhalt von Anmeldung und Warenkorb bei Seitenwechseln.
Alle 24 Browser-/Breitenkombinationen bestanden, keine JavaScript-Fehler.
WebKit ist eine Engine-Prüfung, kein Test aller realen Safari-/iPhone-Versionen.

Produktionsbuild und fünf Cloudflare-Produktionstests bestanden. Danach auf
www.archenlicht.de Chromium bei 320, 390, 768 und 1440 px sowie Firefox und
WebKit bei 390 px geprüft. Direkte Konto- und Warenkorb-Navigation funktioniert.
Eine Hülle wurde in einer eigenen frischen Sitzung eingelegt, nach dem Wechsel
zum Konto und zurück wiedergefunden und anschließend aus dieser Testsitzung
entfernt. Keine Zahlung, Kundenregistrierung, E-Mail oder Podbase-Bestellung
im Live-Shop ausgelöst; Checkout-Anfragen waren im Testbrowser blockiert.

## Veröffentlichung

Cloudflare-Worker `archenlicht-shop`, Version
`381f40b6-0484-4acf-9d62-ac8b824e5acc`, 100 Prozent Traffic.
Alle 16 vorhandenen Bindings einschließlich Secrets und Durable-Object-
Namespace vor Aktivierung abgeglichen. Beide Verkaufsschalter bleiben aktiv,
Live-Zahlungen und Podbase-Übergabe unverändert. DNS und Anbieter-Einstellungen
wurden nicht verändert.

Lokale Prüfnachweise (ignoriert): `test-results/header-fix/before.json`,
`local.json`, `live.json`, `prepared-version.json` und Bildschirmbilder.
