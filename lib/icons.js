// Paint Through the Ages — 16x16 tool icons drawn as crisp SVG.
// Copyright (c) 2026 der_zuhalter. MIT License.
const K = '#000', W = '#fff', G = '#808080', L = '#c0c0c0', Y = '#ffff00', R = '#ff0000', B = '#0000ff', N = '#000080';
const r = (x, y, w, h, f = K) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const p = (d, f = 'none', s = K) => `<path d="${d}" fill="${f}" stroke="${s}" stroke-width="1"/>`;
const dash = (x, y, w, h) => `<rect x="${x + .5}" y="${y + .5}" width="${w}" height="${h}" fill="none" stroke="${K}" stroke-dasharray="1 1"/>`;
const svg = s => `<svg viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges">${s}</svg>`;

export const ICONS = {
  freeselect: svg(p('M3.5 2.5 L9.5 1.5 L13.5 5.5 L11.5 9.5 L13.5 13.5 L6.5 14.5 L2.5 10.5 L4.5 6.5 Z', 'none') .replace('stroke-width="1"', 'stroke-width="1" stroke-dasharray="1 1"')),
  select: svg(dash(2, 3, 11, 10)),
  hand: svg(p('M5.5 14.5 L3.5 9.5 L3.5 7.5 L5.5 8.5 L5.5 2.5 L7.5 2.5 L7.5 7.5 L7.5 1.5 L9.5 1.5 L9.5 7.5 L9.5 2.5 L11.5 2.5 L11.5 8.5 L11.5 4.5 L13.5 4.5 L13.5 10.5 L11.5 14.5 Z', W)),
  eraser: svg(p('M2.5 9.5 L8.5 3.5 L13.5 8.5 L7.5 14.5 L4.5 14.5 L2.5 12.5 Z', W) + p('M5.5 6.5 L10.5 11.5', 'none') + r(6, 10, 1, 1)),
  cerase: svg(p('M2.5 9.5 L8.5 3.5 L13.5 8.5 L7.5 14.5 L4.5 14.5 L2.5 12.5 Z', '#ff8080') + p('M5.5 6.5 L10.5 11.5', 'none')),
  fill: svg(p('M3.5 7.5 L8.5 2.5 L13.5 7.5 L8.5 12.5 Z', W) + p('M3.5 7.5 L3.5 12.5', 'none', B) + r(2, 12, 3, 2, B) + r(9, 0, 1, 5)),
  picker: svg(p('M2.5 13.5 L9.5 6.5', 'none') + p('M8.5 5.5 L11.5 2.5 L13.5 4.5 L10.5 7.5 Z', K) + r(2, 13, 2, 2, B)),
  magnifier: svg(`<circle cx="6.5" cy="6.5" r="4" fill="#c0e0ff" stroke="${K}"/>` + p('M9.5 9.5 L14.5 14.5', 'none') + p('M10.5 9.5 L15.5 14.5', 'none')),
  pencil: svg(p('M3.5 12.5 L11.5 4.5 L13.5 6.5 L5.5 14.5 L3.5 14.5 Z', Y) + p('M11.5 4.5 L12.5 3.5 L14.5 5.5 L13.5 6.5', R) + r(3, 13, 2, 2)),
  brush: svg(p('M10.5 1.5 L13.5 4.5 L9.5 8.5 L7.5 6.5 Z', '#c08040') + p('M7.5 7.5 L8.5 8.5 L6.5 12.5 L2.5 14.5 L3.5 10.5 Z', B)),
  air: svg(p('M5.5 6.5 L10.5 6.5 L10.5 14.5 L5.5 14.5 Z', L) + r(7, 3, 2, 3) + r(10, 2, 2, 1) + r(2, 1, 1, 1) + r(4, 2, 1, 1) + r(1, 4, 1, 1) + r(3, 4, 1, 1) + r(5, 1, 1, 1)),
  text: svg(p('M3.5 13.5 L7.5 2.5 L8.5 2.5 L12.5 13.5', 'none') + r(5, 9, 6, 1) + r(2, 13, 4, 1) + r(10, 13, 4, 1)),
  line: svg(p('M2.5 13.5 L13.5 2.5')),
  curve: svg(p('M2.5 13.5 C 3 3, 8 14, 13.5 2.5')).replace('crispEdges', 'auto'),
  rect: svg(r(2, 4, 12, 9, K) + r(3, 5, 10, 7, W)),
  rectf: svg(r(2, 4, 12, 9, K) + r(3, 5, 10, 7, G)),
  rrect: svg(`<rect x="2.5" y="4.5" width="11" height="8" rx="3" fill="${W}" stroke="${K}"/>`).replace('crispEdges', 'auto'),
  rrectf: svg(`<rect x="2.5" y="4.5" width="11" height="8" rx="3" fill="${G}" stroke="${K}"/>`).replace('crispEdges', 'auto'),
  ellipse: svg(`<ellipse cx="8" cy="8.5" rx="6" ry="4.5" fill="${W}" stroke="${K}"/>`).replace('crispEdges', 'auto'),
  ellipsef: svg(`<ellipse cx="8" cy="8.5" rx="6" ry="4.5" fill="${G}" stroke="${K}"/>`).replace('crispEdges', 'auto'),
  poly: svg(p('M2.5 13.5 L5.5 3.5 L10.5 6.5 L13.5 2.5 L12.5 13.5 Z', W)),
  polyf: svg(p('M2.5 13.5 L5.5 3.5 L10.5 6.5 L13.5 2.5 L12.5 13.5 Z', G)),
  freeform: svg(p('M3.5 12.5 C 1 6, 6 1, 9 4 S 15 6, 12 12 S 6 15, 3.5 12.5 Z', W)).replace('crispEdges', 'auto'),
  freeformf: svg(p('M3.5 12.5 C 1 6, 6 1, 9 4 S 15 6, 12 12 S 6 15, 3.5 12.5 Z', G)).replace('crispEdges', 'auto'),
  scissors: svg(`<circle cx="4.5" cy="12" r="2" fill="none" stroke="${K}"/><circle cx="11.5" cy="12" r="2" fill="none" stroke="${K}"/>` + p('M5.5 10.5 L11.5 1.5 M10.5 10.5 L4.5 1.5') + dash(0, 0, 15, 15)).replace('crispEdges', 'auto'),
};
