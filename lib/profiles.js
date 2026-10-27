// Paint Through the Ages — per-era profiles (tools, menus, palettes, options).
// Copyright (c) 2026 der_zuhalter. MIT License.
import { App, PALETTE28, PATTERNS, linesizeBox, fontFamilies, h, $, patternCSS, ICONS, pattern, solid } from './app.js';

const T = (id, name, iconKey) => ({ id, name, iconKey });
const fileMenu = (app, extra = []) => ({ label: '&File', items: [
  { label: '&New', key: 'Ctrl+N', action: () => app.cmdNew() },
  { label: '&Open...', key: 'Ctrl+O', action: () => app.cmdOpen() },
  { label: '&Save', key: 'Ctrl+S', action: () => app.cmdSave() },
  { label: 'Save &As...', action: () => app.cmdSaveAs() },
  ...extra,
  '-', { label: 'E&xit', action: () => location.href = '/' },
] });
const brushShapes = ['square', 'round', 'hline', 'vline', 'fslash', 'bslash'];
const shapeSVG = s => { const m = { square: '<rect x="4" y="4" width="8" height="8"/>', round: '<circle cx="8" cy="8" r="4.5"/>', hline: '<rect x="2" y="7" width="12" height="2"/>', vline: '<rect x="7" y="2" width="2" height="12"/>', fslash: '<path d="M3 13 L13 3" stroke="#000" stroke-width="2"/>', bslash: '<path d="M3 3 L13 13" stroke="#000" stroke-width="2"/>' }; return `<svg viewBox="0 0 16 16" width="16" height="16">${m[s]}</svg>`; };
async function brushShapeDialog(app) {
  const r = await app.dialog('Brush Shapes', `<div class="shape-pick">${brushShapes.map(s => `<label class="shp"><input type="radio" name="s" value="${s}" ${app.E.brush.shape === s ? 'checked' : ''}><span>${shapeSVG(s)}</span></label>`).join('')}</div>`, ['OK', 'Cancel']);
  if (r?.btn === 'OK') app.E.brush.shape = r.vals.s;
}
const textCheck = (app, k) => ({ checked: () => !!app.E.font[k], action: () => { app.E.font[k] = !app.E.font[k]; app.E.refreshText(); } });

