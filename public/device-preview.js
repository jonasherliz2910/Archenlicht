// Illustrative device geometry, not a manufacturer's production cutting template.
// Coordinates use a 1000-unit body width. See docs/DEVICE-PREVIEWS.md for sources.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rect = (x, y, width, height, radius = 80) => ({ x, y, width, height, radius });
const circle = (cx, cy, r) => ({ cx, cy, r });
const shape = (s, attributes = '') => 'r' in s
  ? `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${attributes}/>`
  : `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}" ${attributes}/>`;

const appleSizes = {
  'iphone-12':[71.5,146.7], 'iphone-12-pro':[71.5,146.7], 'iphone-12-pro-max':[78.1,160.8],
  'iphone-13':[71.5,146.7], 'iphone-13-mini':[64.2,131.5], 'iphone-13-pro':[71.5,146.7], 'iphone-13-pro-max':[78.1,160.8],
  'iphone-14':[71.5,146.7], 'iphone-14-plus':[78.1,160.8], 'iphone-14-pro':[71.5,147.5], 'iphone-14-pro-max':[77.6,160.7],
  'iphone-15':[71.6,147.6], 'iphone-15-plus':[77.8,160.9], 'iphone-15-pro':[70.6,146.6], 'iphone-15-pro-max':[76.7,159.9],
  'iphone-16':[71.6,147.6], 'iphone-16-plus':[77.8,160.9], 'iphone-16-pro':[71.5,149.6], 'iphone-16-pro-max':[77.6,163],
  'iphone-16e':[71.5,146.7], 'iphone-17e':[71.5,146.7], 'iphone-17':[71.5,149.6], 'iphone-air':[74.7,156.2],
  'iphone-17-pro':[71.9,150], 'iphone-17-pro-max':[78,163.4], 'iphone-18-pro':[71.9,150], 'iphone-18-pro-max':[78,163.4],
};

export function deviceProfile(model) {
  const id = model.id, generation = Number(id.match(/\d+/)?.[0] || 0);
  let family, openings, lenses, flash, sensor, island, screen, corner = 125, ratio = .475;
  if (model.brand === 'Apple') {
    const size = appleSizes[id]; if (!size) throw new Error(`Fehlendes Apple-Vorschauprofil: ${id}`);
    ratio = size[0] / size[1];
    if (id.includes('-pro') && generation >= 17) {
      family = 'apple-pro-plateau'; island = rect(48,65,904,575,125);
      lenses = [circle(220,225,117),circle(220,485,117),circle(455,355,117)];
      flash = circle(795,220,39); sensor = circle(795,480,38); openings = [island];
    } else if (id.includes('-pro')) {
      family = generation === 12 ? 'apple-pro-12' : 'apple-pro-square';
      const scale = generation === 12 ? .83 : generation === 13 ? .94 : 1;
      island = rect(60,65,580*scale,590*scale,110*scale);
      lenses = [circle(215,220,112),circle(215,490,112),circle(460,355,112)].map(s=>circle(60+(s.cx-60)*scale,65+(s.cy-65)*scale,s.r*scale));
      flash = circle(60+415*scale,65+70*scale,32*scale); sensor = circle(60+415*scale,65+490*scale,31*scale); openings = [island];
    } else if (id === 'iphone-air') {
      family = 'apple-air'; island = rect(45,65,910,340,115); lenses = [circle(220,235,115)]; flash = circle(470,235,35); openings = [island];
    } else if (/\de$/.test(id)) {
      family = 'apple-single'; lenses = [circle(220,225,115)]; flash = circle(445,225,34); openings = [circle(220,225,143),circle(445,225,48)];
    } else if (generation >= 16) {
      family = 'apple-dual-pill'; island = rect(75,65,290,555,140); lenses = [circle(220,215,102),circle(220,470,102)]; flash = circle(470,340,36); openings = [island,circle(470,340,49)];
    } else if (generation === 12) {
      family = 'apple-dual-vertical'; island = rect(65,70,420,485,100); lenses = [circle(205,205,85),circle(205,425,85)]; flash = circle(390,315,33); openings = [island];
    } else {
      family = 'apple-dual-diagonal'; island = rect(65,70,470,490,110); lenses = [circle(210,220,99),circle(395,410,99)]; flash = circle(420,180,32); openings = [island];
    }
  } else if (model.brand === 'Google') {
    const pro = id.includes('-pro'), a = /\da$/.test(id);
    ratio = id.includes('-xl') ? .475 : pro && generation < 9 ? .468 : .472;
    family = a && generation >= 9 ? 'pixel-a-flat' : generation >= 9 ? 'pixel-pill' : 'pixel-bar';
    island = family === 'pixel-a-flat' ? rect(75,175,475,225,112) : family === 'pixel-pill' ? rect(45,170,910,305,150) : rect(16,170,968,330,38);
    lenses = family === 'pixel-a-flat' ? [circle(205,288,78),circle(420,288,78)] : [circle(205,335,93),circle(440,335,93),...(pro||generation>=10&&!a?[circle(670,335,89)]:[])];
    flash = family === 'pixel-a-flat' ? circle(715,288,32) : circle(850,335,34);
    openings = [island,...(family === 'pixel-a-flat' ? [circle(715,288,46)] : [])];
  } else if (model.brand === 'Samsung') {
    const ultra = id.includes('-ultra'), flip = id.includes('-flip'), edge = id.includes('-edge');
    ratio = flip ? .445 : ultra ? .48 : id.includes('galaxy-a') ? .473 : .474;
    corner = ultra && generation >= 22 && generation <= 24 ? 34 : ultra ? 85 : 115;
    if (flip) {
      family = 'galaxy-flip'; screen = rect(55,65,890,845,95); island = screen;
      lenses = [circle(210,745,85),circle(435,745,85)]; flash = circle(625,745,29); openings = [screen];
    } else if (edge) {
      family = 'galaxy-edge'; island = rect(70,65,270,470,130); lenses = [circle(205,190,88),circle(205,410,88)]; flash = circle(420,190,30); openings = [island,circle(420,190,44)];
    } else {
      lenses = [circle(190,185,91),circle(190,420,91),circle(190,655,91)];
      flash = circle(410,315,30);
      if (ultra) {
        family = generation === 21 ? 'galaxy-ultra-island' : generation >= 26 ? 'galaxy-ultra-pill' : 'galaxy-ultra-rings';
        lenses.push(circle(415,185,62),circle(415,510,74));
        if (generation === 21) island = rect(55,60,520,720,90);
        else if (generation >= 26) island = rect(55,55,275,735,130);
      } else {
        family = /^s2[12]/.test(id.replace('samsung-galaxy-','')) ? 'galaxy-s-island' : generation >= 26 && id.includes('-s') || /-a(56|36|26|57|37|27)/.test(id) ? 'galaxy-triple-pill' : 'galaxy-triple-rings';
        if (family.endsWith('island') || family.endsWith('pill')) island = rect(55,55,275,735,family.endsWith('pill')?130:75);
      }
      openings = family === 'galaxy-ultra-island' ? [island] : island ? [island,...lenses.filter(l=>l.cx>330).map(l=>circle(l.cx,l.cy,l.r+17)),circle(flash.cx,flash.cy,44)] : [...lenses.map(l=>circle(l.cx,l.cy,l.r+18)),circle(flash.cx,flash.cy,44)];
    }
  } else throw new Error(`Fehlendes Geräteprofil: ${id}`);
  return { modelId:id, family, width:1000, height:Math.round(1000/ratio), corner, openings, lenses, flash, sensor, island, screen, illustrative:true };
}

