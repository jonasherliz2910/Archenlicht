# Produktfreigabe für Archenlicht

Stand: 16. November 2026. Auftrag: Nach dem Cloudflare-Umzug die belegten
Handymodelle und ihre Druckfreigaben für den Verkaufsstart vorbereiten und
übernehmen. Die Freigabe des öffentlichen Checkouts ist ein eigener Schritt.

Aktualisierung um 20:04 MEZ: Zusätzlich sind iPhone 18 Pro, iPhone 18 Pro Max
und Google Pixel 10a technisch freigegeben, jeweils Standard und magnetisch.
Aktueller Gesamtstand: 67 Standardmodelle, 41 magnetische Modelle,
402 Standard-/246 Magnetkombinationen; sieben Modelle mit 42 Kombinationen
bleiben gesperrt. Die folgenden Abschnitte protokollieren die erste Freigabe
um 19:39 MEZ. Der Ergänzungsnachweis steht in
`product-template-completion-2026-11-16.json` und `PODBASE-DRUCKVORLAGEN.md`.

## Umfang der technischen Freigabe

| Marke | Standardmodelle | Davon mit MagSafe-/Magnetvorlage |
| --- | ---: | ---: |
| Apple | 24 | 24 |
| Samsung | 24 | 11 |
| Google | 16 | 3 |
| Gesamt | 64 | 38 |

Für diese Modelle werden alle sechs Motive berücksichtigt, einschließlich
Personalisierung mit vorgeschlagenem Vers oder eigenen Worten. Das ergibt
384 Modell-/Motivfreigaben; für die belegten magnetischen Varianten zusätzlich
228 Kombinationen. Alle neun Hintergrundfarben bleiben erhalten. Die genaue
Modellliste steht in `product-release-2026-11-16.json`.

Der aktuelle Podbase-Katalog wurde nur lesend abgerufen. Alle vorgesehenen
Standard- und Magnetvarianten sind lieferbar, mit eindeutig passenden
Produkt- und Variantenkennungen. Die Verfügbarkeit wird auch künftig vor dem
Kauf erneut abgefragt; die Freigabe ersetzt keine Bestandsprüfung.

## Weiterhin ausgeschlossen

- iPhone 17e, iPhone 18 Pro und iPhone 18 Pro Max.
- Samsung Galaxy S26 FE, Galaxy A27 und Galaxy Z Flip8.
- Google Pixel 10a, Pixel 11, Pixel 11 Pro und Pixel 11 Pro XL.

Diese zehn Modelle besitzen weiterhin nicht alle erforderlichen offiziellen
Druckvorgaben. Die 60 zugehörigen Modell-/Motivkombinationen bleiben gesperrt.
Die ausdrücklich gewünschte Beispielansicht des iPhone 18 Pro bleibt erhalten;
für einen späteren Kauf muss ein verfügbares Modell ausgewählt werden.

## Druckprüfung und Grenzen

Die offizielle PSD und die Tabelle der Dateianforderungen wurden am
16. November erneut heruntergeladen. Beide SHA-256-Prüfsummen sind unverändert
gegenüber den importierten Quellen. Es wurden keine Kamera- oder Druckmaße
für fehlende Modelle geschätzt.

Die Prüfung verwendet die vorhandenen Originalmotive, Schriftdateien und
Druckkonturen. Sie kontrolliert feste Motive, einen eigenen Text mit Widmung
und einen vorgeschlagenen Vers mit Widmung. Die Auswahl der Druckvariante muss
zur jeweiligen Standard- oder Magnetvariante im Anbieter-Katalog passen.
Jede individuelle Kundengestaltung wird zusätzlich beim Speichern und Kauf
gegen die sichere Druckfläche geprüft; nicht passende Texte werden abgewiesen.

Technische Beschnittprüfung ist keine physische Musterprüfung sämtlicher
Varianten. Bestätigtes reales Muster bleibt iPhone 14 Pro / MagSafe /
Nach dem Sturm / Hellblau; siehe `MUSTERPRUEFUNG-2026-11-14.md`.
Die Druckmetadaten werden nicht pauschal als physisch geprüft markiert.

