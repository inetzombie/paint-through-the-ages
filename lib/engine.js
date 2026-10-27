// Paint Through the Ages — shared, op-based raster engine.
// Copyright (c) 2026 der_zuhalter. MIT License.
// Every pixel mutation is a plain JSON "op" applied by doOp(), so a future
// sync layer only has to ship ops between clients.

export function hex2u32(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}
export function u322hex(u) {
  return '#' + [u & 255, (u >> 8) & 255, (u >> 16) & 255].map(v => v.toString(16).padStart(2, '0')).join('');
}
export const solid = c => ({ t: 'c', c });
export const pattern = (p, fg = '#000000', bg = '#ffffff') => ({ t: 'p', p, fg, bg });

export function compilePaint(paint) {
  if (!paint) return null;
  if (paint.t === 'c') { const u = hex2u32(paint.c); return () => u; }
  const f = hex2u32(paint.fg), b = hex2u32(paint.bg), p = paint.p;
  return (x, y) => ((p[y & 7] >> (7 - (x & 7))) & 1) ? f : b;
}

export class Surface {
  constructor(w, h, d) { this.w = w; this.h = h; this.d = d || new Uint32Array(w * h); }
  clone() { return new Surface(this.w, this.h, new Uint32Array(this.d)); }
  get(x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.d[y * this.w + x] : 0; }
}

export function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- brush stamps ----------
const stampCache = new Map();
export function stampOffsets(shape, size) {
  size = Math.max(1, size | 0);
  const key = shape + size;
  if (stampCache.has(key)) return stampCache.get(key);
  const o0 = -Math.floor((size - 1) / 2), out = [];
  const c = (size - 1) / 2, r2 = (size / 2) ** 2 - 0.5;
  for (let i = 0; i < size; i++) {
    switch (shape) {
      case 'hline': out.push([o0 + i, 0]); break;
      case 'vline': out.push([0, o0 + i]); break;
      case 'fslash': out.push([o0 + i, -(o0 + i)]); break;
      case 'bslash': out.push([o0 + i, o0 + i]); break;
      default:
        for (let j = 0; j < size; j++) {
          if (shape === 'square' || size <= 2) out.push([o0 + i, o0 + j]);
          else if (shape === 'round' && (i - c) ** 2 + (j - c) ** 2 <= r2) out.push([o0 + i, o0 + j]);
          else if (shape === 'dots' && (i - c) ** 2 + (j - c) ** 2 <= r2 && (i % 2 === 0) && (j % 2 === (i % 4 ? 1 : 0))) out.push([o0 + i, o0 + j]);
        }
    }
  }
  if (!out.length) out.push([0, 0]);
  stampCache.set(key, out);
  return out;
}

export function bres(x0, y0, x1, y1, cb) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    cb(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function plotter(S, pf, only) {
  const { w, h, d } = S;
  if (only == null) return (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) d[y * w + x] = pf(x, y); };
  return (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h && d[y * w + x] === only) d[y * w + x] = pf(x, y); };
}
function stamper(plot, shape, size) {
  const offs = stampOffsets(shape, size);
  return (x, y) => { for (const [dx, dy] of offs) plot(x + dx, y + dy); };
}
function hspan(plot, y, l, r) { for (let x = l; x <= r; x++) plot(x, y); }

// ---------- span generators ----------
function norm(x0, y0, x1, y1) { return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]; }
function ellipseRows(x0, y0, x1, y1) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1, cx = x0 + w / 2, cy = y0 + h / 2, rx = w / 2, ry = h / 2, rows = new Map();
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry, t = 1 - dy * dy;
    if (t < 0) continue;
    const dx = rx * Math.sqrt(t);
    let l = Math.round(cx - dx), r = Math.round(cx + dx) - 1;
    if (r < l) l = r = Math.floor(cx);
    rows.set(y, [l, r]);
  }
  return rows;
}
function rrectRows(x0, y0, x1, y1, rad) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1, r = Math.max(0, Math.min(rad, w / 2, h / 2)), rows = new Map();
  for (let y = y0; y <= y1; y++) {
    let dy = 0;
    if (y < y0 + r) dy = y0 + r - (y + 0.5);
    else if (y > y1 - r) dy = (y + 0.5) - (y1 + 1 - r);
    const inset = dy > 0 ? Math.round(r - Math.sqrt(Math.max(0, r * r - dy * dy))) : 0;
    rows.set(y, [x0 + inset, x1 - inset]);
  }
  return rows;
}
function rectRows(x0, y0, x1, y1) { const rows = new Map(); for (let y = y0; y <= y1; y++) rows.set(y, [x0, x1]); return rows; }
const ROWS = { rect: rectRows, ellipse: ellipseRows, rrect: rrectRows };

