# Zwei feste Dreier-Sets

Stand: 10. November 2026.

Unter `/bundle` stehen zwei Sets mit jeweils einem gemeinsamen fotorealistischen Bild:

- **Hoffnung für deinen Weg** (`/bundle/hoffnung`): Unter seinen Flügeln, Nach dem Sturm, Absetzen.
- **In seiner Nähe** (`/bundle/geborgenheit`): Ganz nah, Im Schatten, Getragen.

Die drei Motive und ihre Bibelstellen sind fest vorgegeben. Handymodell, Hintergrundfarbe und MagSafe bleiben pro Hülle unabhängig wählbar. Die Einzelvorschauen verwenden die vorhandene Druckkomposition und Modellgeometrie. Die Fotomontagen zeigen ein Bildbeispiel am iPhone 14 Pro in Weiß; eine andere Auswahl ist in den drei Einzelvorschauen sichtbar.

Das Set kostet bei drei Standardhüllen 85,47 € statt 89,97 € beim Einzelkauf (5 % bzw. 4,50 € Ersparnis). MagSafe wird pro Hülle mit dem bestehenden Aufpreis berechnet. Der bisherige Mengenrabatt bleibt erhalten: ab zwei Hüllen 5 %, ab vier Hüllen 10 %. Beide Sets zusammen ergeben sechs Hüllen mit 10 %. Newsletter-Rabatt ist nicht zusätzlich kombinierbar. Preis und Rabatt kommen aus derselben serverseitigen Berechnung wie Einzelkäufe und Stripe.

## Übernahme in den Warenkorb

`POST /api/cart/bundle` verlangt CSRF, eine feste Bundle-ID, genau drei passende Motive sowie eine Request-ID. Der Server erlaubt nur Modell, Farbe und Hüllenart als Änderungen. Er prüft alle Varianten und Druckdateien, bevor die drei Warenkorbpositionen in einer Transaktion angelegt werden. Serverpreise ersetzen mitgesendete Preisangaben. Bei fehlender Variante oder zu vollem Warenkorb entsteht kein Teil-Set. Wiederholungen derselben Request-ID fügen keine weiteren Hüllen hinzu. Jede Position behält ihre tatsächliche Standard-/MagSafe-Variante, Druckdatei und Menge für Stripe, Bestellmail und Podbase. Verkaufs- und Produktionsfreigaben werden nicht geändert.

## Bilddateien und Herstellung

Die beiden neuen fotografischen Szenen wurden mit dem **integrierten image_gen-Werkzeug** erzeugt. Anschließend wurden die freigegebenen Originalgrafiken samt vorhandenen Schriftpfaden per Code eingesetzt. Motive und Schrift wurden nicht durch das Bildmodell neu gezeichnet. `scripts/bundle-photos.mjs` nutzt `renderLayout`, die bestehende Modellgeometrie, proportional skalierte Druckflächen, bilineares Sampling und die Beleuchtung des Fotos. Die Weißflächen bleiben unverändert. Alle sechs Motive liegen vollständig unterhalb der Kamera.

Finale Dateien (1448 × 1086 Pixel):

- `public/assets/bundles-v1/hoffnung.webp`
- `public/assets/bundles-v1/geborgenheit.webp`

Reproduzierbare unbedruckte Vorlagen: `hoffnung-scene.webp` und `geborgenheit-scene.webp` im selben Ordner. Aufruf zum erneuten Einsetzen der Originale: `node scripts/bundle-photos.mjs`.

Originalausgaben im lokalen Codex-Verzeichnis `generated_images/01a1a2ec-2646-7621-99db-a849623028bb/`:

- `exec-3cabe5c9-60b9-4905-8913-86ff764786f1.png`
- `exec-daf1392f-30a9-44c1-a120-9f1780cec380.png`

### Prompt für Hoffnung für deinen Weg

> Use case: product-mockup. Create one premium PHOTOREALISTIC overhead product photograph, landscape 4:3, highest useful resolution. Exactly THREE iPhone 14 Pro phones inside completely blank warm-white satin tough cases, lying back-up side by side on pale warm limestone tabletop. Camera looks straight down, essentially orthographic product flat-lay (not a 3D render). All three phones portrait orientation, parallel, their long axes perfectly vertical; equally sized and evenly spaced with a clear gap; no overlap, all corners fully visible. At least 10 percent image margin around the trio. Each realistic camera has the normal three dark lenses and small flash in upper left, authentic rim and tiny metallic detail. The cases MUST be wholly blank unprinted white, no logo, no lettering, no circle, no decoration: original Archenlicht artwork will be precisely composited later. Soft late-afternoon window light from upper left, delicate tactile material texture, true natural contact shadows and subtle highlights on bevels. A tiny edge of undyed linen at the lower right far away from phones and a soft out-of-frame plant shadow give a believable calm home setting, leave all case backs unobstructed. Main subject is the trio, not props. True optical product photography, sharp case surfaces, accurate simple rectangular phone anatomy. No hand, no extra phone, no text, no watermark. Output one complete photograph.

### Prompt für In seiner Nähe

> Use case: product-mockup. One premium PHOTOREALISTIC product photograph for a Christian phone-case boutique, landscape 4:3. Exactly THREE iPhone 14 Pro phones in completely blank warm white satin tough protective cases, lying flat with BACKS facing up, side by side. Straight overhead flat-lay camera, near orthographic, all three long axes exactly vertical, identical phone size, even generous spacing, no touching, all phone corners fully inside image with 10 percent outer margin. Normal accurate three black camera lenses and small flash at upper-left of each phone, genuine tiny metallic details. Case backs entirely blank unprinted WHITE, no text, no logo, no rings; original artwork will be placed later by code. Calm real home environment: muted light sage-gray tabletop with very fine matte texture, a narrow naturally folded cream linen edge in the upper right corner far from phones, very faint window shadow toward lower left. Soft cool morning daylight, natural highlights at rounded case bevels and soft physical contact shadows. Image must look like professional optical photography of real products, not a computer rendering. Full case back in sharp focus, simple restrained composition, no hands, no extra objects, no extra phones, no artificial surreal distortion. No watermark or lettering.

## Prüfung

Automatische Tests: beide festen Zusammenstellungen, gemischte Modelle/Farben/MagSafe, Manipulationsschutz, kein Teil-Set bei Fehlern, idempotente Wiederholungen, Warenkorblimit, CSRF, Rabattstufen und unveränderte Positionen bis zum Podbase-Payload. Keine echte Zahlung oder Produktion wird dabei ausgelöst. Browserprüfung für beide Sets bei 320, 390, 768 und 1440 Pixeln, einschließlich unabhängigem Modellwechsel, MagSafe, Farbe, drei Druckvorschauen und gemeinsamem Warenkorb. Die normale Produkt-Modellauswahl wird mitgeprüft.
