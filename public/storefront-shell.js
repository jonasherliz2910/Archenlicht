import { icon } from './icons.js';

// Public markup only; sessions, prices and inventory always come from bootstrap.
export function headerMarkup({ path = '/', cartCount, logo }) {
  const cartLabel = Number.isInteger(cartCount) ? `Warenkorb, ${cartCount} Artikel` : 'Warenkorb';
  return `<div class="header-inner">${logo}<nav aria-label="Hauptnavigation"><a href="/kollektion" class="${path.includes('/kollektion') ? 'active' : ''}">Die Kollektion</a><a href="/gestalten" class="${path === '/gestalten' ? 'active' : ''}">Dein Wunschvers ${icon('spark')}</a><a href="/bundle" class="${path === '/bundle' ? 'active' : ''}">Bundles</a><a href="/ueber-uns">Unsere Geschichte</a></nav><div class="header-actions"><a href="/konto" data-reload aria-label="Mein Konto" title="Mein Konto">${icon('user')}</a><a href="/warenkorb" data-reload class="cart-link" aria-label="${cartLabel}">${icon('bag')}<span>${cartCount}</span></a><button class="icon-button mobile-menu" aria-label="Menü öffnen" aria-expanded="false" data-action="menu">${icon('menu')}</button></div></div>`;
}

export function homeHero() {
  return `<section class="hero hero-centered section-wrap" aria-labelledby="home-title">
    <div class="hero-copy">
      <span class="eyebrow"><span class="little-line" aria-hidden="true"></span> CHRISTLICHE HANDYHÜLLEN MIT DEINEM VERS</span>
      <h1 id="home-title">Ein Vers für<br>deinen <em>Alltag.</em></h1>
      <p class="hero-description">Manche Worte tragen uns. Nimm sie mit – auf einer Hülle, die dich erinnert, ermutigt und ein kleines Stück Hoffnung schenkt.</p>
      <div class="hero-buttons">
        <a class="button primary" href="/kollektion">Kollektion entdecken ${icon('right')}</a>
        <a class="text-button" href="/gestalten">Hülle mit Wunschvers gestalten ${icon('arrow')}</a>
      </div>
      <div class="hero-benefits"><span>${icon('truck')} Versand in DE inklusive</span><span>${icon('gift')} Mit Geschenkkarte</span></div>
    </div>
  </section>`;
}