function fillShape(plot, kind, x0, y0, x1, y1, rad) {
  for (const [y, [l, r]] of ROWS[kind](x0, y0, x1, y1, rad)) hspan(plot, y, l, r);
}
function outlineShape(plot, kind, x0, y0, x1, y1, lw, rad) {
  const outer = ROWS[kind](x0, y0, x1, y1, rad);
  const inner = (x1 - x0 + 1 > 2 * lw && y1 - y0 + 1 > 2 * lw) ? ROWS[kind](x0 + lw, y0 + lw, x1 - lw, y1 - lw, Math.max(0, rad - lw)) : new Map();
  for (const [y, [l, r]] of outer) {
    const ir = inner.get(y);
    if (!ir || ir[0] > ir[1]) { hspan(plot, y, l, r); continue; }
    hspan(plot, y, l, Math.min(r, ir[0] - 1));
    hspan(plot, y, Math.max(l, ir[1] + 1), r);
  }
}
export function polyFill(plot, pts) {
  const n = pts.length / 2; if (n < 3) return;
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 1; i < pts.length; i += 2) { ymin = Math.min(ymin, pts[i]); ymax = Math.max(ymax, pts[i]); }
  for (let y = Math.floor(ymin); y <= Math.ceil(ymax); y++) {
    const py = y + 0.5, xs = [];
    for (let i = 0; i < n; i++) {
      const ax = pts[2 * i] + 0.5, ay = pts[2 * i + 1] + 0.5, j = (i + 1) % n, bx = pts[2 * j] + 0.5, by = pts[2 * j + 1] + 0.5;
      if ((ay <= py && by > py) || (by <= py && ay > py)) xs.push(ax + (py - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) hspan(plot, y, Math.ceil(xs[k] - 0.5), Math.ceil(xs[k + 1] - 0.5) - 1);
  }
}
export function polyMask(poly, bx, by, w, h) {
  const m = new Uint8Array(w * h);
  if (!poly) { m.fill(1); return m; }
  const rel = poly.map((v, i) => v - (i % 2 ? by : bx));
  polyFill((x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = 1; }, rel);
  return m;
}
export function bezierPts(p) {
  const [x0, y0, x3, y3, x1, y1, x2, y2] = p, out = [];
  const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
  const n = Math.max(8, Math.ceil(len / 3));
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push(Math.round(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3),
      Math.round(u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3));
  }
  return out;
}
function polyline(stamp, pts, close) {
  const n = pts.length / 2;
  if (n === 1) stamp(pts[0], pts[1]);
  for (let i = 0; i + 1 < n; i++) bres(pts[2 * i], pts[2 * i + 1], pts[2 * i + 2], pts[2 * i + 3], stamp);
  if (close && n > 2) bres(pts[2 * n - 2], pts[2 * n - 1], pts[0], pts[1], stamp);
}

export function flood(S, x, y, pf) {
  const { w, h, d } = S;
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const target = d[y * w + x], seen = new Uint8Array(w * h), stack = [x, y];
  while (stack.length) {
    const sy = stack.pop(), sx = stack.pop();
    let l = sx; while (l > 0 && d[sy * w + l - 1] === target && !seen[sy * w + l - 1]) l--;
    let r = sx; while (r < w - 1 && d[sy * w + r + 1] === target && !seen[sy * w + r + 1]) r++;
    for (let i = l; i <= r; i++) { const k = sy * w + i; if (seen[k] || d[k] !== target) continue; seen[k] = 1; d[k] = pf(i, sy); }
    for (const ny of [sy - 1, sy + 1]) {
      if (ny < 0 || ny >= h) continue;
      let inRun = false;
      for (let i = l; i <= r; i++) {
        const k = ny * w + i, ok = d[k] === target && !seen[k];
        if (ok && !inRun) { stack.push(i, ny); inRun = true; } else if (!ok) inRun = false;
      }
    }
  }
}

// ---------- airbrush ----------
export function sprayPuff(plot, x, y, radius, rand) {
  const n = Math.max(4, Math.round(radius * 1.3));
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
    plot(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r));
  }
}

