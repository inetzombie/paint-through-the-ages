// Paint Through the Ages — app shell: window chrome, menus, toolbox, palettes, dialogs.
// Copyright (c) 2026 der_zuhalter. MIT License.
import { Editor } from './editor.js';
import { pattern, solid } from './engine.js';
import { ICONS } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};
const accel = s => s.replace(/&(.)/, '<u>$1</u>');

export const PALETTE28 = ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'];

export const PATTERNS = [
  [255, 255, 255, 255, 255, 255, 255, 255], [0, 0, 0, 0, 0, 0, 0, 0], [170, 85, 170, 85, 170, 85, 170, 85], [136, 34, 136, 34, 136, 34, 136, 34],
  [119, 221, 119, 221, 119, 221, 119, 221], [128, 0, 8, 0, 128, 0, 8, 0], [255, 0, 255, 0, 255, 0, 255, 0], [136, 136, 136, 136, 136, 136, 136, 136],
  [1, 2, 4, 8, 16, 32, 64, 128], [128, 64, 32, 16, 8, 4, 2, 1], [255, 128, 128, 128, 255, 8, 8, 8], [255, 128, 128, 128, 128, 128, 128, 128],
  [240, 240, 240, 240, 15, 15, 15, 15], [136, 20, 34, 65, 136, 0, 170, 0], [119, 137, 143, 143, 119, 152, 248, 248], [17, 34, 68, 136, 17, 34, 68, 136],
  [187, 238, 187, 238, 187, 238, 187, 238], [0, 68, 0, 17, 0, 68, 0, 17], [130, 68, 40, 16, 40, 68, 130, 1], [62, 65, 128, 128, 128, 65, 62, 0],
  [12, 30, 63, 127, 255, 0, 0, 0], [255, 136, 136, 136, 255, 136, 136, 136], [24, 24, 255, 255, 24, 24, 24, 24], [195, 102, 60, 24, 60, 102, 195, 129],
];

function patternCSS(p, fg = '#000', bg = '#fff') {
  const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 8, 8); x.fillStyle = fg;
  for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) if ((p[y] >> (7 - i)) & 1) x.fillRect(i, y, 1, 1);
  return `url(${c.toDataURL()})`;
}

export class App {
  constructor(P) {
    this.P = P; this.name = 'untitled'; this.show = { tools: true, palette: true, status: true, textbar: false, cursorpos: false };
    document.body.classList.add('skin-' + P.id);
    document.title = P.windowTitle('untitled');
    this.build();
    const E = this.E = new Editor({
      canvas: $('canvas', this.root), scroller: this.scroller, overlay: $('.overlay', this.root),
      width: P.size[0], height: P.size[1], storageKey: 'paint-ages:' + P.id, mono: !!P.mono, semantics: P.semantics, undoLevels: P.undoLevels || 30,
      onChange: () => this.sync(),
    });
    window.paintApp = this;
    E.tool = P.defaultTool || 'pencil';
    if (P.init) P.init(E, this);
    E.onPick = () => { if (P.afterPick) this.setTool(this.prevTool || 'pencil'); };
    E.restoreSaved().then(ok => { if (ok) this.flash('Restored autosaved picture'); });
    document.addEventListener('keydown', e => { if (this.modal) return; if (E.keydown(e)) e.preventDefault(); else if ((e.ctrlKey || e.metaKey) && /^[nos]$/i.test(e.key)) { e.preventDefault(); ({ n: () => this.cmdNew(), o: () => this.cmdOpen(), s: () => this.cmdSave() })[e.key.toLowerCase()](); } });
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.menubar')) this.closeMenus(); });
    window.addEventListener('resize', () => this.fit());
    this.renderTools(); this.renderPalette(); this.renderOptions(); this.sync(); this.fit();
  }