// ============ Windows 1.0 / 2.x (monochrome Paint) ============
function monoProfile(id, opts) {
  const fams = fontFamilies().slice(0, 4).concat([fontFamilies()[6]]);
  return {
    id, mono: true, semantics: 'mono', size: [560, 360], defaultTool: 'pencil', undoLevels: 1,
    appName: 'Paint', ...opts,
    tools: [T('select', 'Selection rectangle'), T('freeselect', 'Lasso'), T('hand', 'Hand (scroll)'), T('text', 'Text'),
      T('pencil', 'Pencil'), T('eraser', 'Eraser'), T('line', 'Line'), T('curve', 'Curve'),
      T('brush', 'Brush'), T('air', 'Spray can'), T('fill', 'Paint roller'), T('magnifier', 'Zoom (FatBits)'),
      T('rect', 'Rectangle'), T('rectf', 'Filled rectangle'), T('rrect', 'Rounded rectangle'), T('rrectf', 'Filled rounded rectangle'),
      T('ellipse', 'Oval'), T('ellipsef', 'Filled oval'), T('poly', 'Polygon'), T('polyf', 'Filled polygon'),
      T('freeform', 'Freehand shape'), T('freeformf', 'Filled freehand shape')],
    init(E) { E.fgPaint = solid('#000000'); E.brush = { shape: 'round', size: 7 }; E.airSize = 9; E.magLevel = 8; E.font = { family: fams[0][2], size: 14, bold: true }; },
    options(el, app) { linesizeBox(app, el, [1, 2, 3, 4, 6, 8]); },
    palette(el, app) {
      const cur = h('div', { class: 'curpat' }); el.append(cur);
      const grid = h('div', { class: 'pats' }); el.append(grid);
      PATTERNS.forEach((p, i) => {
        const s = app.swatch('', () => { app.E.fgPaint = i === 0 ? solid('#000000') : pattern(p); app.patIdx = i; app.sync(); }, null, `${patternCSS(p)}`);
        s.dataset.i = i; grid.append(s);
      });
    },
    sync(app) { const i = app.patIdx || 0; const c = $('.curpat', app.root); if (c) c.style.background = patternCSS(PATTERNS[i]); document.querySelectorAll('.pats .sw').forEach(s => s.classList.toggle('on', +s.dataset.i === i)); },
    menus: app => [
      fileMenu(app, ['-', { label: '&Print', disabled: () => true }, { label: '&About Paint...', action: () => app.about() }]),
      { label: '&Edit', items: [
        { label: '&Undo', key: 'Ctrl+Z', action: () => app.E.undo() },
        '-', { label: 'Cu&t', key: 'Ctrl+X', action: () => app.E.cut() }, { label: '&Copy', key: 'Ctrl+C', action: () => app.E.copy() }, { label: '&Paste', key: 'Ctrl+V', action: () => app.E.paste() },
        { label: 'C&lear', key: 'Del', action: () => app.E.clearSelection() }, { label: 'Select &All', key: 'Ctrl+A', action: () => app.E.selectAll() }, '-',
        { label: '&Invert', action: () => app.E.xform('invert') }, { label: '&Trace Edges', action: () => app.E.xform('trace') },
        { label: 'Flip &Horizontal', action: () => app.E.xform('flipH') }, { label: 'Flip &Vertical', action: () => app.E.xform('flipV') },
        '-', { label: 'Clear &Picture', action: () => app.E.clearImage() },
      ] },
      { label: 'F&ont', items: fams.map(([n, , css]) => ({ label: n, checked: () => app.E.font.family === css, action: () => { app.E.font.family = css; app.E.refreshText(); } })) },
      { label: '&Size', items: [8, 10, 12, 14, 18, 24, 36].map(s => ({ label: s + ' point', checked: () => app.E.font.size === s, action: () => { app.E.font.size = s; app.E.refreshText(); } })) },
      { label: 'St&yle', items: [
        { label: '&Plain', checked: () => !['bold', 'italic', 'underline', 'outline', 'shadow'].some(k => app.E.font[k]), action: () => { Object.assign(app.E.font, { bold: false, italic: false, underline: false, outline: false, shadow: false }); app.E.refreshText(); } },
        { label: '&Bold', ...textCheck(app, 'bold') }, { label: '&Italic', ...textCheck(app, 'italic') }, { label: '&Underline', ...textCheck(app, 'underline') },
        { label: '&Outline', ...textCheck(app, 'outline') }, { label: '&Shadow', ...textCheck(app, 'shadow') }] },
      { label: '&Options', items: [
        { label: '&Brush Shape...', action: () => brushShapeDialog(app) },
        { label: '&Isometric Lines', checked: () => app.E.iso, action: () => { app.E.iso = !app.E.iso; } },
        { label: '&Grid (in FatBits)', checked: () => app.E.grid, action: () => { app.E.grid = !app.E.grid; app.E.render(); } },
        '-', { label: '&FatBits', checked: () => app.E.zoom > 1, action: () => app.E.setZoom(app.E.zoom > 1 ? 1 : 8) },
        { label: '&Picture Size...', action: () => app.cmdAttributes() },
      ] },
    ],
  };
}
export const win1 = monoProfile('win1', {
  windowTitle: n => 'Paint - ' + n.toUpperCase() + '.MSP', aboutLine: 'Microsoft Windows Paint<br>Version 1.01 (1985)',
  titleButtons: [], checkGlyph: '✓',
  deskExtra: `<div class="iconarea"><div class="dicon"><div class="ibox">MS-DOS</div>MS-DOS<br>Exec</div><div class="dicon"><div class="ibox clock">🕒</div>Clock</div><div class="dicon"><div class="ibox">✎</div>Notepad</div></div>`,
});
export const win2 = monoProfile('win2', {
  windowTitle: n => 'Paint - ' + n.toUpperCase() + '.MSP', aboutLine: 'Microsoft Windows Paint<br>Version 2.03 (1987)',
  titleButtons: ['min', 'max'], checkGlyph: '✓',
  deskExtra: `<div class="iconarea"><div class="dicon"><div class="ibox">C:\\</div>MS-DOS<br>Executive</div><div class="dicon"><div class="ibox">🕒</div>CLOCK</div><div class="dicon"><div class="ibox">W</div>WRITE</div></div>`,
});