// ---------- text ----------
let tcanvas;
export function fontCSS(f) { return `${f.italic ? 'italic ' : ''}${f.bold ? 'bold ' : ''}${f.size}px ${f.family}`; }
export function layoutText(text, font, maxW) {
  tcanvas = tcanvas || document.createElement('canvas');
  const ctx = tcanvas.getContext('2d');
  ctx.font = fontCSS(font);
  const lines = [];
  for (const para of String(text).split('\n')) {
    if (!maxW) { lines.push(para); continue; }
    let cur = '';
    for (const word of para.split(/(\s+)/)) {
      const t = cur + word;
      if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = word.trimStart(); } else cur = t;
    }
    lines.push(cur);
  }
  const lh = Math.ceil(font.size * 1.2);
  const width = Math.ceil(Math.max(1, ...lines.map(l => ctx.measureText(l).width))) + 4;
  return { lines, lh, width, height: lh * lines.length + 2 };
}
export function textMask(text, font, maxW) {
  const L = layoutText(text, font, maxW);
  const pad = 2, W = L.width + pad * 2, H = L.height + pad * 2;
  tcanvas.width = W; tcanvas.height = H;
  const ctx = tcanvas.getContext('2d');
  ctx.clearRect(0, 0, W, H); ctx.font = fontCSS(font); ctx.textBaseline = 'top'; ctx.fillStyle = '#000';
  L.lines.forEach((ln, i) => {
    ctx.fillText(ln, pad, pad + i * L.lh + 1);
    if (font.underline) { const tw = ctx.measureText(ln).width; ctx.fillRect(pad, pad + i * L.lh + Math.round(font.size * 1.02), Math.max(1, tw), Math.max(1, Math.round(font.size / 14))); }
  });
  const a = ctx.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) m[i] = a[i * 4 + 3] >= 110 ? 1 : 0;
  return { m, W, H, pad, L };
}

// ---------- transforms ----------
function region(S, sel) { return sel ? norm(sel.x, sel.y, sel.x + sel.w - 1, sel.y + sel.h - 1) : [0, 0, S.w - 1, S.h - 1]; }
function rotate(S, deg) {
  if (deg === 180) { const N = S.clone(); N.d.reverse(); return N; }
  const N = new Surface(S.h, S.w);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const v = S.d[y * S.w + x];
    if (deg === 90) N.d[x * N.w + (S.h - 1 - y)] = v; else N.d[(S.w - 1 - x) * N.w + y] = v;
  }
  return N;
}
function stretchSkew(S, sx, sy, kx, ky, bg) {
  const w1 = Math.max(1, Math.round(S.w * sx / 100)), h1 = Math.max(1, Math.round(S.h * sy / 100));
  let T = new Surface(w1, h1);
  for (let y = 0; y < h1; y++) for (let x = 0; x < w1; x++) T.d[y * w1 + x] = S.d[Math.floor(y * S.h / h1) * S.w + Math.floor(x * S.w / w1)];
  const tx = Math.tan(kx * Math.PI / 180), ty = Math.tan(ky * Math.PI / 180);
  if (!tx && !ty) return T;
  const ex = Math.round(Math.abs(tx) * (T.h - 1)), ey = Math.round(Math.abs(ty) * (T.w - 1));
  const shx = y => Math.round(tx >= 0 ? y * tx : (T.h - 1 - y) * -tx), shy = x => Math.round(ty >= 0 ? x * ty : (T.w - 1 - x) * -ty);
  const N = new Surface(T.w + ex, T.h + ey); N.d.fill(bg);
  for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
    const X = x + shx(y), Y = y + shy(x);
    if (X >= 0 && Y >= 0 && X < N.w && Y < N.h) N.d[Y * N.w + X] = T.d[y * T.w + x];
  }
  return N;
}