  // ---------- chrome ----------
  build() {
    const P = this.P;
    this.root = h('div', { class: 'win' },
      h('div', { class: 'titlebar' },
        h('div', { class: 'sysbox', title: 'Control menu', onclick: () => location.href = '/' }, h('span')),
        P.titleIcon ? h('span', { class: 'ticon', html: P.titleIcon }) : null,
        h('div', { class: 'caption' }, P.windowTitle('untitled')),
        h('div', { class: 'tbtns' }, ...(P.titleButtons || []).map(b => h('button', { class: 'tb tb-' + b, 'aria-label': b, onclick: () => { if (b === 'close') location.href = '/'; } }, h('span')))),
      ),
      h('div', { class: 'menubar', role: 'menubar' }),
      h('div', { class: 'textbar' }),
      h('div', { class: 'body' },
        h('div', { class: 'toolside' }, h('div', { class: 'tools' }), h('div', { class: 'opts' })),
        h('div', { class: 'scroller' }, h('div', { class: 'stage' }, h('canvas', { class: 'paper' }), h('div', { class: 'overlay' })))),
      h('div', { class: 'palette' }),
      h('div', { class: 'status' }, h('div', { class: 'msg' }, P.statusText || ''), h('div', { class: 'pos' }), h('div', { class: 'dim' })),
    );
    const desk = h('div', { class: 'desk' }, this.root);
    if (P.deskExtra) desk.append(h('div', { class: 'desk-extra', html: P.deskExtra }));
    document.body.append(desk, h('input', { type: 'file', accept: 'image/*', class: 'file-in', style: 'display:none' }));
    this.scroller = $('.scroller', this.root);
    this.renderMenus();
  }
  fit() { document.documentElement.style.setProperty('--vh', window.innerHeight + 'px'); }
  setCaption() { const t = this.P.windowTitle(this.name); $('.caption', this.root).textContent = t; document.title = t; }
  flash(msg) { const m = $('.status .msg', this.root); m.textContent = msg; clearTimeout(this._fl); this._fl = setTimeout(() => m.textContent = this.P.statusText || '', 2500); }

