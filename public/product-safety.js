// Published Podbase information, checked on 2026-11-14.
// Sources and the scope of these statements: docs/PODBASE-PRODUKTANGABEN.md.
export const CASE_MANUFACTURER = Object.freeze({
  name: 'Podbase UAB',
  street: 'A. Goštauto g. 12A',
  locality: 'LT-01108 Vilnius, Litauen',
  email: 'support@podbase.com',
  source: 'https://help.podbase.com/hc/en-us/articles/26734494864284-Where-is-Podbase-registered-as-a-VAT-payer'
});

export function productSafety() {
  return `<section class="product-safety" aria-label="Hersteller und Pflegehinweise">
    <h2>Hersteller & Pflegehinweise</h2>
    <p class="product-safety-scope">Für unsere Tough-Hüllen, auch mit MagSafe- oder Magnet-Option.</p>
    <div class="product-safety-grid">
      <div><h3>Hersteller</h3><address><strong>${CASE_MANUFACTURER.name}</strong><br>${CASE_MANUFACTURER.street}<br>${CASE_MANUFACTURER.locality}<br><a class="product-safety-source" href="mailto:${CASE_MANUFACTURER.email}">${CASE_MANUFACTURER.email}</a></address><a class="product-safety-source" href="${CASE_MANUFACTURER.source}" target="_blank" rel="noopener noreferrer" aria-label="Herstellerinformationen bei Podbase (öffnet einen neuen Tab)">Herstellerinformationen bei Podbase <span aria-hidden="true">↗</span></a></div>
      <div><h3>Pflegehinweise von Podbase</h3><ul><li>Kontakt mit stark alkoholhaltigen Flüssigkeiten vermeiden; sie können den Motivdruck beschädigen.</li><li>Vor direkter Sonneneinstrahlung schützen, um Vergilbungen zu vermeiden.</li></ul></div>
    </div>
    <p class="product-safety-contact"><strong>Fragen zur Produktsicherheit?</strong> Schreib uns an <a href="mailto:info@archenlicht.de">info@archenlicht.de</a>. Bei einem bekannt gewordenen Sicherheitsproblem informieren wir betroffene Kundinnen und Kunden über die notwendigen Maßnahmen.</p>
  </section>`;
}