## Korrigierte Verfügbarkeitsanzeige

Ein geschlossener Live-Shop betrachtete bisher ausschließlich Testfreigaben
als auswählbar. Die Umstellung einer Variante auf Live hätte sie dadurch
bis zur Verkaufsöffnung unsichtbar beziehungsweise nicht verfügbar gemacht.

Der separate Vorschaukontext akzeptiert jetzt Test- und Livefreigaben.
Testkäufe verlangen weiterhin Testfreigaben; Livekäufe und Auftragsübergaben
verlangen weiterhin ausdrücklich Livefreigaben. Verfügbarkeit, Druckvorlage
und Anbieterbestand werden unabhängig davon geprüft. Die geschlossene Kasse
kann durch Auswahl oder Warenkorb weiterhin keine Bestellung erzeugen.

Die betroffenen Modell-, Kaufweg- und Cloudflare-Produktionsprüfungen bestehen:
17 Tests, keine Fehler; ein optionaler externer Neon-Test wurde nicht ausgeführt.
Syntaxprüfung und Cloudflare-Produktionsbuild erfolgreich. Die Korrektur wurde
über den GitHub-Build zu Commit `0a92650` veröffentlicht.

## Protokoll der Übernahme

Am 16. November um 19:39 MEZ wurden die Werte in einer Datenbanktransaktion
übernommen: 384 Kombinationen mit available=1, print_approved=1 und
approval_mode=live; die 60 unbelegten Kombinationen mit available=0,
print_approved=0 und weiterhin approval_mode=test. Die vorherigen Werte wurden
vor der Änderung gesichert. Es wurden weder Bestellungen noch Konten geändert.

Prüfergebnis: 1.836 vollständige Beschnittprüfungen mit Sharp für alle 102
belegten Standard-/Magnetvarianten und jeweils sechs Motive in drei Textarten,
ohne Fehler. Ergänzend 72 abgeschlossene Prüfungen mit dem unveränderten
Cloudflare-WASM-Rasterizer für iPhone 12 und iPhone 12 Pro, beide Hüllenarten,
alle sechs Motive und drei Textarten. Die vollständige native Matrix ersetzt
keinen vollständigen WASM- oder physischen Farb-/Mustertest.

648 Vergleiche der Farbvarianten auf diesen beiden Beispielmodellen bestätigen,
dass alle neun Farben die Motiv- und Schriftgeometrie unverändert lassen.
Hintergrund und deckende Schriftfarbe ändern sich; dies ist kein Test der
Farbwiedergabe eines physischen Drucks.

Anschließend den öffentlichen Bootstrap und die echte Produktionsdatenbank
geprüft: 384 Standard- und 228 magnetische Kombinationen auswählbar, 60
gesperrt. Alle 444 Einträge stimmen mit der vorgesehenen Auswahl überein.
Die Health-Prüfung meldet Checkout=false und Podbase-Übermittlung=false.
Weiterhin acht alte Testbestellungen und zehn zugestellte Mailnachweise;
keine neue Bestellung oder E-Mail bei dieser Arbeit.

Private Prüfberichte und vorherige Variantenwerte:
`test-results/product-release/`. Sie enthalten keine API-Schlüssel.
Checkout und Podbase-Übermittlung bleiben ausgeschaltet. Es wird kein
kostenpflichtiger Druckauftrag, keine Zahlung und keine E-Mail ausgelöst.

## Originalquellen

- [Podbase-Dateianforderungen](https://docs.google.com/spreadsheets/d/1shTH2o9K3sN0RyWYUzk8tLADDNgB-qixPxnwQGvOiqM/edit?gid=969391465)
- [Offizielle PSD](https://drive.google.com/file/d/1SvuCd1eDkq2VKgky2NRi6NpEF9CZTUB2/view)
- [Podbase-Anleitung für API-Druckdateien](https://help.podbase.com/hc/en-us/articles/26709497957532-How-to-prepare-print-files-for-Podbase-API)