// ============ Windows 3.x Paintbrush ============
export const win31 = {
  id: 'win31', semantics: 'win31', size: [640, 400], defaultTool: 'brush', appName: 'Paintbrush', undoLevels: 30,
  windowTitle: n => 'Paintbrush - ' + n.toUpperCase() + '.BMP', aboutLine: 'Microsoft Paintbrush<br>Windows 3.1 (1992)',
  titleButtons: ['min', 'max'], checkGlyph: '✓',
  tools: [T('freeselect', 'Scissors', 'scissors'), T('select', 'Pick'), T('air', 'Airbrush'), T('text', 'Text'),
    T('cerase', 'Color Eraser'), T('eraser', 'Eraser'), T('fill', 'Paint Roller'), T('brush', 'Brush'),
    T('curve', 'Curve'), T('line', 'Line'), T('rect', 'Box'), T('rectf', 'Filled Box'),
    T('rrect', 'Rounded Box'), T('rrectf', 'Filled Rounded Box'), T('ellipse', 'Circle/Ellipse'), T('ellipsef', 'Filled Circle/Ellipse'),
    T('poly', 'Polygon'), T('polyf', 'Filled Polygon')],
  init(E) { E.lineWidth = 2; E.brush = { shape: 'square', size: 4 }; E.airSize = 10; E.magLevel = 6; E.font = { family: 'Arial, Helvetica, sans-serif', size: 16 }; },
  onLineWidth(w, app) { app.E.brush.size = Math.max(1, w * 2); app.E.airSize = 6 + w * 2; },
  options(el, app) { linesizeBox(app, el, [1, 2, 3, 4, 6, 8, 10, 14]); },
  palette(el, app) {
    el.append(h('div', { class: 'selcol' }, h('div', { class: 'fgc' })));
    const grid = h('div', { class: 'cols' }); el.append(grid);
    PALETTE28.forEach((c, i) => grid.append(app.swatch(c, () => { app.E.fg = c; app.sync(); app.E.refreshText(); }, () => { app.E.bg = c; app.sync(); })));
    app.custom = PALETTE28.slice();
  },
  sync(app) { const s = $('.selcol', app.root); if (s) { s.style.background = app.E.bg; s.firstChild.style.background = app.E.fg; } },
  editColors(app) { app.editColors(app.E.fg, c => { app.E.fg = c; app.sync(); }); },
  menus: app => [
    fileMenu(app, ['-', { label: 'Page Se&tup...', disabled: () => true }, { label: '&Print...', disabled: () => true }, { label: 'P&rint Setup...', disabled: () => true }]),
    { label: '&Edit', items: [
      { label: '&Undo', key: 'Ctrl+Z', action: () => app.E.undo() }, { label: '&Redo', key: 'Ctrl+Y', action: () => app.E.redo() }, '-',
      { label: 'Cu&t', key: 'Ctrl+X', action: () => app.E.cut() }, { label: '&Copy', key: 'Ctrl+C', action: () => app.E.copy() }, { label: '&Paste', key: 'Ctrl+V', action: () => app.E.paste() }, '-',
      { label: 'C&opy To...', action: () => app.E.saveSelectionPNG() || app.flash('Pick an area first') }, { label: 'Paste &From...', action: () => app.cmdOpen(true) }] },
    { label: '&View', items: [
      { label: 'Zoom &In', key: 'Ctrl+N'.replace('N', '+'), action: () => app.E.setZoom(Math.min(8, app.E.zoom === 1 ? 6 : app.E.zoom + 2)) },
      { label: 'Zoom &Out', key: 'Ctrl+-', action: () => app.E.setZoom(1) },
      { label: '&View Picture', action: () => viewPicture(app) }, '-',
      { label: '&Tools and Linesize', checked: () => app.show.tools, action: () => toggle(app, 'tools') },
      { label: '&Palette', checked: () => app.show.palette, action: () => toggle(app, 'palette') },
      { label: '&Cursor Position', checked: () => app.show.cursorpos, action: () => cursorPos(app) }] },
    { label: '&Text', items: [
      { label: '&Regular', checked: () => !['bold', 'italic', 'underline', 'outline', 'shadow'].some(k => app.E.font[k]), action: () => { Object.assign(app.E.font, { bold: false, italic: false, underline: false, outline: false, shadow: false }); app.E.refreshText(); } },
      { label: '&Bold', key: 'Ctrl+B', ...textCheck(app, 'bold') }, { label: '&Italic', key: 'Ctrl+I', ...textCheck(app, 'italic') }, { label: '&Underline', key: 'Ctrl+U', ...textCheck(app, 'underline') }, '-',
      { label: '&Outline', ...textCheck(app, 'outline') }, { label: '&Shadow', ...textCheck(app, 'shadow') }, '-',
      { label: '&Fonts...', action: () => fontDialog(app) }] },
    { label: '&Pick', items: [
      { label: 'Flip &Horizontal', action: () => app.E.xform('flipH') }, { label: 'Flip &Vertical', action: () => app.E.xform('flipV') },
      { label: '&Inverse', action: () => app.E.xform('invert') }, { label: '&Shrink + Grow...', action: () => app.cmdStretch() }, { label: '&Tilt...', action: () => app.cmdStretch() },
      { label: '&Clear', action: () => app.E.clearSelection() }] },
    { label: '&Options', items: [
      { label: '&Image Attributes...', action: () => app.cmdAttributes() }, { label: '&Brush Shapes...', action: () => brushShapeDialog(app) },
      { label: '&Edit Colors...', action: () => win31.editColors(app) }, { label: 'Clear &Image', action: () => app.E.clearImage() }] },
    { label: '&Help', items: [{ label: '&Contents', action: () => app.help() }, '-', { label: '&About Paintbrush...', action: () => app.about() }] },
  ],
  helpText: 'Left-click a palette color for the foreground, right-click (or long-press on touch) for the background. Filled shapes use the foreground as fill and background as border. Color Eraser swaps the foreground color for the background. Linesize also sets the brush, eraser and airbrush size. Two-finger drag scrolls on touch screens.',
};