// image sources (data URLs) decoded into Surfaces, used by 'image'/'load' ops.
export const imageCache = new Map();
export function surfaceToDataURL(S) {
  const c = document.createElement('canvas'); c.width = S.w; c.height = S.h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(S.d.buffer.slice(0)), S.w, S.h), 0, 0);
  return c.toDataURL('image/png');
}
export function registerSurface(S) { const url = surfaceToDataURL(S); imageCache.set(url, S); return url; }
export function decodeImage(src) {
  return new Promise((res, rej) => {
    if (imageCache.has(src)) return res(imageCache.get(src));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const S = new Surface(c.width, c.height, new Uint32Array(d.buffer.slice(0)));
      for (let i = 0; i < S.d.length; i++) S.d[i] |= 0xff000000;
      imageCache.set(src, S); res(S);
    };
    img.onerror = rej; img.src = src;
  });
}
export function ditherMono(S) {
  const g = new Float32Array(S.w * S.h);
  for (let i = 0; i < g.length; i++) { const v = S.d[i]; g[i] = 0.299 * (v & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * ((v >> 16) & 255); }
  const N = new Surface(S.w, S.h);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const i = y * S.w + x, o = g[i] < 128 ? 0 : 255, e = g[i] - o;
    N.d[i] = o ? 0xffffffff : 0xff000000;
    if (x + 1 < S.w) g[i + 1] += e * 7 / 16;
    if (y + 1 < S.h) { if (x) g[i + S.w - 1] += e * 3 / 16; g[i + S.w] += e * 5 / 16; if (x + 1 < S.w) g[i + S.w + 1] += e / 16; }
  }
  return N;
}

function blit(S, src, mask, tx, ty, key) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (mask && !mask[y * src.w + x]) continue;
    const v = src.d[y * src.w + x]; if (key != null && v === key) continue;
    const X = tx + x, Y = ty + y;
    if (X >= 0 && Y >= 0 && X < S.w && Y < S.h) S.d[Y * S.w + X] = v;
  }
}
export function lift(S, sel) {
  const F = new Surface(sel.w, sel.h), mask = polyMask(sel.poly, sel.x, sel.y, sel.w, sel.h);
  for (let y = 0; y < sel.h; y++) for (let x = 0; x < sel.w; x++) if (mask[y * sel.w + x]) F.d[y * sel.w + x] = S.get(sel.x + x, sel.y + y);
  return { F, mask };
}
export function blitFloat(S, fl) { blit(S, fl.F, fl.mask, fl.x, fl.y, fl.key); }

// ---------- the op interpreter ----------
// doOp(op, S) mutates S (or returns a new Surface for size-changing ops).
export function doOp(op, S) {
  switch (op.t) {
    case 'stroke': return strokeSegment(S, op, 0, op.pts.length / 2), S;
    case 'line': case 'curve': case 'poly': case 'rect': case 'rrect': case 'ellipse': return drawShape(S, op), S;
    case 'fill': flood(S, op.x, op.y, compilePaint(op.paint)); return S;
    case 'text': drawText(S, op); return S;
    case 'clear': S.d.fill(hex2u32(op.c)); return S;
    case 'resize': {
      const N = new Surface(op.w, op.h); N.d.fill(hex2u32(op.bg)); blit(N, S, null, 0, 0); return N;
    }
    case 'load': { const I = imageCache.get(op.src); return I ? I.clone() : S; }
    case 'image': { const I = imageCache.get(op.src); if (I) blit(S, I, op.poly ? polyMask(op.poly, 0, 0, I.w, I.h) : null, op.x, op.y, op.key ? hex2u32(op.key) : null); return S; }
    case 'erase': { const m = polyMask(op.sel.poly, op.sel.x, op.sel.y, op.sel.w, op.sel.h), u = hex2u32(op.c);
      for (let y = 0; y < op.sel.h; y++) for (let x = 0; x < op.sel.w; x++) { const X = op.sel.x + x, Y = op.sel.y + y; if (m[y * op.sel.w + x] && X >= 0 && Y >= 0 && X < S.w && Y < S.h) S.d[Y * S.w + X] = u; }
      return S; }
    case 'move': {
      const { F, mask } = lift(S, op.sel);
      if (op.erase) doOp({ t: 'erase', sel: op.sel, c: op.erase }, S);
      blit(S, F, mask, op.x, op.y, op.key ? hex2u32(op.key) : null);
      return S;
    }
    case 'xform': return xform(S, op);
    case 'stretch': return stretchSkew(S, op.sx, op.sy, op.kx || 0, op.ky || 0, hex2u32(op.bg || '#ffffff'));
  }
  return S;
}

