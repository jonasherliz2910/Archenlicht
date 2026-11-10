import { deviceProfile } from './device-preview.js';

// Reviewed photographic templates. Related sizes share a camera-family photo;
// production dimensions still come exclusively from the selected Podbase template.
export const STUDIO_SOURCE = {width:1122,height:1402};
const round = (x,y,width,height,radius) => ({x,y,width,height,radius});
const circle = (cx,cy,r) => ({cx,cy,r});
const standardBody='M350 73 L735 73 C810 73 850 111 850 190 L850 1198 C850 1278 810 1315 735 1315 L350 1315 C272 1315 234 1278 234 1198 L234 190 C234 111 272 73 350 73 Z';
const scene=(openings,extra={})=>({quad:[[234,73],[850,73],[850,1315],[234,1315]],body:standardBody,openings,...extra});
export const STUDIO_SCENES = {
 'apple-pro-square':scene([round(281,128,324,326,78)]),
 'apple-dual-diagonal':scene([round(282,130,277,274,76)]),
 'apple-pro-plateau':scene([round(282,125,525,313,80)]),
 'apple-dual-vertical':scene([round(283,133,218,258,62)]),
 'apple-pro-12':scene([round(298,146,223,252,62)]),
 'apple-dual-pill':scene([round(285,135,151,301,76),circle(492,277,28)]),
 'apple-single':scene([circle(351,204,69),circle(483,203,25)]),
 'apple-air':scene([round(280,120,530,178,89)]),
 'galaxy-triple-rings':scene([circle(351,195,58),circle(351,328,58),circle(351,467,58),circle(457,260,22)]),
 'galaxy-ultra-rings':scene([circle(345,190,65),circle(345,338,65),circle(345,489,65),circle(475,188,40),circle(475,486,40),circle(475,280,25)],{quad:[[220,72],[848,72],[848,1315],[220,1315]],body:'M250 72 H815 Q848 72 848 108 V1283 Q848 1315 815 1315 H253 Q221 1315 221 1283 V108 Q221 72 250 72 Z'}),
 'galaxy-s-island':scene([round(271,116,140,367,34),circle(445,244,25)]),
 'galaxy-ultra-island':scene([{path:'M355 103 H474 Q550 103 550 177 V353 Q550 416 488 420 Q443 421 440 476 Q440 541 368 541 H351 Q280 541 280 459 V180 Q280 103 355 103 Z'}]),
 'galaxy-edge':scene([round(287,133,154,336,76),circle(502,193,28)]),
 'galaxy-triple-pill':scene([round(283,128,150,405,74),circle(478,267,26)]),
 'galaxy-ultra-pill':scene([round(281,125,159,430,79),circle(510,201,44),circle(510,459,43),circle(509,325,26)],{body:'M290 73 H790 Q849 73 849 132 V1254 Q849 1315 790 1315 H293 Q234 1315 234 1254 V132 Q234 73 290 73 Z'}),
 'pixel-bar':scene([round(258,200,573,167,34)]),
 'pixel-bar-dual':scene([round(255,205,575,158,33)]),
 'pixel-pill':scene([round(281,194,522,166,83)]),
 'pixel-pill-dual':scene([round(280,192,519,177,86)]),
 'pixel-a-flat':scene([round(298,207,224,117,58),circle(590,264,27)]),
 'galaxy-flip':scene([round(276,111,538,533,46)],{fold:[679,691],body:'M315 76 H767 Q845 76 845 159 V1230 Q845 1315 765 1315 H316 Q236 1315 236 1230 V160 Q236 76 315 76 Z',quad:[[236,76],[845,76],[845,1315],[236,1315]]})
};
export function studioSceneId(model) {
 const p=deviceProfile(model);
 if((p.family==='pixel-bar'||p.family==='pixel-pill')&&p.lenses.length===2)return `${p.family}-dual`;
 if(!STUDIO_SCENES[p.family])throw new Error(`Fehlende Fotovorlage: ${model.id}`);
 return p.family;
}