// ============ Windows 95 Paint ============
const OPT = {
  eraser: [4, 6, 8, 10], mag: [1, 2, 6, 8], line: [1, 2, 3, 4, 5], air: [4, 8, 12],
  brush: [['round', 7], ['round', 4], ['round', 1], ['square', 8], ['square', 5], ['square', 2], ['fslash', 8], ['fslash', 5], ['fslash', 2], ['bslash', 8], ['bslash', 5], ['bslash', 2]],
};
export const win95 = {
  id: 'win95', semantics: 'win95', size: [640, 480], defaultTool: 'pencil', appName: 'Paint', undoLevels: 30, afterPick: true,
  windowTitle: n => n + ' - Paint', aboutLine: 'Microsoft Paint<br>Windows 95 (1995)',
  titleIcon: ICONS.brush, titleButtons: ['min', 'max', 'close'], checkGlyph: '✓',
  statusText: 'For Help, click Help Topics on the Help Menu.',
  tools: [T('freeselect', 'Free-Form Select'), T('select', 'Select'), T('eraser', 'Eraser/Color Eraser'), T('fill', 'Fill With Color'),
    T('picker', 'Pick Color'), T('magnifier', 'Magnifier'), T('pencil', 'Pencil'), T('brush', 'Brush'),
    T('air', 'Airbrush'), T('text', 'Text'), T('line', 'Line'), T('curve', 'Curve'),
    T('rect', 'Rectangle'), T('poly', 'Polygon'), T('ellipse', 'Ellipse'), T('rrect', 'Rounded Rectangle')],
  init(E, app) { E.brush = { shape: 'round', size: 4 }; E.airSize = 8; E.magLevel = 4; E.font = { family: 'Arial, Helvetica, sans-serif', size: 16 }; app.show.textbar = true; },
  onTool(t, app) { $('.textbar', app.root).classList.toggle('show', t === 'text' && app.show.textbar); if (t === 'text') renderTextbar(app); },
  options(el, app) {
    const E = app.E, t = E.tool, box = h('div', { class: 'optbox opt-' + t }); el.append(box);
    const item = (on, html, fn, cls = '') => { const b = h('div', { class: 'oi ' + cls + (on ? ' on' : ''), html }); b.addEventListener('click', () => { fn(); app.renderOptions(); }); box.append(b); };
    if (t === 'select' || t === 'freeselect' || t === 'text') {
      const isT = t === 'text';
      item(isT ? E.opaqueText : !E.transparentSel, '<svg viewBox="0 0 32 22" width="32" height="22"><rect x="2" y="2" width="28" height="18" fill="#fff" stroke="#000"/><ellipse cx="13" cy="11" rx="7" ry="6" fill="#0ff"/><rect x="16" y="6" width="10" height="10" fill="#f00"/></svg>', () => isT ? (E.opaqueText = true, E.refreshText()) : E.setTransparent(false), 'big');
      item(isT ? !E.opaqueText : E.transparentSel, '<svg viewBox="0 0 32 22" width="32" height="22"><rect x="2" y="2" width="28" height="18" fill="#fff" stroke="#000"/><ellipse cx="13" cy="11" rx="7" ry="6" fill="#0ff"/><rect x="16" y="6" width="10" height="10" fill="none" stroke="#f00"/></svg>', () => isT ? (E.opaqueText = false, E.refreshText()) : E.setTransparent(true), 'big');
    } else if (t === 'eraser') OPT.eraser.forEach(s => item(E.eraserSize === s, `<div class="sq" style="width:${s}px;height:${s}px"></div>`, () => E.eraserSize = s));
    else if (t === 'magnifier') OPT.mag.forEach(z => item(E.zoom === z, z + 'x', () => { E.magLevel = z > 1 ? z : 4; E.setZoom(z); }, 'txt'));
    else if (t === 'brush') OPT.brush.forEach(([s, n]) => item(E.brush.shape === s && E.brush.size === n, brushPreview(s, n), () => E.brush = { shape: s, size: n }, 'bsh'));
    else if (t === 'air') OPT.air.forEach((s, i) => item(E.airSize === s, `<svg viewBox="0 0 26 26" width="${14 + i * 5}" height="${14 + i * 5}">${sprayDots()}</svg>`, () => E.airSize = s, 'air'));
    else if (t === 'line' || t === 'curve') OPT.line.forEach(w => item(E.lineWidth === w, `<div class="lsbar" style="height:${w}px"></div>`, () => E.lineWidth = w, 'lw'));
    else if (['rect', 'poly', 'ellipse', 'rrect'].includes(t)) [['outline', 'none', '#000'], ['both', '#808080', '#000'], ['fill', '#808080', 'none']].forEach(([m, f, s]) => item(E.fillMode === m, `<svg viewBox="0 0 30 14" width="30" height="14"><rect x="1.5" y="1.5" width="27" height="11" fill="${f}" stroke="${s}"/></svg>`, () => E.fillMode = m, 'fm'));
  },
  palette(el, app) {
    el.append(h('div', { class: 'cur2' }, h('div', { class: 'bgc' }), h('div', { class: 'fgc' })));
    const grid = h('div', { class: 'cols' }); el.append(grid);
    PALETTE28.forEach(c => grid.append(app.swatch(c, () => { app.E.fg = c; app.sync(); app.E.refreshText(); }, () => { app.E.bg = c; app.sync(); app.E.setTransparent(app.E.transparentSel); })));
  },
  sync(app) { const r = app.root; const f = $('.cur2 .fgc', r), b = $('.cur2 .bgc', r); if (f) { f.style.background = app.E.fg; b.style.background = app.E.bg; } },
  editColors(app) { app.editColors(app.E.fg, c => { app.E.fg = c; app.sync(); }); },
  menus: app => [
    fileMenu(app, ['-', { label: 'Print Pre&view', disabled: () => true }, { label: 'Page Se&tup...', disabled: () => true }, { label: '&Print...', key: 'Ctrl+P', disabled: () => true }, '-',
      { label: 'Set As &Wallpaper (Tiled)', action: () => wallpaper(app, true) }, { label: 'Set As Wa&llpaper (Centered)', action: () => wallpaper(app, false) }]),
    { label: '&Edit', items: [
      { label: '&Undo', key: 'Ctrl+Z', action: () => app.E.undo() }, { label: '&Repeat', key: 'F4', action: () => app.E.redo() }, '-',
      { label: 'Cu&t', key: 'Ctrl+X', action: () => app.E.cut() }, { label: '&Copy', key: 'Ctrl+C', action: () => app.E.copy() }, { label: '&Paste', key: 'Ctrl+V', action: () => app.E.paste() },
      { label: 'C&lear Selection', key: 'Del', action: () => app.E.clearSelection() }, { label: 'Select &All', key: 'Ctrl+L', action: () => app.E.selectAll() }, '-',
      { label: 'C&opy To...', action: () => app.E.saveSelectionPNG() || app.flash('Select an area first') }, { label: 'Paste &From...', action: () => app.cmdOpen(true) }] },
    { label: '&View', items: [
      { label: '&Tool Box', key: 'Ctrl+T', checked: () => app.show.tools, action: () => toggle(app, 'tools') },
      { label: '&Color Box', key: 'Ctrl+A', checked: () => app.show.palette, action: () => toggle(app, 'palette') },
      { label: '&Status Bar', checked: () => app.show.status, action: () => toggle(app, 'status') }, '-',
      { label: '&Zoom', sub: [
        { label: '&Normal Size', key: 'Ctrl+PgUp', action: () => app.E.setZoom(1) }, { label: '&Large Size', key: 'Ctrl+PgDn', action: () => app.E.setZoom(4) },
        { label: 'C&ustom...', action: () => customZoom(app) }, '-',
        { label: 'Show &Grid', key: 'Ctrl+G', checked: () => app.E.grid, action: () => { app.E.grid = !app.E.grid; app.E.render(); } }] },
      { label: '&View Bitmap', key: 'Ctrl+F', action: () => viewPicture(app) },
      { label: 'Te&xt Toolbar', checked: () => app.show.textbar, action: () => { app.show.textbar = !app.show.textbar; win95.onTool(app.E.tool, app); } }] },
    { label: '&Image', items: [
      { label: '&Flip/Rotate...', key: 'Ctrl+R', action: () => app.cmdFlipRotate() }, { label: '&Stretch/Skew...', key: 'Ctrl+W', action: () => app.cmdStretch() },
      { label: '&Invert Colors', key: 'Ctrl+I', action: () => app.E.xform('invert') }, { label: '&Attributes...', key: 'Ctrl+E', action: () => app.cmdAttributes() },
      { label: '&Clear Image', key: 'Ctrl+Shft+N', action: () => app.E.clearImage() }] },
    { label: '&Options', items: [
      { label: '&Edit Colors...', action: () => win95.editColors(app) }, { label: '&Get Colors...', disabled: () => true }, { label: '&Save Colors...', disabled: () => true }, '-',
      { label: '&Draw Opaque', checked: () => !app.E.transparentSel, action: () => app.E.setTransparent(!app.E.transparentSel) || app.renderOptions() }] },
    { label: '&Help', items: [{ label: '&Help Topics', action: () => app.help() }, '-', { label: '&About Paint', action: () => app.about() }] },
  ],
  helpText: 'Left-click a color in the Color Box for the foreground color, right-click (or long-press on touch) for the background color. Right-drag with the Eraser to use the Color Eraser. Shapes: choose outline, outline+fill or fill-only below the toolbox. Double-click (or tap the start point) to finish a polygon. Two-finger drag scrolls on touch screens. Your picture autosaves in this browser.',
};

