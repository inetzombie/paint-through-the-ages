// Paint Through the Ages — interactive editor (tools, pointer input, selection, history, autosave).
// Copyright (c) 2026 der_zuhalter. MIT License.
import { Surface, doOp, strokeSegment, hex2u32, u322hex, solid, lift, blitFloat, registerSurface, decodeImage, imageCache, ditherMono, surfaceToDataURL, layoutText } from './engine.js';

export class Editor {
  constructor({ canvas, scroller, overlay, width = 640, height = 480, storageKey, mono = false, semantics = 'win95', undoLevels = 30, onChange = () => {} }) {
    Object.assign(this, { canvas, scroller, overlay, storageKey, mono, semantics, undoLevels, onChange });
    this.S = new Surface(width, height); this.S.d.fill(0xffffffff);
    this.undoStack = []; this.redoStack = []; this.ops = []; this.opListeners = [];
    this.ctx = canvas.getContext('2d');
    this.tool = 'pencil';
    this.fg = '#000000'; this.bg = '#ffffff';
    this.fgPaint = null;              // optional pattern paint (mono versions)
    this.lineWidth = 1; this.brush = { shape: 'round', size: 4 }; this.eraserSize = 8; this.airSize = 8;
    this.fillMode = 'outline'; this.transparentSel = false; this.zoom = 1; this.iso = false; this.grid = false;
    this.font = { family: 'Arial, Helvetica, sans-serif', size: 16, bold: false, italic: false, underline: false };
    this.opaqueText = false;
    this.sel = null; this.float = null; this.clip = null; this.preview = null; this.textEdit = null;
    this.stage = null; this.pointers = new Map();
    this.cursorPos = null;
    this.bind();
    this.render();
  }