  // ---------- menus ----------
  renderMenus() {
    const bar = $('.menubar', this.root); bar.innerHTML = '';
    for (const m of this.P.menus(this)) {
      const top = h('div', { class: 'mtop', role: 'menuitem', html: accel(m.label) });
      top.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.openMenu === top ? this.closeMenus() : this.showMenu(top, m); });
      top.addEventListener('pointerenter', e => { if (this.openMenu && this.openMenu !== top && e.pointerType === 'mouse') this.showMenu(top, m); });
      bar.append(top);
    }
  }
  closeMenus() { document.querySelectorAll('.dropdown').forEach(d => d.remove()); this.openMenu?.classList.remove('open'); this.openMenu = null; }
  showMenu(top, m) {
    this.closeMenus(); this.openMenu = top; top.classList.add('open');
    const dd = this.buildDropdown(m.items);
    const r = top.getBoundingClientRect(); dd.style.left = r.left + 'px'; dd.style.top = r.bottom + 'px';
    document.body.append(dd);
    const dr = dd.getBoundingClientRect(); if (dr.right > innerWidth) dd.style.left = Math.max(0, innerWidth - dr.width) + 'px';
  }
  buildDropdown(items, sub) {
    const dd = h('div', { class: 'dropdown' + (sub ? ' sub' : ''), role: 'menu' });
    for (const it of items) {
      if (it === '-') { dd.append(h('div', { class: 'msep' })); continue; }
      const dis = it.disabled && it.disabled(), chk = it.checked && it.checked();
      const row = h('div', { class: 'mitem' + (dis ? ' disabled' : '') + (chk ? ' checked' : '') + (it.sub ? ' hassub' : ''), role: 'menuitem' },
        h('span', { class: 'mchk' }, chk ? (this.P.checkGlyph || '✓') : ''), h('span', { class: 'mlabel', html: accel(it.label) }), h('span', { class: 'mkey' }, it.key || ''), h('span', { class: 'marrow' }, it.sub ? '▶' : ''));
      row.addEventListener('pointerup', e => {
        e.stopPropagation(); if (dis) return;
        if (it.sub) { dd.querySelectorAll('.dropdown.sub').forEach(s => s.remove()); const s = this.buildDropdown(it.sub, true); row.append(s); return; }
        this.closeMenus(); setTimeout(() => it.action && it.action(), 0);
      });
      row.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); });
      if (it.sub) row.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; dd.querySelectorAll('.dropdown.sub').forEach(s => s.remove()); row.append(this.buildDropdown(it.sub, true)); });
      dd.append(row);
    }
    return dd;
  }

  // ---------- toolbox ----------
  setTool(t) {
    if (t !== 'picker') this.prevTool = t; else this.prevTool = this.E.tool;
    this.E.setTool(t); this.P.onTool?.(t, this); this.renderTools(); this.renderOptions();
  }
  renderTools() {
    const box = $('.tools', this.root); box.innerHTML = '';
    for (const t of this.P.tools) {
      const id = t.id;
      const b = h('button', { class: 'tool' + (this.E.tool === id ? ' on' : ''), title: t.name, 'aria-label': t.name, html: t.icon || ICONS[t.iconKey || id] || t.name });
      b.addEventListener('click', () => this.setTool(id));
      box.append(b);
    }
    this.scroller.dataset.tool = this.E.tool;
  }
  renderOptions() { const o = $('.opts', this.root); o.innerHTML = ''; this.P.options?.(o, this); }

  // ---------- palette ----------
  renderPalette() { const pal = $('.palette', this.root); pal.innerHTML = ''; this.P.palette?.(pal, this); }
  swatch(color, onPrimary, onSecondary, styleBg) {
    const s = h('div', { class: 'sw', style: `background:${styleBg || color}` });
    let lp;
    s.addEventListener('contextmenu', e => e.preventDefault());
    s.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (e.button === 2) { onSecondary?.(); return; }
      if (e.pointerType !== 'mouse' && onSecondary) lp = setTimeout(() => { lp = 'done'; onSecondary(); this.flash('Background color set'); }, 500);
    });
    s.addEventListener('pointerup', e => { if (e.button === 2) return; if (lp === 'done') { lp = null; return; } clearTimeout(lp); lp = null; onPrimary(); });
    s.addEventListener('pointerleave', () => { if (lp !== 'done') clearTimeout(lp); });
    s.addEventListener('dblclick', () => this.P.editColors && this.P.editColors(this, color));
    return s;
  }
  sync() {
    const E = this.E; if (!E) return;
    const pos = E.cursorPos, posEl = $('.status .pos', this.root);
    if (posEl) posEl.textContent = pos && pos[0] >= 0 && pos[1] >= 0 && pos[0] < E.S.w && pos[1] < E.S.h ? `${pos[0]},${pos[1]}` : '';
    const a = E.active, dim = $('.status .dim', this.root);
    if (dim) dim.textContent = a && a.shapeKind ? `${Math.abs(a.x - a.x0) + 1}x${Math.abs(a.y - a.y0) + 1}` : (E.sel ? `${E.sel.w}x${E.sel.h}` : '');
    this.P.sync?.(this);
    const cp = $('.cursorpos'); if (cp) cp.textContent = pos ? `${Math.max(0, pos[0])}, ${Math.max(0, pos[1])}` : '';
    if (this.E.tool !== this.scroller.dataset.tool) this.renderTools();
  }

  // ---------- commands ----------
  async cmdNew() {
    const r = await this.dialog(this.P.appName, `<p class="dlg-msg">${this.P.newPrompt || 'Save current changes?'}</p>`, ['Yes', 'No', 'Cancel']);
    if (r === 'Cancel' || r == null) return;
    if (r === 'Yes') this.cmdSave();
    this.E.newImage(this.P.size[0], this.P.size[1]); this.E.setZoom(1); this.name = 'untitled'; this.setCaption();
  }
  cmdOpen(asPaste) {
    const inp = $('.file-in'); inp.value = '';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; await this.E.loadFile(f, asPaste); if (!asPaste) { this.name = f.name.replace(/\.[^.]+$/, ''); this.setCaption(); } this.renderTools(); };
    inp.click();
  }
  cmdSave() { this.E.savePNG((this.name || 'untitled') + '.png'); this.flash('Saved ' + (this.name || 'untitled') + '.png'); }
  async cmdSaveAs() {
    const v = await this.prompt('Save As', 'File name:', this.name + '.png'); if (!v) return;
    this.name = v.replace(/\.png$/i, ''); this.setCaption(); this.cmdSave();
  }
  async cmdAttributes() {
    const S = this.E.S;
    const r = await this.dialog('Attributes', `<div class="dlg-grid"><label>Width:</label><input name="w" type="number" min="1" max="4000" value="${S.w}"><label>Height:</label><input name="h" type="number" min="1" max="4000" value="${S.h}"><span></span><span class="dlg-note">Units: pels</span></div>`, ['OK', 'Cancel']);
    if (r?.btn === 'OK') this.E.resize(+r.vals.w, +r.vals.h);
  }
  async cmdStretch() {
    const r = await this.dialog('Stretch and Skew', `<fieldset><legend>Stretch</legend><div class="dlg-grid"><label>Horizontal:</label><input name="sx" type="number" value="100">%<label>Vertical:</label><input name="sy" type="number" value="100">%</div></fieldset><fieldset><legend>Skew</legend><div class="dlg-grid"><label>Horizontal:</label><input name="kx" type="number" value="0">°<label>Vertical:</label><input name="ky" type="number" value="0">°</div></fieldset>`, ['OK', 'Cancel']);
    if (r?.btn !== 'OK') return;
    const v = k => Math.max(-89, Math.min(500, +r.vals[k] || 0));
    this.E.stretch(Math.max(1, v('sx')), Math.max(1, v('sy')), v('kx'), v('ky'));
  }
  async cmdFlipRotate() {
    const r = await this.dialog('Flip and Rotate', `<fieldset><legend>Flip or rotate</legend>
      <label class="rad"><input type="radio" name="k" value="flipH" checked> Flip horizontal</label>
      <label class="rad"><input type="radio" name="k" value="flipV"> Flip vertical</label>
      <label class="rad"><input type="radio" name="k" value="rot"> Rotate by angle</label>
      <div class="indent"><label class="rad"><input type="radio" name="a" value="rot90" checked> 90°</label><label class="rad"><input type="radio" name="a" value="rot180"> 180°</label><label class="rad"><input type="radio" name="a" value="rot270"> 270°</label></div></fieldset>`, ['OK', 'Cancel']);
    if (r?.btn !== 'OK') return;
    this.E.xform(r.vals.k === 'rot' ? r.vals.a : r.vals.k);
  }
  about() {
    this.dialog('About ' + this.P.appName, `<div class="about"><div class="about-icon">${ICONS.brush}</div><div><b>${this.P.appName}</b><br>${this.P.aboutLine}<br><br>A browser recreation for “Paint Through the Ages”.<br>© 2026 der_zuhalter · MIT License<br>Not affiliated with Microsoft.</div></div>`, ['OK']);
  }
  help(txt) { this.dialog(this.P.appName + ' Help', `<div class="helptext">${txt || this.P.helpText}</div>`, ['OK']); }

  // ---------- dialogs ----------
  dialog(title, body, buttons = ['OK']) {
    return new Promise(res => {
      this.closeMenus();
      const form = h('form', { class: 'dlg-body', html: body });
      const btns = h('div', { class: 'dlg-btns' });
      const done = btn => { cover.remove(); this.modal = false; if (btn == null) return res(null); const vals = Object.fromEntries(new FormData(form)); res(form.elements.length ? { btn, vals } : btn); };
      buttons.forEach((b, i) => btns.append(h('button', { type: 'button', class: 'btn' + (i === 0 ? ' default' : ''), onclick: () => done(b) }, b)));
      form.addEventListener('submit', e => { e.preventDefault(); done(buttons[0]); });
      const dlg = h('div', { class: 'dlg', role: 'dialog' },
        h('div', { class: 'titlebar dlg-title' }, h('div', { class: 'sysbox' }, h('span')), h('div', { class: 'caption' }, title), h('div', { class: 'tbtns' }, h('button', { class: 'tb tb-close', type: 'button', onclick: () => done(null) }, h('span')))),
        h('div', { class: 'dlg-main' }, form, btns));
      const cover = h('div', { class: 'modal-cover' }, dlg);
      document.body.append(cover); this.modal = true;
      cover.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); e.stopPropagation(); });
      setTimeout(() => (form.querySelector('input,select') || btns.querySelector('button')).focus(), 0);
    });
  }
  async prompt(title, label, val = '') {
    const r = await this.dialog(title, `<div class="dlg-grid"><label>${label}</label><input name="v" value="${val.replace(/"/g, '&quot;')}"></div>`, ['OK', 'Cancel']);
    return r?.btn === 'OK' ? r.vals.v : null;
  }
  async editColors(cur, cb) {
    const r = await this.dialog('Edit Colors', `<div class="dlg-grid"><label>Color:</label><input type="color" name="c" value="${cur}"></div>`, ['OK', 'Cancel']);
    if (r?.btn === 'OK') cb(r.vals.c);
  }
}

// helpers shared by profiles
export function linesizeBox(app, el, widths, labelCls = '') {
  const box = h('div', { class: 'linesize ' + labelCls });
  for (const w of widths) {
    const b = h('div', { class: 'ls' + (app.E.lineWidth === w ? ' on' : ''), title: w + ' px' }, h('div', { class: 'lsbar', style: `height:${w}px` }));
    b.addEventListener('click', () => { app.E.lineWidth = w; app.P.onLineWidth?.(w, app); app.renderOptions(); });
    box.append(b);
  }
  el.append(box);
}
export function fontFamilies() {
  return [['System', 'bold 1em system-ui, sans-serif', '"Arial Black", Arial, sans-serif'], ['Helv', '', 'Arial, Helvetica, sans-serif'], ['Tms Rmn', '', '"Times New Roman", Times, serif'], ['Courier', '', '"Courier New", Courier, monospace'], ['Modern', '', '"Trebuchet MS", sans-serif'], ['Script', '', '"Brush Script MT", "Comic Sans MS", cursive'], ['Terminal', '', '"Lucida Console", monospace']];
}
export { h, $, patternCSS, ICONS, pattern, solid };