let serial = 0;
export function phoneMockup(model, { imageUrl, color='#FCFAF4', className='', caseOnly=false, label } = {}) {
  const p = deviceProfile(model), uid = `device-${++serial}`, holeId = `${uid}-holes`, rimId = `${uid}-rim`, lensId = `${uid}-lens`;
  const holes = p.openings.map(s=>shape(s,'fill="black"')).join('');
  const body = rect(12,12,p.width-24,p.height-24,p.corner);
  const img = model.template || { width:1200,height:2400 };
  const scale = Math.min((p.width-40)/img.width,(p.height-40)/img.height), iw = img.width*scale, ih = img.height*scale;
  const lens = l => `${shape(l,`fill="#657069" stroke="#c0c7bf" stroke-width="13"`)}${shape(circle(l.cx,l.cy,l.r*.82),`fill="url(#${lensId})"`)}${shape(circle(l.cx-l.r*.27,l.cy-l.r*.29,l.r*.17),'fill="#a6c1cc" opacity=".5"')}`;
  const hardware = caseOnly ? '' : `<g class="device-hardware">${p.island?shape(p.island,`fill="${p.screen?'#222a29':'#b6bfb6'}" stroke="#7b877e" stroke-width="9"`):''}${p.lenses.map(lens).join('')}${shape(p.flash,'fill="#ede9d6" stroke="#929c91" stroke-width="8"')}${p.sensor?shape(p.sensor,'fill="#39443d"'):''}</g>`;
  const title = label || `${model.name} – ${caseOnly?'Hülle mit offener Kameraaussparung':'Hülle am Handy'}`;
  return `<div class="phone model-mockup ${esc(className)} ${caseOnly?'case-only':''}" data-device-model="${esc(model.id)}" data-camera-family="${p.family}" style="--device-ratio:${p.width}/${p.height}"><svg class="device-drawing" viewBox="0 0 ${p.width} ${p.height}" role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${rimId}" x1="0" y1="0" x2="1" y2=".5"><stop stop-color="#56615a"/><stop offset=".5" stop-color="#242c27"/><stop offset="1" stop-color="#6c776e"/></linearGradient><radialGradient id="${lensId}"><stop stop-color="#172931"/><stop offset=".28" stop-color="#253d46"/><stop offset=".45" stop-color="#0b151b"/><stop offset=".72" stop-color="#26372f"/><stop offset="1" stop-color="#0d1612"/></radialGradient><mask id="${holeId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${p.width}" height="${p.height}"><rect width="${p.width}" height="${p.height}" fill="white"/>${holes}</mask><clipPath id="${uid}-outline">${shape(body)}</clipPath></defs><g clip-path="url(#${uid}-outline)" mask="url(#${holeId})">${shape(body,`fill="${esc(color)}"`)}<image class="device-artwork" href="${esc(imageUrl)}" x="${(p.width-iw)/2}" y="${(p.height-ih)/2}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid meet"/>${shape(body,`fill="none" stroke="url(#${rimId})" stroke-width="28"`)}${shape(rect(30,30,p.width-60,p.height-60,Math.max(5,p.corner-14)),'fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="5"')}</g>${hardware}<g class="camera-opening-rims" fill="none" stroke="#414d44" stroke-width="13">${p.openings.map(s=>shape(s)).join('')}</g></svg></div>`;
}