  // ---------- history / ops ----------
  snapshot() { return { w: this.S.w, h: this.S.h, d: new Uint32Array(this.S.d) }; }
  restore(s) { this.S = new Surface(s.w, s.h, new Uint32Array(s.d)); }
  pushUndo() { this.undoStack.push(this.snapshot()); if (this.undoStack.length > this.undoLevels) this.undoStack.shift(); this.redoStack.length = 0; }
  log(op) { this.ops.push(op); for (const f of this.opListeners) f(op); this.dirty(); }
  apply(op) { this.pushUndo(); this.S = doOp(op, this.S) || this.S; this.log(op); }
  onOp(f) { this.opListeners.push(f); }
  undo() {
    if (this.textEdit) { this.cancelText(); return; }
    if (this.stage) { this.stage = null; this.preview = null; this.render(); return; }
    if (this.float) { this.dropFloat(); return; }
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot()); this.restore(this.undoStack.pop()); this.sel = null; this.log({ t: 'undo' });
  }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(this.snapshot()); this.restore(this.redoStack.pop()); this.log({ t: 'redo' }); }
  dirty() { this.render(); this.onChange(); clearTimeout(this._save); this._save = setTimeout(() => this.save(), 600); }

  save() {
    if (!this.storageKey) return;
    try { localStorage.setItem(this.storageKey, surfaceToDataURL(this.S)); } catch (e) { console.warn('autosave failed', e); }
  }
  async restoreSaved() {
    const url = this.storageKey && localStorage.getItem(this.storageKey);
    if (!url) return false;
    try { const I = await decodeImage(url); this.S = I.clone(); this.render(); this.onChange(); return true; } catch { return false; }
  }

  // ---------- rendering ----------
  render() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._render());
  }
  _render() {
    const S = this.S, c = this.canvas;
    if (c.width !== S.w || c.height !== S.h) { c.width = S.w; c.height = S.h; this.work = null; }
    if (!this.work || this.work.w !== S.w || this.work.h !== S.h) {
      this.work = new Surface(S.w, S.h); this.img = new ImageData(new Uint8ClampedArray(this.work.d.buffer), S.w, S.h);
    }
    this.work.d.set(S.d);
    if (this.float) blitFloat(this.work, this.float);
    if (this.preview) doOp(this.preview, this.work);
    this.ctx.putImageData(this.img, 0, 0);
    const z = this.zoom; c.style.width = S.w * z + 'px'; c.style.height = S.h * z + 'px';
    this.drawOverlay();
  }
  drawOverlay() {
    const o = this.overlay; if (!o) return;
    const z = this.zoom, S = this.S;
    o.style.width = S.w * z + 'px'; o.style.height = S.h * z + 'px';
    let html = '';
    const box = (x, y, w, h, cls) => `<div class="${cls}" style="left:${x * z}px;top:${y * z}px;width:${w * z}px;height:${h * z}px"></div>`;
    const f = this.float, s = this.sel;
    if (f) html += box(f.x, f.y, f.F.w, f.F.h, 'marquee');
    else if (s && s.poly && this.stage?.kind !== 'lasso') html += box(s.x, s.y, s.w, s.h, 'marquee');
    else if (s) html += box(s.x, s.y, s.w, s.h, 'marquee');
    if (this.stage?.kind === 'lasso' && this.stage.pts.length > 2) {
      const p = this.stage.pts.map((v, i) => (v + 0.5) * z).join(' ');
      html += `<svg class="lasso" width="${S.w * z}" height="${S.h * z}"><polyline points="${p}"/></svg>`;
    }
    if (this.textEdit) { const t = this.textEdit; html += box(t.box.x, t.box.y, t.box.w, t.box.h, 'textbox'); }
    if (this.grid && z >= 4) html += `<div class="pxgrid" style="background-size:${z}px ${z}px"></div>`;
    o.innerHTML = html;
  }
  setZoom(z, cx, cy) {
    const sc = this.scroller, old = this.zoom;
    this.zoom = z; this._render();
    if (cx != null) { sc.scrollLeft = cx * z - sc.clientWidth / 2; sc.scrollTop = cy * z - sc.clientHeight / 2; }
    else if (old) { sc.scrollLeft *= z / old; sc.scrollTop *= z / old; }
    if (this.textEdit) this.positionTextarea();
    this.onChange();
  }

  // ---------- color semantics ----------
  colorFor(btn) { return btn === 2 ? this.bg : this.fg; }
  paintFor(btn) { if (this.mono) return this.fgPaint || solid('#000000'); return solid(this.colorFor(btn)); }
  lineFor(btn) { return this.mono ? solid('#000000') : solid(this.colorFor(btn)); }
  shapePaints(btn, filled) {
    const p = btn === 2 ? this.bg : this.fg, s = btn === 2 ? this.fg : this.bg;
    if (this.semantics === 'mono') return { stroke: solid('#000000'), fill: filled ? (this.fgPaint || solid('#000')) : null };
    if (this.semantics === 'win31') return filled ? { stroke: solid(this.bg), fill: solid(this.fg) } : { stroke: solid(this.fg), fill: null };
    // win95: outline / both (outline primary, fill secondary) / fill (secondary, no outline)
    if (this.fillMode === 'both') return { stroke: solid(p), fill: solid(s) };
    if (this.fillMode === 'fill') return { stroke: null, fill: solid(s) };
    return { stroke: solid(p), fill: null };
  }

  // ---------- pointer input ----------
  pt(e) {
    const r = this.canvas.getBoundingClientRect(), z = r.width / this.S.w;
    return [Math.floor((e.clientX - r.left) / z), Math.floor((e.clientY - r.top) / z)];
  }
  bind() {
    const c = this.overlay || this.canvas;
    const target = this.canvas.parentElement;
    target.addEventListener('contextmenu', e => e.preventDefault());
    target.addEventListener('pointerdown', e => this.pdown(e));
    target.addEventListener('pointermove', e => this.pmove(e));
    target.addEventListener('pointerup', e => this.pup(e));
    target.addEventListener('pointercancel', e => this.pcancel(e));
    target.addEventListener('pointerleave', () => { this.cursorPos = null; this.onChange(); });
  }
  pdown(e) {
    if (e.target.closest && e.target.closest('.handle')) return;
    e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && e.pointerType === 'touch') {    // two-finger pan cancels the stroke
      if (this.active) { this.abortActive(); }
      this.pan = { ...this.mid(), sl: this.scroller.scrollLeft, st: this.scroller.scrollTop };
      return;
    }
    if (this.pointers.size > 1) return;
    try { e.target.setPointerCapture(e.pointerId); } catch {}
    const btn = e.button === 2 ? 2 : 0;
    const [x, y] = this.pt(e);
    this.active = { btn, x0: x, y0: y, x, y, shift: e.shiftKey, id: e.pointerId, cx: e.clientX, cy: e.clientY };
    this.toolDown(x, y, btn, e);
  }
  mid() { const p = [...this.pointers.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; }
  pmove(e) {
    const [x, y] = this.pt(e);
    this.cursorPos = [x, y];
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pan && this.pointers.size >= 2) { const m = this.mid(); this.scroller.scrollLeft = this.pan.sl - (m.x - this.pan.x); this.scroller.scrollTop = this.pan.st - (m.y - this.pan.y); return; }
    if (this.active && this.active.id === e.pointerId) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (evs.length ? evs : [e])) { const [px, py] = this.pt(ev); this.active.shift = e.shiftKey; this.toolMove(px, py, ev); }
    } else if (this.stage && (this.stage.kind === 'poly' || this.stage.kind === 'curve') && e.pointerType === 'mouse') {
      this.stageHover(x, y);
    }
    this.onChange();
  }
  pup(e) {
    this.pointers.delete(e.pointerId);
    if (this.pan) { if (this.pointers.size < 2) this.pan = null; return; }
    if (!this.active || this.active.id !== e.pointerId) return;
    const [x, y] = this.pt(e);
    this.toolUp(x, y, e);
    this.active = null;
  }
  pcancel(e) { this.pointers.delete(e.pointerId); if (this.active?.id === e.pointerId) this.abortActive(); }
  abortActive() {
    const a = this.active; this.active = null; clearInterval(this.airTimer);
    if (a?.snap) this.restore(a.snap), this.undoStack.pop();
    if (a?.moving && this.float) { this.float.x = a.fx; this.float.y = a.fy; }
    this.preview = null; if (this.stage?.kind === 'lasso' || this.stage?.kind === 'select') this.stage = null;
    this.render();
  }

  constrain(x0, y0, x, y, kind) {
    if (kind === 'line' && this.iso) {
      const dx = x - x0, dy = y - y0, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const cands = [0, 30, 90, 150, 180, 210, 270, 330, -30, -90, -150].map(a => a * Math.PI / 180);
      let best = cands[0]; for (const a of cands) if (Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a))) < Math.abs(Math.atan2(Math.sin(ang - best), Math.cos(ang - best)))) best = a;
      return [Math.round(x0 + Math.cos(best) * len), Math.round(y0 + Math.sin(best) * len)];
    }
    if (!this.active?.shift) return [x, y];
    const dx = x - x0, dy = y - y0;
    if (kind === 'line') {
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(dx, dy);
      return [Math.round(x0 + Math.cos(a) * l), Math.round(y0 + Math.sin(a) * l)];
    }
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    return [x0 + Math.sign(dx || 1) * m, y0 + Math.sign(dy || 1) * m];
  }

  // ---------- tools ----------
  setTool(t) {
    if (t === this.tool) return;
    this.finishPending();
    this.tool = t; this.sel = this.sel && (t === 'select' || t === 'freeselect') ? this.sel : null;
    this.render(); this.onChange();
  }
  finishPending() {
    if (this.textEdit) this.commitText();
    if (this.stage?.kind === 'poly') this.commitPoly();
    else if (this.stage?.kind === 'curve') this.commitCurve();
    this.stage = null; this.preview = null;
    if (this.float) this.commitFloat();
    this.sel = null;
  }

  toolDown(x, y, btn, e) {
    const t = this.tool, a = this.active;
    if (this.textEdit && t === 'text') { const b = this.textEdit.box; if (x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h) { this.active = null; this.textarea?.focus(); return; } this.commitText(); }
    switch (t) {
      case 'pencil': case 'brush': case 'eraser': case 'cerase': case 'air': {
        let tool = t, paint, extra = {};
        if (t === 'pencil') {
          paint = this.lineFor(btn);
          if (this.semantics === 'mono') paint = solid(this.S.get(x, y) === 0xff000000 ? '#ffffff' : '#000000');
        } else if (t === 'brush') { paint = this.paintFor(btn); extra = { shape: this.brush.shape, size: this.brush.size }; }
        else if (t === 'air') { paint = this.paintFor(btn); extra = { size: this.airSize, seed: (Math.random() * 2 ** 31) | 0 }; }
        else if (t === 'eraser') {
          const sz = this.semantics === 'win31' || this.semantics === 'mono' ? this.eraserSizeFor() : this.eraserSize;
          if (btn === 2 && this.semantics === 'win95') { tool = 'cerase'; extra = { only: this.fg, shape: 'square', size: sz }; paint = solid(this.bg); }
          else { tool = 'brush'; extra = { shape: 'square', size: sz }; paint = solid(this.mono ? '#ffffff' : this.bg); }
          extra.as = 'eraser';
        } else if (t === 'cerase') { tool = 'brush'; extra = { only: this.fg, shape: 'square', size: this.eraserSizeFor(), as: 'cerase' }; paint = solid(this.bg); }
        const op = { t: 'stroke', tool, paint, pts: [x, y], ...extra };
        a.op = op; a.n = 1; a.snap = this.snapshot(); this.pushUndo();
        strokeSegment(this.S, op, 0, 1);
        if (t === 'air') this.airTimer = setInterval(() => { if (!this.active) return; op.pts.push(this.active.x, this.active.y); strokeSegment(this.S, op, a.n, a.n + 1); a.n++; this.render(); }, 45);
        this.render(); return;
      }
      case 'line': case 'rect': case 'rrect': case 'ellipse': case 'rectf': case 'rrectf': case 'ellipsef':
        a.shapeKind = t; this.updateShapePreview(x, y); return;
      case 'curve':
        if (!this.stage) { this.stage = { kind: 'curve', n: 0, pts: [x, y, x, y], btn }; }
        this.stage.dragging = true; this.curvePreview(x, y); return;
      case 'poly': case 'polyf':
        if (!this.stage) { this.stage = { kind: 'poly', pts: [x, y], btn, filled: t === 'polyf' }; }
        this.stage.dragging = true; this.polyPreview(x, y); return;
      case 'freeform': case 'freeformf':
        a.pts = [x, y]; return;
      case 'fill': {
        if (x < 0 || y < 0 || x >= this.S.w || y >= this.S.h) return;
        this.apply({ t: 'fill', x, y, paint: this.paintFor(btn) }); return;
      }
      case 'picker': {
        const c = u322hex(this.S.get(x, y)); if (btn === 2) this.bg = c; else this.fg = c;
        this.onChange(); this.onPick && this.onPick(); return;
      }
      case 'magnifier': {
        if (this.zoom === 1) this.setZoom(this.magLevel || 4, x, y); else this.setZoom(1);
        this.active = null; return;
      }
      case 'hand': a.sl = this.scroller.scrollLeft; a.st = this.scroller.scrollTop; return;
      case 'text': this.textStart = [x, y]; a.textDrag = true; return;
      case 'select': case 'freeselect': {
        const f = this.float, s = this.sel;
        const inside = (r) => r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
        if (f && inside({ x: f.x, y: f.y, w: f.F.w, h: f.F.h })) {
          if (e.ctrlKey) { this.stampFloat(); }
          a.moving = true; a.fx = f.x; a.fy = f.y; return;
        }
        if (!f && inside(s)) { this.liftSel(e.ctrlKey); a.moving = true; a.fx = this.float.x; a.fy = this.float.y; return; }
        if (f) this.commitFloat();
        this.sel = null;
        this.stage = t === 'select' ? { kind: 'select' } : { kind: 'lasso', pts: [x, y] };
        this.render(); return;
      }
    }
  }
  eraserSizeFor() { return Math.max(4, this.lineWidth * 2 + 4); }

  toolMove(x, y) {
    const a = this.active; if (!a) return;
    const px = a.x, py = a.y; a.x = x; a.y = y;
    switch (this.tool) {
      case 'pencil': case 'brush': case 'eraser': case 'cerase':
        if (x === px && y === py) return;
        a.op.pts.push(x, y); strokeSegment(this.S, a.op, a.n, a.n + 1); a.n++; this.render(); return;
      case 'air':
        a.op.pts.push(x, y); strokeSegment(this.S, a.op, a.n, a.n + 1); a.n++; this.render(); return;
      case 'line': case 'rect': case 'rrect': case 'ellipse': case 'rectf': case 'rrectf': case 'ellipsef': this.updateShapePreview(x, y); return;
      case 'curve': this.curvePreview(x, y); return;
      case 'poly': case 'polyf': this.polyPreview(x, y); return;
      case 'freeform': case 'freeformf': {
        if (x === px && y === py) return; a.pts.push(x, y);
        this.preview = { t: 'poly', pts: a.pts, stroke: solid('#000000'), w: this.lineWidth, closed: false }; this.render(); return;
      }
      case 'hand': {
        const dx = (a.cx - (a.cx2 ?? a.cx)); this.scroller.scrollLeft = a.sl - (x - a.x0) * this.zoom; this.scroller.scrollTop = a.st - (y - a.y0) * this.zoom; return;
      }
      case 'text': if (a.textDrag) { const [x0, y0] = this.textStart; this.sel = this.normRect(x0, y0, x, y); this.render(); } return;
      case 'select': case 'freeselect': {
        if (a.moving && this.float) {
          this.float.x = a.fx + (x - a.x0); this.float.y = a.fy + (y - a.y0);
          if (a.stamp) this.stampFloat();
          this.render(); return;
        }
        if (this.stage?.kind === 'select') { this.sel = this.normRect(a.x0, a.y0, x, y); this.render(); }
        else if (this.stage?.kind === 'lasso') { this.stage.pts.push(x, y); this.render(); }
      }
    }
  }
  normRect(x0, y0, x1, y1) {
    const cl = (v, m) => Math.max(0, Math.min(m, v));
    const X0 = cl(Math.min(x0, x1), this.S.w - 1), Y0 = cl(Math.min(y0, y1), this.S.h - 1), X1 = cl(Math.max(x0, x1), this.S.w - 1), Y1 = cl(Math.max(y0, y1), this.S.h - 1);
    return { x: X0, y: Y0, w: X1 - X0 + 1, h: Y1 - Y0 + 1 };
  }

  toolUp(x, y) {
    const a = this.active; clearInterval(this.airTimer);
    switch (this.tool) {
      case 'pencil': case 'brush': case 'eraser': case 'cerase': case 'air': {
        const op = { ...a.op }; delete op._rand; this.log(op); return;
      }
      case 'line': case 'rect': case 'rrect': case 'ellipse': case 'rectf': case 'rrectf': case 'ellipsef': {
        const op = this.preview; this.preview = null; if (op) this.apply(op); return;
      }
      case 'curve': {
        const s = this.stage; s.dragging = false; s.n++;
        if (s.n === 1 && s.pts[0] === s.pts[2] && s.pts[1] === s.pts[3]) { this.stage = null; this.preview = null; this.render(); return; }
        if (s.n >= 3) this.commitCurve(); return;
      }
      case 'poly': case 'polyf': {
        const s = this.stage; s.dragging = false;
        const n = s.pts.length;
        const now = performance.now(), tol = Math.max(3, 8 / this.zoom);
        const nearStart = Math.hypot(x - s.pts[0], y - s.pts[1]) <= tol && n >= 4;
        const dbl = s.lastUp && now - s.lastUp.t < 400 && Math.hypot(x - s.lastUp.x, y - s.lastUp.y) <= tol;
        if (n === 2) { if (x !== s.pts[0] || y !== s.pts[1]) s.pts.push(x, y); }
        else if (!dbl && !nearStart) s.pts.push(x, y);
        s.lastUp = { t: now, x, y };
        if ((nearStart || dbl) && s.pts.length >= 4) this.commitPoly();
        else { this.preview = this.polyOp(s.pts, false); this.render(); }
        return;
      }
      case 'freeform': case 'freeformf': {
        this.preview = null;
        if (a.pts.length >= 6) this.apply({ t: 'poly', pts: a.pts, ...this.shapePaints(0, this.tool === 'freeformf'), w: this.lineWidth });
        else this.render();
        return;
      }
      case 'text': {
        const [x0, y0] = this.textStart;
        const drag = Math.abs(x - x0) > 4 || Math.abs(y - y0) > 4;
        const box = drag && this.semantics === 'win95' ? this.normRect(x0, y0, x, y) : null;
        this.sel = null; this.startText(x0, y0, box); return;
      }
      case 'select': case 'freeselect': {
        if (a.moving) { this.onChange(); return; }
        if (this.stage?.kind === 'lasso') {
          const p = this.stage.pts; this.stage = null;
          if (p.length >= 6) {
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
            const r = this.normRect(x0, y0, x1, y1); this.sel = { ...r, poly: p.slice() };
          }
        } else { this.stage = null; if (this.sel && this.sel.w < 2 && this.sel.h < 2) this.sel = null; }
        this.render(); this.onChange(); return;
      }
    }
  }

  updateShapePreview(x, y) {
    const a = this.active, t = a.shapeKind;
    const kind = t.replace(/f$/, ''), filled = t.endsWith('f');
    const [X, Y] = this.constrain(a.x0, a.y0, x, y, kind);
    if (kind === 'line') this.preview = { t: 'line', pts: [a.x0, a.y0, X, Y], stroke: this.lineFor(a.btn), w: this.lineWidth };
    else {
      let p = this.shapePaints(a.btn, filled);
      if (this.semantics === 'win95') p = this.shapePaints(a.btn);
      this.preview = { t: kind, pts: [a.x0, a.y0, X, Y], ...p, w: this.lineWidth, shape: 'square', r: kind === 'rrect' ? 10 : undefined };
    }
    this.render();
  }
  curveOp() { const s = this.stage, p = s.pts; return { t: 'curve', pts: [p[0], p[1], p[2], p[3], s.c1?.[0] ?? p[0], s.c1?.[1] ?? p[1], s.c2?.[0] ?? p[2], s.c2?.[1] ?? p[3]], stroke: this.lineFor(s.btn), w: this.lineWidth }; }
  curvePreview(x, y) {
    const s = this.stage;
    if (s.n === 0) { const [X, Y] = this.constrain(s.pts[0], s.pts[1], x, y, 'line'); s.pts[2] = X; s.pts[3] = Y; }
    else if (s.n === 1) { s.c1 = [x, y]; s.c2 = [x, y]; }
    else s.c2 = [x, y];
    this.preview = this.curveOp(); this.render();
  }
  stageHover() {}
  commitCurve() { const op = this.curveOp(); this.stage = null; this.preview = null; this.apply(op); }
  polyOp(pts, closed, st) {
    const s = st || this.stage;
    const p = this.semantics === 'win95' ? this.shapePaints(s.btn) : this.shapePaints(s.btn, s.filled);
    if (!closed) return { t: 'poly', pts, stroke: p.stroke || p.fill, w: this.lineWidth, closed: false };
    return { t: 'poly', pts, ...p, w: this.lineWidth };
  }
  polyPreview(x, y) {
    const s = this.stage, n = s.pts.length;
    const [X, Y] = this.constrain(s.pts[n - 2], s.pts[n - 1], x, y, 'line');
    this.preview = this.polyOp([...s.pts, X, Y], false); this.render();
  }
  commitPoly() { const s = this.stage; if (!s) return; this.stage = null; this.preview = null; if (s.pts.length >= 6) this.apply(this.polyOp(s.pts, true, s)); else if (s.pts.length === 4) this.apply({ ...this.polyOp(s.pts, false, s) }); else this.render(); }

  // ---------- selection ----------
  liftSel(copy) {
    const s = this.sel; if (!s) return;
    const { F, mask } = lift(this.S, s);
    this.preFloat = this.snapshot();
    if (!copy) doOp({ t: 'erase', sel: s, c: this.bg }, this.S);
    this.float = { F, mask, x: s.x, y: s.y, from: s, erase: !copy, key: this.transparentSel ? hex2u32(this.bg) : null };
    this.sel = null; this.render();
  }
  stampFloat() { if (this.float) { this.floatStamps = this.floatStamps || []; this.floatStamps.push([this.float.x, this.float.y]); blitFloat(this.S, this.float); } }
  commitFloat() {
    const f = this.float; if (!f) return;
    this.float = null; this.restore(this.preFloat);
    const key = f.key != null ? u322hex(f.key) : undefined;
    const stamps = this.floatStamps || []; this.floatStamps = null;
    if (f.src) { this.pushUndo(); for (const [sx, sy] of [...stamps, [f.x, f.y]]) { const op = { t: 'image', src: f.src, x: sx, y: sy, key, poly: f.poly }; this.S = doOp(op, this.S); this.log(op); } }
    else {
      this.pushUndo();
      const ops = [];
      if (stamps.length) ops.push(...stamps.map(([sx, sy]) => ({ t: 'move', sel: f.from, x: sx, y: sy, key })));
      ops.unshift({ t: 'move', sel: f.from, x: f.x, y: f.y, erase: f.erase ? this.bg : undefined, key });
      // stamps must land before the final drop but after the lift: apply in order lift+drop, then stamps from original pixels
      const base = this.snapshot();
      const first = ops.shift(); const src = new Surface(base.w, base.h, new Uint32Array(base.d));
      this.S = doOp(first, this.S); this.log(first);
      for (const op of ops) { const { F, mask } = lift(src, op.sel); const im = registerSurface(maskOut(F, mask)); const o = { t: 'image', src: im, x: op.x, y: op.y, key }; this.S = doOp(o, this.S); this.log(o); }
    }
    this.preFloat = null; this.render();
  }
  dropFloat() { if (!this.float) return; this.restore(this.preFloat); this.float = null; this.preFloat = null; this.render(); this.onChange(); }
  currentSelPixels() {
    if (this.float) return maskOut(this.float.F, this.float.mask, this.float.key);
    if (!this.sel) return null;
    const { F, mask } = lift(this.S, this.sel); return maskOut(F, mask);
  }
  copy() { const P = this.currentSelPixels(); if (P) { this.clip = P; this.clipSrc = registerSurface(P); } return !!P; }
  cut() { if (!this.copy()) return; this.clearSelection(); }
  clearSelection() {
    if (this.float) { const f = this.float; this.float = null; this.restore(this.preFloat); this.preFloat = null; if (f.src) { this.render(); return; } this.apply({ t: 'erase', sel: f.from, c: this.bg }); return; }
    if (this.sel) { const s = this.sel; this.sel = null; this.apply({ t: 'erase', sel: s, c: this.bg }); }
  }
  selectAll() { this.finishPending(); this.tool = this.tool === 'freeselect' ? 'freeselect' : 'select'; this.sel = { x: 0, y: 0, w: this.S.w, h: this.S.h }; this.render(); this.onChange(); }
  pasteSurface(P, src) {
    this.finishPending();
    if (!['select', 'freeselect'].includes(this.tool)) this.tool = 'select';
    if (P.w > this.S.w || P.h > this.S.h) this.apply({ t: 'resize', w: Math.max(P.w, this.S.w), h: Math.max(P.h, this.S.h), bg: this.bg });
    this.preFloat = this.snapshot();
    const x = Math.max(0, Math.floor(this.scroller.scrollLeft / this.zoom)), y = Math.max(0, Math.floor(this.scroller.scrollTop / this.zoom));
    this.float = { F: P, mask: null, x, y, src: src || registerSurface(P), key: this.transparentSel ? hex2u32(this.bg) : null };
    this.render(); this.onChange();
  }
  paste() { if (this.clip) this.pasteSurface(this.clip, this.clipSrc); }
  setTransparent(on) { this.transparentSel = on; if (this.float) { this.float.key = on ? hex2u32(this.bg) : null; this.render(); } }

  // ---------- image-wide commands ----------
  selOrNull() { if (this.float) this.commitFloat(); return this.sel ? { x: this.sel.x, y: this.sel.y, w: this.sel.w, h: this.sel.h } : null; }
  xform(k) { const sel = /^rot/.test(k) ? null : this.selOrNull(); this.finishPendingKeepSel(); this.apply({ t: 'xform', k, sel }); }
  finishPendingKeepSel() { const s = this.sel; if (this.textEdit) this.commitText(); this.stage = null; this.preview = null; if (this.float) this.commitFloat(); this.sel = s; }
  stretch(sx, sy, kx, ky) { this.finishPending(); this.apply({ t: 'stretch', sx, sy, kx, ky, bg: this.bg }); }
  resize(w, h) { this.finishPending(); this.apply({ t: 'resize', w: Math.max(1, w | 0), h: Math.max(1, h | 0), bg: this.mono ? '#ffffff' : this.bg }); }
  clearImage() { this.finishPending(); this.apply({ t: 'clear', c: this.mono ? '#ffffff' : this.bg }); }
  newImage(w, h) {
    this.finishPending(); this.pushUndo();
    const op = { t: 'resize', w: w || this.S.w, h: h || this.S.h, bg: '#ffffff' };
    this.S = new Surface(op.w, op.h); this.S.d.fill(0xffffffff); this.log({ t: 'clear', c: '#ffffff' }); this.log(op);
  }
  async loadFile(file, asPaste) {
    const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    let I = await decodeImage(url);
    let src = url;
    if (this.mono) { I = ditherMono(I); src = registerSurface(I); }
    if (asPaste) return this.pasteSurface(I.clone(), src);
    this.finishPending(); this.apply({ t: 'load', src });
  }
  savePNG(name = 'untitled.png') {
    this.finishPendingKeepSel();
    const a = document.createElement('a'); a.download = name; a.href = surfaceToDataURL(this.S); document.body.appendChild(a); a.click(); a.remove();
  }
  saveSelectionPNG(name = 'selection.png') { const P = this.currentSelPixels(); if (!P) return false; const a = document.createElement('a'); a.download = name; a.href = surfaceToDataURL(P); a.click(); return true; }

  // ---------- text ----------
  startText(x, y, box) {
    this.textEdit = { x, y, box: box || { x, y, w: 40, h: Math.ceil(this.font.size * 1.25) + 4 }, fixed: !!box, text: '' };
    let ta = this.textarea;
    if (!ta) {
      ta = this.textarea = document.createElement('textarea');
      ta.className = 'text-input'; ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off'); ta.spellcheck = false;
      ta.addEventListener('input', () => { if (this.textEdit) { this.textEdit.text = ta.value; this.textPreview(); } });
      ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { this.commitText(); } });
      this.overlay.parentElement.appendChild(ta);
    }
    ta.value = ''; ta.style.display = 'block'; this.positionTextarea(); ta.focus({ preventScroll: true });
    this.textPreview(); this.onChange();
  }
  positionTextarea() { const t = this.textEdit, ta = this.textarea; if (!t || !ta) return; ta.style.left = t.box.x * this.zoom + 'px'; ta.style.top = t.box.y * this.zoom + 'px'; ta.style.width = Math.max(30, t.box.w * this.zoom) + 'px'; ta.style.height = Math.max(20, t.box.h * this.zoom) + 'px'; }
  textOp() {
    const t = this.textEdit, mono = this.mono;
    return { t: 'text', x: t.box.x + 2, y: t.box.y + 2, text: t.text, font: { ...this.font }, paint: mono ? solid('#000000') : solid(this.fg), bg: this.opaqueText && !mono ? this.bg : undefined, box: t.fixed ? { ...t.box } : undefined };
  }
  textPreview() {
    const t = this.textEdit; if (!t) return;
    if (!t.fixed) { const L = layoutText(t.text || ' ', this.font, 0); t.box.w = L.width + 6; t.box.h = L.height + 4; this.positionTextarea(); }
    this.preview = t.text ? this.textOp() : null; this.render();
  }
  refreshText() { if (this.textEdit) this.textPreview(); }
  commitText() {
    const t = this.textEdit; if (!t) return;
    const op = t.text ? this.textOp() : null;
    this.textEdit = null; this.preview = null; if (this.textarea) { this.textarea.blur(); this.textarea.style.display = 'none'; }
    if (op) this.apply(op); else this.render();
    this.onChange();
  }
  cancelText() { this.textEdit = null; this.preview = null; if (this.textarea) this.textarea.style.display = 'none'; this.render(); }

  keydown(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return false;
    const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
    if (c && k === 'z') { e.shiftKey ? this.redo() : this.undo(); return true; }
    if (c && k === 'y') { this.redo(); return true; }
    if (c && k === 'c') { this.copy(); return true; }
    if (c && k === 'x') { this.cut(); return true; }
    if (c && k === 'v') { this.paste(); return true; }
    if (c && k === 'a') { this.selectAll(); return true; }
    if (k === 'delete') { this.clearSelection(); return true; }
    if (k === 'escape') { if (this.stage?.kind === 'poly') this.commitPoly(); else if (this.stage?.kind === 'curve') this.commitCurve(); else if (this.float) this.commitFloat(); else { this.sel = null; this.render(); } return true; }
    if (k === 'enter' && this.stage?.kind === 'poly') { this.commitPoly(); return true; }
    return false;
  }
}

function maskOut(F, mask, key) {
  const P = F.clone();
  if (mask) for (let i = 0; i < P.d.length; i++) if (!mask[i]) P.d[i] = 0xffffffff;
  return P;
}
export { surfaceToDataURL };
