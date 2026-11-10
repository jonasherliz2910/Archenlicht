// Calibrated white-case photographs. Coordinates refer to the 1122 x 1402 source.
// Camera/skin/background pixels are excluded from the printable case mask.
export const LIFESTYLE_MODEL = Object.freeze({ id:'iphone-14-pro', name:'iPhone 14 Pro', brand:'Apple' });
export const LIFESTYLE_SCENES = Object.freeze({
  'female-hand': {
    quad:[[368,230],[770,235],[756,1020],[352,1017]],
    body:'M455 230 C413 229 374 246 369 292 L356 924 C355 979 382 1015 439 1019 L675 1019 C725 1018 752 994 755 948 L765 325 C766 266 742 235 682 233 Z',
    camera:'M449 260 L539 260 C573 260 595 282 595 316 L595 412 C595 446 574 464 541 465 L451 465 C417 465 400 447 400 414 L400 312 C400 279 418 261 449 260 Z'
  },
  'female-table': {
    quad:[[479,197],[965,290],[761,1248],[196,1141]],
    body:'M552 212 C514 206 486 219 475 252 L216 1037 C198 1095 213 1141 270 1162 L625 1253 C673 1265 713 1252 731 1206 L938 387 C954 326 928 289 876 275 Z',
    camera:'M565 247 L689 267 C725 273 741 294 732 333 L701 453 C693 485 674 498 638 490 L509 464 C475 457 460 435 472 403 L515 281 C524 252 539 243 565 247 Z'
  },
  'male-hand': {
    quad:[[335,199],[790,195],[795,1097],[350,1097]],
    body:'M433 200 C373 200 340 222 337 278 L351 1008 C352 1066 377 1095 433 1097 L706 1096 C768 1094 791 1068 792 1012 L780 286 C779 224 754 196 699 196 Z',
    camera:'M435 228 L533 226 C569 226 589 249 589 283 L590 405 C590 439 568 458 535 458 L430 458 C397 458 379 437 379 404 L377 283 C378 248 399 230 435 228 Z'
  },
  'male-table': {
    quad:[[125,385],[558,264],[1029,1143],[545,1303]],
    body:'M215 370 C170 382 141 408 149 454 L460 1167 C486 1229 518 1269 572 1252 L925 1130 C975 1113 989 1073 971 1027 L596 347 C575 305 548 300 504 309 Z',
    camera:'M243 392 L374 363 C399 361 419 381 431 407 L479 502 C490 534 470 555 444 561 L337 590 C309 598 280 580 266 554 L210 458 C197 431 210 405 243 392 Z'
  }
});

export function lifestyleScenes(designId) {
  const setting = ['getragen','absetzen','im-schatten'].includes(designId) ? 'male' : 'female';
  return [`${setting}-hand`,`${setting}-table`];
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
