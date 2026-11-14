// Calibrated white-case photographs. Coordinates refer to the 1122 x 1402 source.
// Camera/skin/background pixels are excluded from the printable case mask.
import { PREVIEW_MODEL } from './preview-model.js';
export const LIFESTYLE_MODEL = PREVIEW_MODEL;
export const LIFESTYLE_ASSETS = '/assets/lifestyle-v3';
const CALIBRATIONS = Object.freeze({
  'female-hand': {
    quad:[[368,230],[770,235],[756,1020],[352,1017]],
    body:'M455 230 C413 229 374 246 369 292 L356 924 C355 979 382 1015 439 1019 L675 1019 C725 1018 752 994 755 948 L765 325 C766 266 742 235 682 233 Z',
    camera:'M447 257 L687 257 Q748 257 748 316 L747 412 Q747 468 690 468 L444 468 Q396 468 396 413 L396 313 Q396 257 447 257 Z'
  },
  'female-table': {
    quad:[[479,197],[965,290],[761,1248],[196,1141]],
    body:'M552 212 C514 206 486 219 475 252 L216 1037 C198 1095 213 1141 270 1162 L625 1253 C673 1265 713 1252 731 1206 L938 387 C954 326 928 289 876 275 Z',
    camera:'M565 247 L863 302 Q913 312 902 353 L872 486 Q863 532 816 521 L512 461 Q467 451 478 409 L512 282 Q525 249 565 247 Z'
  },
  'male-hand': {
    quad:[[335,199],[790,195],[795,1097],[350,1097]],
    body:'M433 200 C373 200 340 222 337 278 L351 1008 C352 1066 377 1095 433 1097 L706 1096 C768 1094 791 1068 792 1012 L780 286 C779 224 754 196 699 196 Z',
    camera:'M432 225 H693 Q753 225 753 280 V405 Q753 458 697 458 H430 Q376 458 376 404 V282 Q376 225 432 225 Z'
  },
  'male-table': {
    quad:[[125,385],[558,264],[1029,1143],[545,1303]],
    body:'M215 370 C170 382 141 408 149 454 L460 1167 C486 1229 518 1269 572 1252 L925 1130 C975 1113 989 1073 971 1027 L596 347 C575 305 548 300 504 309 Z',
    camera:'M250 388 L490 331 C527 319 556 332 575 370 L626 465 C643 495 624 511 595 520 L333 582 C292 594 264 573 250 542 L202 457 C187 425 207 398 250 388 Z'
  }
});

// Every motif has its own two photographs. Only the calibrated product geometry
// is shared, so original artwork and all case colours still remain exact.
const SETTINGS = Object.freeze({
  'unter-seinen-fluegeln': { base: 'female', description: 'Am hellen Fenster' },
  'nach-dem-sturm': { base: 'male', description: 'An der Küste nach dem Regen' },
  'absetzen': { base: 'male', description: 'Bei einer Pause im Grünen' },
  'ganz-nah': { base: 'female', description: 'In einer gemütlichen Leseecke' },
  'im-schatten': { base: 'female', description: 'Im Schatten der Olivenblätter' },
  'getragen': { base: 'male', description: 'In einer ruhigen Buchhandlung' }
});
export const LIFESTYLE_SCENES = Object.freeze(Object.fromEntries(Object.entries(SETTINGS).flatMap(([designId, setting]) =>
  ['hand', 'table'].map(view => [`${designId}-${view}`, Object.freeze({ ...CALIBRATIONS[`${setting.base}-${view}`], base: `${setting.base}-${view}`, description: setting.description })])
)));

export function lifestyleScenes(designId) {
  if (!SETTINGS[designId]) throw new Error('Unbekanntes Motiv für die Fotoansicht.');
  return [`${designId}-hand`, `${designId}-table`];
}

// Solve the inverse projective map: photographic pixel -> flat case coordinates.
// The print is then sampled in one proportional flat frame, without retyping text.
export function inversePerspective(quad) {
  const target=[[0,0],[1,0],[1,1],[0,1]], rows=[];
  quad.forEach(([x,y],i)=>{
    const [u,v]=target[i];
    rows.push([x,y,1,0,0,0,-u*x,-u*y,u]);
    rows.push([0,0,0,x,y,1,-v*x,-v*y,v]);
  });
  for(let col=0;col<8;col++){
    let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(rows[row][col])>Math.abs(rows[pivot][col]))pivot=row;
    [rows[col],rows[pivot]]=[rows[pivot],rows[col]];
    const scale=rows[col][col];if(Math.abs(scale)<1e-10)throw new Error('Ungültige Fotoperspektive.');
    for(let j=col;j<9;j++)rows[col][j]/=scale;
    for(let row=0;row<8;row++)if(row!==col){const factor=rows[row][col];for(let j=col;j<9;j++)rows[row][j]-=factor*rows[col][j];}
  }
  return rows.map(row=>row[8]);
}

export function projectToCase(matrix,x,y) {
  const w=matrix[6]*x+matrix[7]*y+1;
  return [(matrix[0]*x+matrix[1]*y+matrix[2])/w,(matrix[3]*x+matrix[4]*y+matrix[5])/w];
}