function xform(S, op) {
  if (op.k === 'rot90') return rotate(S, 90);
  if (op.k === 'rot180') return rotate(S, 180);
  if (op.k === 'rot270') return rotate(S, 270);
  const [x0, y0, x1, y1] = region(S, op.sel);
  const get = (x, y) => S.d[y * S.w + x], set = (x, y, v) => { if (x >= 0 && y >= 0 && x < S.w && y < S.h) S.d[y * S.w + x] = v; };
  const C = S.clone(), cg = (x, y) => (x >= 0 && y >= 0 && x < S.w && y < S.h) ? C.d[y * S.w + x] : 0xffffffff;
  for (let y = Math.max(0, y0); y <= Math.min(S.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(S.w - 1, x1); x++) {
    if (op.k === 'flipH') set(x, y, cg(x1 - (x - x0), y));
    else if (op.k === 'flipV') set(x, y, cg(x, y1 - (y - y0)));
    else if (op.k === 'invert') set(x, y, (get(x, y) ^ 0x00ffffff) >>> 0);
    else if (op.k === 'trace') {
      const black = 0xff000000, v = cg(x, y), isInk = u => u !== 0xffffffff;
      const edge = !isInk(v) && (isInk(cg(x - 1, y)) || isInk(cg(x + 1, y)) || isInk(cg(x, y - 1)) || isInk(cg(x, y + 1)));
      set(x, y, edge ? black : 0xffffffff);
    }
  }
  return S;
}

export function strokeSegment(S, op, from, to) {
  // draws points [from, to) of op.pts (pairs); stamps point "from" and connects from-1 -> from... when from>0
  const pf = compilePaint(op.paint);
  const plot = plotter(S, pf, op.only != null ? hex2u32(op.only) : null);
  if (op.tool === 'air') {
    if (from === 0 || !op._rand) Object.defineProperty(op, '_rand', { value: rng(op.seed || 1), writable: true, configurable: true, enumerable: false });
    for (let i = from; i < to; i++) sprayPuff(plot, op.pts[2 * i], op.pts[2 * i + 1], op.size, op._rand);
    return;
  }
  const stamp = op.tool === 'pencil' ? plot : stamper(plot, op.shape || 'square', op.size || 1);
  for (let i = Math.max(0, from); i < to; i++) {
    if (i === 0) stamp(op.pts[0], op.pts[1]);
    else bres(op.pts[2 * i - 2], op.pts[2 * i - 1], op.pts[2 * i], op.pts[2 * i + 1], stamp);
  }
}

function drawShape(S, op) {
  const lw = op.w || 1;
  const sp = op.stroke && plotter(S, compilePaint(op.stroke)), fp = op.fill && plotter(S, compilePaint(op.fill));
  const st = sp && (lw === 1 ? sp : stamper(sp, op.shape || 'round', lw));
  if (op.t === 'line') { st && bres(op.pts[0], op.pts[1], op.pts[2], op.pts[3], st); return; }
  if (op.t === 'curve') { st && polyline(st, bezierPts(op.pts), false); return; }
  if (op.t === 'poly') { fp && polyFill(fp, op.pts); st && polyline(st, op.pts, op.closed !== false); return; }
  const [x0, y0, x1, y1] = norm(...op.pts);
  const rad = op.t === 'rrect' ? (op.r || 8) : 0;
  if (fp) fillShape(fp, op.t, x0, y0, x1, y1, rad);
  if (sp) outlineShape(sp, op.t, x0, y0, x1, y1, lw, rad);
}

function drawText(S, op) {
  if (op.bg && op.box) doOp({ t: 'rect', pts: [op.box.x, op.box.y, op.box.x + op.box.w - 1, op.box.y + op.box.h - 1], fill: solid(op.bg) }, S);
  const { m, W, H, pad } = textMask(op.text, op.font, op.box ? Math.max(8, op.box.w - 4) : 0);
  const pf = compilePaint(op.paint), white = 0xffffffff, ox = op.x - pad, oy = op.y - pad;
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x];
  const clip = op.box ? [op.box.x, op.box.y, op.box.x + op.box.w - 1, op.box.y + op.box.h - 1] : null;
  const put = (X, Y, v) => { if (X < 0 || Y < 0 || X >= S.w || Y >= S.h) return; if (clip && (X < clip[0] || Y < clip[1] || X > clip[2] || Y > clip[3])) return; S.d[Y * S.w + X] = v; };
  for (let y = -1; y < H + 2; y++) for (let x = -1; x < W + 2; x++) {
    let ink = at(x, y);
    if (op.font.bold && op.font.fakeBold) ink = ink || at(x - 1, y);
    if (op.font.outline || op.font.shadow) {
      const near = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || (op.font.shadow && (at(x - 1, y - 1) || at(x - 2, y - 2) || at(x - 1, y - 2) || at(x - 2, y - 1)));
      if (ink) put(ox + x, oy + y, white); else if (near) put(ox + x, oy + y, pf(ox + x, oy + y));
    } else if (ink) put(ox + x, oy + y, pf(ox + x, oy + y));
  }
}
