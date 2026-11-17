# Page-Speed-Optimierung am 17. November 2026

Die Änderungen sind auf https://www.archenlicht.de veröffentlicht. Gemessen wurden
die Startseite, die Kollektion und die Produktseite „Nach dem Sturm“.

## Messverfahren

Lighthouse 13.6.0 im lokalen, unsichtbaren Microsoft Edge. Für jeden Lighthouse-Lauf
wurde ein neues Browserprofil ohne HTTP-Cache verwendet. Vorher/nachher liefen auf
demselben PC mit denselben Einstellungen: mobiles Lighthouse-Profil (4-fache
CPU-Verlangsamung, simulierte 1,6 Mbit/s) sowie das Desktop-Profil. Notwendige Cookies
waren bereits gewählt, das Newsletter-Popup für den Tab geschlossen. Es wurde
keine optionale Statistik-Einwilligung erteilt.

Dies sind einzelne Labormessungen, keine Google-CrUX-Nutzerdaten und keine Garantie
für jedes Endgerät oder Mobilfunknetz. Die Ergebnisse schwanken auch mit dem
Datenbank-Kaltstart. Beim ersten gesonderten mobilen Browserlauf benötigte
`/api/bootstrap` 8,4 Sekunden; warme Antworten lagen meist um eine Sekunde.

Die vollständigen lokalen Lighthouse-Berichte liegen als JSON und HTML unter
`test-results/pagespeed-2026-11-17/before/`, `after/` und `final/`.
`after/` enthält außerdem die Browsermessungen bei 390 × 844 und 1440 × 1000 Pixeln.
Die Resource-Timing-Summen des Hauptfensters enthalten nach der Umstellung keine
Downloads des Foto-Workers; sie werden deshalb nicht als Gesamtdatenersparnis
verglichen.

## Ergebnis des abschließenden Lighthouse-Laufs

| Seite | Performance vorher → nachher | LCP vorher → nachher | TBT vorher → nachher | CLS vorher → nachher |
|---|---:|---:|---:|---:|
| Startseite, mobil | 74 → 100 | 2,31 → 0,94 s | 518 → 43 ms | 0,199 → <0,001 |
| Produktseite, mobil | 50 → 81 | 4,11 → 3,06 s | 2.816 → 315 ms | 0,097 → 0,001 |
| Startseite, Desktop | 99 → 100 | 0,52 → 0,28 s | 17 → 5 ms | 0,076 → 0,007 |
| Produktseite, Desktop | 79 → 99 | 0,82 → 0,65 s | 412 → 0 ms | 0,069 → <0,001 |

LCP beschreibt die Anzeige des größten Inhaltselements; TBT die blockierende
Rechenzeit auf dem Hauptthread; CLS die sichtbaren Layoutverschiebungen.
Ein vorangegangener Nachher-Lauf ergab mobil 95/86 und am Desktop 100/98 Punkte.
Der letzte Lauf ist in der Tabelle vollständig aufgeführt, einschließlich der
schlechteren mobilen Produktbewertung. Die mobile Produktseite hat weiterhin
Optimierungspotenzial, besonders beim Nachladen der individuellen Vorschau.

## Änderungen

- Navigation mit Logo und der unveränderte Einstieg der Startseite stehen schon
  im ausgelieferten HTML. Die Startseite wartet für diesen Bereich nicht mehr auf
  Sitzungs- und Datenbankabfragen. Beim Ergänzen der Shopdaten bleibt der bereits
  sichtbare Einstieg im DOM erhalten.
- Die Navigation reserviert ihren Platz sofort; dadurch springen nachgeladene
  Produkt- und Kollektionsinhalte deutlich weniger.
- Latin-Schriften mit vollständigen deutschen Umlauten und Eurozeichen benötigen
  zusammen **277.164 statt 471.388 Bytes**, rund **41 % weniger**. Die Originale
  bleiben für andere Schriftsysteme und die Druckdateien verfügbar. Schriftformen,
  variable Schriftgewichte und die Gestaltung bleiben erhalten. Die beiden zuerst
  benötigten Schriften werden früh geladen.
- Studio- und Lifestyle-Fotos werden mit derselben Bildberechnung in einem
  Web Worker zusammengesetzt. Das hält den Hauptprozess für Scrollen, Navigation
  und Auswahl frei. SVGs werden ohne zusätzliche Skalierungsstufe in die bisherige
  Textur gezeichnet. Überholte Ansichten werden weiterhin verworfen.
- Der Foto-Worker erhält einen versionsgebundenen Dateinamen im Web-Build.
  Bei fehlender Unterstützung oder einem Worker-Fehler greift die bisherige
  Bildberechnung als Ersatzweg.

## Funktionsprüfung

- 20 automatisierte Tests bestanden: Build, private Sitzungsdaten, öffentliche
  Dateien, Cloudflare-Routing, Foto-Komposition sowie Podbase-Druckabruf und
  dauerhaft gespeicherte Hintergrundaufträge einschließlich Wiederholungen.
- Chromium und Firefox: Mobil- und Desktopgröße, früh sichtbarer Startbereich
  bei künstlich verzögerter API, Farbwechsel, Galerie und Hinzufügen zum Warenkorb.
- WebKit: dieselben Bedienabläufe bestanden. Die installierte Windows-WebKit-Version
  besitzt kein OffscreenCanvas und verwendet den geprüften Ersatzweg. Dies ersetzt
  keinen Test auf einem echten iPhone.
- Pixelvergleich „Nach dem Sturm“, Schwarz, iPhone 14 Pro: beide Studioansichten
  und ein Lifestyle-Foto waren in Chromium und Firefox **pixelgleich** zwischen
  bisherigem Renderer und Worker (maximale und mittlere Kanalabweichung jeweils 0).
- Auf der Produktionsseite keine JavaScript-Fehler in den sechs Browsermessungen;
  kein horizontaler Überlauf. Die funktionsbezogenen Warenkorbtests liefen nur im
  isolierten lokalen Testshop. Keine Livezahlung, E-Mail oder Produktion ausgelöst.
- Vor der Veröffentlichung wurden alle **16 Cloudflare-Bindings** einschließlich
  der bestehenden Durable-Object-Datenbank mit der bisherigen Version abgeglichen.
  Checkout-, Zahlungs-, Bestell- und Podbase-Logik bleiben erhalten.

Veröffentlichte Worker-Version: `f59af562-3c22-4311-82e9-badb6e8de482`.
Die individuelle, serverseitig geprüfte Produktvorschau braucht weiterhin eine
API-Antwort. Die Optimierung entfernt keine Druckfreigaben oder Sicherheitsprüfungen.