function brushPreview(s, n) {
  const c = 6, sz = Math.max(1, n);
  if (s === 'round') return `<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="${c}" cy="${c}" r="${sz / 2}" fill="#000"/></svg>`;
  if (s === 'square') return `<svg viewBox="0 0 12 12" width="12" height="12" shape-rendering="crispEdges"><rect x="${c - sz / 2}" y="${c - sz / 2}" width="${sz}" height="${sz}" fill="#000"/></svg>`;
  const d = sz / 2; return `<svg viewBox="0 0 12 12" width="12" height="12"><path d="${s === 'fslash' ? `M${c - d} ${c + d} L${c + d} ${c - d}` : `M${c - d} ${c - d} L${c + d} ${c + d}`}" stroke="#000" stroke-width="1.2"/></svg>`;
}
function sprayDots() { let s = ''; for (let i = 0; i < 40; i++) { const a = i * 2.4, r = Math.sqrt(i / 40) * 11; s += `<rect x="${(13 + Math.cos(a) * r) | 0}" y="${(13 + Math.sin(a) * r) | 0}" width="1" height="1"/>`; } return s; }
function toggle(app, k) { app.show[k] = !app.show[k]; app.root.classList.toggle('hide-' + k, !app.show[k]); }
function viewPicture(app) {
  const c = document.createElement('canvas'); c.width = app.E.S.w; c.height = app.E.S.h; c.getContext('2d').drawImage(app.E.canvas, 0, 0);
  const v = h('div', { class: 'viewpic' }, c); v.addEventListener('pointerdown', () => v.remove()); document.body.append(v);
}
function cursorPos(app) {
  app.show.cursorpos = !app.show.cursorpos;
  if (!app.show.cursorpos) { document.querySelector('.cpwin')?.remove(); return; }
  document.body.append(h('div', { class: 'cpwin' }, h('div', { class: 'titlebar' }, h('div', { class: 'caption' }, 'Cursor Position')), h('div', { class: 'cursorpos' }, '0, 0')));
}
async function customZoom(app) {
  const r = await app.dialog('Custom Zoom', `<p>Current zoom: ${app.E.zoom * 100}%</p><fieldset><legend>Zoom to</legend>${[1, 2, 4, 6, 8].map(z => `<label class="rad"><input type="radio" name="z" value="${z}" ${app.E.zoom === z ? 'checked' : ''}> ${z * 100}%</label>`).join('')}</fieldset>`, ['OK', 'Cancel']);
  if (r?.btn === 'OK' && r.vals.z) app.E.setZoom(+r.vals.z);
}
function wallpaper(app, tiled) {
  const url = app.E.canvas.toDataURL();
  document.body.style.background = tiled ? `url(${url}) repeat` : `#008080 url(${url}) no-repeat center`;
  app.flash('Wallpaper set (for this tab)');
}
async function fontDialog(app) {
  const E = app.E, fams = fontFamilies();
  const r = await app.dialog('Font', `<div class="dlg-grid"><label>Font:</label><select name="f">${fams.map(([n, , css]) => `<option value='${css}' ${E.font.family === css ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label>Size:</label><select name="s">${[8, 10, 12, 14, 16, 18, 24, 28, 36, 48, 72].map(s => `<option ${E.font.size === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>`, ['OK', 'Cancel']);
  if (r?.btn === 'OK') { E.font.family = r.vals.f; E.font.size = +r.vals.s; E.refreshText(); }
}
function renderTextbar(app) {
  const bar = $('.textbar', app.root), E = app.E; bar.innerHTML = '';
  const fams = [['Arial', 'Arial, Helvetica, sans-serif'], ['Times New Roman', '"Times New Roman", Times, serif'], ['Courier New', '"Courier New", Courier, monospace'], ['Comic Sans MS', '"Comic Sans MS", cursive'], ['Impact', 'Impact, sans-serif'], ['Verdana', 'Verdana, sans-serif'], ['MS Sans Serif', 'Tahoma, Geneva, sans-serif']];
  const f = h('select', { class: 'tb-font' }, ...fams.map(([n, css]) => { const o = h('option', { value: css }, n); if (E.font.family === css) o.selected = true; return o; }));
  f.onchange = () => { E.font.family = f.value; E.refreshText(); };
  const s = h('select', { class: 'tb-size' }, ...[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map(n => { const o = h('option', {}, n); if (E.font.size === n) o.selected = true; return o; }));
  s.onchange = () => { E.font.size = +s.value; E.refreshText(); };
  const tb = (k, lab) => { const b = h('button', { class: 'tbb' + (E.font[k] ? ' on' : ''), html: lab }); b.onclick = () => { E.font[k] = !E.font[k]; b.classList.toggle('on', E.font[k]); E.refreshText(); }; return b; };
  bar.append(h('span', { class: 'tbt' }, 'Fonts'), f, s, tb('bold', '<b>B</b>'), tb('italic', '<i>I</i>'), tb('underline', '<u>U</u>'));
}

export function boot(id) { const P = { win1, win2, win31, win95 }[id]; return new App(P); }
