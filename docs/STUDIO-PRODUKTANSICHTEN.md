# Studioansichten und Produkteigenschaften

Die ersten beiden Bilder der fertigen Motive sind modellabhängige 3D-Studiovorschauen vor weißem Hintergrund mit weichem Bodenschatten. Sie sind keine Fotos eines bereits produzierten Musters. Ansicht 1 zeigt die Hülle am Handy, Ansicht 2 die Hülle mit offener Kameraaussparung. Beide vorhandenen Lifestyle-Fotos und der sonstige Seitenaufbau bleiben bestehen.

## Originale und Modelltreue

- `public/studio-photos.js` nutzt dieselben Geräteprofile und `printFrame` wie die vorhandene Modellvorschau. Die bestätigte Druckdatei wird ohne neu generierte Verse oder Motive auf die Hülle gelegt.
- Alle neun Hintergrundfarben und die Platzierung auf einer Klapphälfte bei Galaxy-Z-Flip-Modellen bleiben erhalten. MagSafe-Auswahl und Bestellung verwenden weiterhin die bestehenden echten Varianten. Es wird kein erfundener äußerer Magnetring auf das Motiv gezeichnet.
- Vorderseite, Seitenwand, Kamerarand, optische Oberflächen und Schatten werden räumlich gerendert. Nach einem Modell- oder Farbwechsel werden die zwei Bilder und ihre Miniaturen gemeinsam aktualisiert; veraltete Antworten werden verworfen.
- Ein einzelner WebGL-Renderer erzeugt bedarfsweise Standbilder. Kein dauerhafter Animationszyklus, keine externen Skripte. Bei fehlender WebGL-Unterstützung bleibt die bisherige modellgenaue Vorschau bedienbar.
- Three.js ist auf Version 0.180.0 festgelegt. Die lokal ausgelieferten Browsermodule und die MIT-Lizenz liegen unter `public/vendor/three/`. Reproduzierbar mit `node scripts/vendor-studio.mjs` nach `pnpm install`.

## Erzeugter Bildbaustein

Die optische Kameratextur wurde mit dem integrierten **image_gen** erzeugt (kein CLI-Fallback). Sie wird nur für Kameraglas verwendet; die Kundengestaltung wird nicht durch KI verändert.

- Projektdatei: `public/assets/studio-v1/camera-optics.webp`, 512 × 512, mit Transparenz.
- Original: `C:/Users/Jonas/.codex/generated_images/01a1a2ec-2646-7621-99db-a849623028bb/exec-fac1b570-c532-4089-9623-1ebb6d2b90dd.png`.
- Verarbeitung: transparente Außenränder entfernt, proportional auf 512 × 512 verkleinert, WebP Qualität 95, Alphaqualität 100.

Verwendeter Prompt:

> Use case: product-mockup. Asset type: photographic camera-glass material for physically rendered smartphone case product photographs. Generate a single perfectly circular smartphone rear camera lens photographed exactly straight-on, orthographic frontal macro view. One lens only, centered, occupying 92% of a square canvas. Real optical glass with a very dark charcoal-black pupil, subtle dark blue and muted violet antireflection coating, restrained concentric optical elements, a soft elongated white studio softbox reflection at upper left. Thin polished graphite metal retaining ring. High-end real commercial macro product photography, exceptionally clean and crisp, no illustration or cartoon. No text, no logo, no numbers, no hardware outside the circular retaining ring, no phone body, no ground, no cast shadow. The area outside the circular lens must be fully transparent. This lens image is a reusable surface texture; maintain circular symmetry and a perfectly centered optical axis.

## Eigenschaften und Aufrufe

Die Häkchen nennen vorhandene Eigenschaften: Doppelschicht, Motiv ohne Markenaufdruck, Versand innerhalb Deutschlands inklusive und die Geschenkkarte zum Selbstbeschriften (10 × 15 cm). Fremde Material-, Schutz- oder Bewertungsversprechen wurden nicht übernommen.

Ein monatlicher Hinweis erscheint erst ab mindestens 100 tatsächlich erfassten Besuchen eines festen Motivs. Die Zahl wird auf volle Hunderter abgerundet und als **Besuche**, nicht als Personen oder Verkäufe, bezeichnet. Quelle sind vorhandene Ereignisse mit Statistik-Einwilligung, einmal je Sitzung/Motiv, ausschließlich Live-Daten im aktuellen Kalendermonat nach Europe/Berlin. Eigene Sitzung, zuordenbare Admin-Sitzungen, Testdaten, Warenkorbzugänge, personalisierte Produktansichten und zukünftige Ereignisse zählen nicht. Unterhalb der Schwelle, im Testshop oder bei einem Statistikfehler bleibt der Hinweis vollständig verborgen. Keine erfundenen Namen, Bewertungen oder Nutzerzahlen.

Prüfungen: `tests/product-interest.test.js`, bestehende Einwilligungs- und Geräteprofiltests; Browserprüfung der Studioansichten, Farbauswahl, Galerie, Modellwechsel und Warenkorb.
