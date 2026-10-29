const byId = (id) => document.getElementById(id);
const viewport = byId('deck-viewport');
const penCanvas = byId('pen-canvas');
const drawCanvas = byId('draw-canvas');
const ctx = {
  get pen() { return penCanvas ? penCanvas.getContext('2d') : null; },
  get draw() { return drawCanvas ? drawCanvas.getContext('2d') : null; }
};

let deck, index = 0, cleanup = null, requestId = 0, menuOpen = false;
let mode = 'off'; // 'off' | 'trail' | 'retain' | 'board'
let focusMode = false;
let currentDrawColor = '#f05d5e';
let colorPickerOpen = false;
let toastTimer = null;
const cache = new Map();

// 核心批注持久化存储：以 page.id 为 key 存储留痕笔画痕，黑板模式独立存储
const pageStrokes = new Map();
let boardStrokes = [];

function toast(msg) {
  const el = byId('deck-toast') || byId('draw-hint');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('visible');
  }, 2200);
}

function resizeCanvases() {
  const dpr = window.devicePixelRatio || 1;
  [penCanvas, drawCanvas].forEach((canvas) => {
    if (!canvas) return;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  });
  if (ctx.pen) ctx.pen.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx.draw) ctx.draw.setTransform(dpr, 0, 0, dpr, 0, 0);
  redrawDraw();
}

function pageFromHash() {
  const raw = location.hash.slice(1);
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) {
    const num = parseInt(raw, 10) - 1;
    if (num >= 0 && num < deck.pages.length) return num;
  }
  const found = deck.pages.findIndex((page) => page.id === raw);
  return found < 0 ? 0 : found;
}

function setMenu(open) {
  menuOpen = open;
  byId('side-menu')?.classList.toggle('open', open);
  byId('menu-overlay')?.classList.toggle('visible', open);
}

function buildMenu() {
  const menu = byId('menu-list');
  if (!menu) return;
  menu.replaceChildren();
  deck.sections.forEach((section) => {
    const label = document.createElement('p');
    label.className = 'menu-section';
    label.textContent = section.title;
    menu.append(label);
    deck.pages.filter((page) => page.section === section.id).forEach((page) => {
      const button = document.createElement('button');
      button.className = 'menu-page';
      button.dataset.pageId = page.id;
      button.innerHTML = `<span>${String(deck.pages.indexOf(page) + 1).padStart(2, '0')}</span>${page.title}`;
      button.addEventListener('click', () => {
        setMenu(false);
        show(deck.pages.indexOf(page));
      });
      menu.append(button);
    });
  });
}

function updateChrome() {
  const total = deck.pages.length;
  const page = deck.pages[index];

  // 顶部 3px 精细进度条
  const bar = byId('progress-bar');
  if (bar) {
    bar.style.width = `${Math.max(4, (index / (total - 1 || 1)) * 100)}%`;
  }

  // 顶部微型认知上下文 (Breadcrumb)
  const topbarDeck = byId('topbar-deck-title');
  const topbarSec = byId('topbar-section-title');
  const currentSection = deck.sections.find((s) => s.id === page.section);
  if (topbarDeck) topbarDeck.textContent = deck.title.toUpperCase();
  if (topbarSec) topbarSec.textContent = currentSection ? `${currentSection.title.toUpperCase()} (${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')})` : page.section;

  // 左侧 Dock 内置页码指示器
  const curEl = byId('page-current');
  const totEl = byId('page-total');
  if (curEl) curEl.textContent = String(index + 1).padStart(2, '0');
  if (totEl) totEl.textContent = String(total).padStart(2, '0');

  // 兼容旧版单一文本 page-indicator
  const legacyIndicator = byId('page-indicator');
  if (legacyIndicator && !curEl) {
    legacyIndicator.textContent = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  }

  // 左右边缘导航按钮状态
  const prevBtn = byId('nav-prev') || byId('previous-page');
  const nextBtn = byId('nav-next') || byId('next-page');
  if (prevBtn) prevBtn.disabled = index === 0;
  if (nextBtn) nextBtn.disabled = index === total - 1;

  document.querySelectorAll('.menu-page').forEach((node) => {
    node.classList.toggle('active', node.dataset.pageId === page.id);
  });
}

async function fragment(page) {
  if (window.__EMBEDDED_FRAGMENTS__ && window.__EMBEDDED_FRAGMENTS__[page.path]) {
    return window.__EMBEDDED_FRAGMENTS__[page.path];
  }
  if (!cache.has(page.path)) {
    cache.set(page.path, fetch(page.path).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${page.path}`);
      return response.text();
    }));
  }
  return cache.get(page.path);
}

async function show(next) {
  if (next < 0 || next >= deck.pages.length) return;
  const token = ++requestId;
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  index = next;
  const page = deck.pages[index];
  updateChrome();
  if (location.hash.slice(1) !== page.id) {
    history.replaceState(null, '', `#${page.id}`);
  }

  // 切页时清空激光笔残影，并自动复原当前页的批注
  if (trails.length) {
    trails.length = 0;
    ctx.pen?.clearRect(0, 0, innerWidth, innerHeight);
  }
  redrawDraw();

  try {
    const html = await fragment(page);
    if (token !== requestId) return;
    viewport.innerHTML = `<article class="slide" data-page-id="${page.id}" data-page-type="${page.type}">${html}</article>`;
    if (page.module) {
      let module;
      if (window.__EMBEDDED_MODULES__ && window.__EMBEDDED_MODULES__[page.module]) {
        module = window.__EMBEDDED_MODULES__[page.module];
      } else {
        module = await import(`../${page.module}`);
      }
      if (token !== requestId) return;
      cleanup = (await module.init({ root: viewport.firstElementChild, page, deck })) || null;
    }
  } catch (error) {
    if (token === requestId) {
      viewport.innerHTML = `<article class="slide"><p class="eyebrow">Load error</p><h1 class="section-title">This page could not load.</h1><p class="lead">${error.message}</p></article>`;
    }
  }
  [index - 1, index + 1].forEach((nearby) => {
    if (deck.pages[nearby]) fragment(deck.pages[nearby]).catch(() => {});
  });
}

/* ==========================================================================
   激光笔拖尾引擎 (Trail Pen - 快捷键 T)
   ========================================================================== */
const trails = [];
let penDrawing = false;
let penPoints = [];

function point(event) {
  const source = event.touches ? event.touches[0] : event;
  return { x: source.clientX, y: source.clientY, t: performance.now() };
}

function renderPen() {
  if (!ctx.pen) return;
  ctx.pen.clearRect(0, 0, innerWidth, innerHeight);
  const now = performance.now();
  for (let i = trails.length - 1; i >= 0; i--) {
    const trail = trails[i];
    const age = now - trail.at;
    if (age > 1200) {
      trails.splice(i, 1);
      continue;
    }
    ctx.pen.strokeStyle = currentDrawColor;
    ctx.pen.globalAlpha = 1 - age / 1200;
    ctx.pen.lineWidth = 3.5;
    ctx.pen.lineCap = 'round';
    ctx.pen.lineJoin = 'round';
    ctx.pen.beginPath();
    trail.points.forEach((p, n) => (n ? ctx.pen.lineTo(p.x, p.y) : ctx.pen.moveTo(p.x, p.y)));
    ctx.pen.stroke();
  }
  ctx.pen.globalAlpha = 1;
  if (trails.length || penDrawing) requestAnimationFrame(renderPen);
}

function penStart(event) {
  if (mode !== 'trail') return;
  event.preventDefault();
  penDrawing = true;
  penPoints = [point(event)];
  requestAnimationFrame(renderPen);
}

function penMove(event) {
  if (!penDrawing || mode !== 'trail') return;
  event.preventDefault();
  penPoints.push(point(event));
}

function penEnd() {
  if (!penDrawing) return;
  penDrawing = false;
  if (penPoints.length > 1) trails.push({ points: penPoints, at: performance.now() });
  penPoints = [];
}

/* ==========================================================================
   批注画板与留痕系统 (Retain Pen P + Board D)
   ========================================================================== */
let drawing = false;
let currentStroke = null;

function getCurrentStrokes() {
  if (mode === 'board') return boardStrokes;
  if (!deck?.pages?.[index]) return [];
  const pageId = deck.pages[index].id;
  if (!pageStrokes.has(pageId)) pageStrokes.set(pageId, []);
  return pageStrokes.get(pageId);
}

function redrawDraw() {
  if (!ctx.draw) return;
  ctx.draw.clearRect(0, 0, innerWidth, innerHeight);
  const strokes = getCurrentStrokes();
  strokes.forEach((stroke) => {
    if (!stroke.points || !stroke.points.length) return;
    ctx.draw.strokeStyle = stroke.color;
    ctx.draw.lineWidth = stroke.width;
    ctx.draw.lineCap = 'round';
    ctx.draw.lineJoin = 'round';
    ctx.draw.beginPath();
    stroke.points.forEach((p, n) => (n === 0 ? ctx.draw.moveTo(p.x, p.y) : ctx.draw.lineTo(p.x, p.y)));
    ctx.draw.stroke();
  });
}

function drawPoint(event) {
  const source = event.touches ? event.touches[0] : event;
  return { x: source.clientX, y: source.clientY };
}

function drawStart(event) {
  if (mode !== 'retain' && mode !== 'board') return;
  event.preventDefault();
  drawing = true;
  const p = drawPoint(event);
  currentStroke = {
    color: currentDrawColor,
    width: mode === 'board' ? 3.5 : 3,
    points: [p]
  };
  getCurrentStrokes().push(currentStroke);
  ctx.draw.strokeStyle = currentStroke.color;
  ctx.draw.lineWidth = currentStroke.width;
  ctx.draw.lineCap = 'round';
  ctx.draw.lineJoin = 'round';
  ctx.draw.beginPath();
  ctx.draw.moveTo(p.x, p.y);
}

function drawMove(event) {
  if (!drawing || !currentStroke) return;
  event.preventDefault();
  const p = drawPoint(event);
  currentStroke.points.push(p);
  ctx.draw.lineTo(p.x, p.y);
  ctx.draw.stroke();
}

function drawEnd() {
  drawing = false;
  currentStroke = null;
}

function undoCurrentStroke() {
  if (mode !== 'retain' && mode !== 'board') return;
  const strokes = getCurrentStrokes();
  if (!strokes.length) return;
  strokes.pop();
  redrawDraw();
  toast('已撤回上一笔');
}

function clearCurrentMarks() {
  if (mode === 'board') {
    boardStrokes = [];
    redrawDraw();
    toast('黑板已清空');
    return;
  }
  if (deck?.pages?.[index]) {
    pageStrokes.delete(deck.pages[index].id);
    redrawDraw();
    toast('当前页批注已清空');
  }
}

/* ==========================================================================
   统一讲师模式状态机 (setLecturerMode)
   ========================================================================== */
function setLecturerMode(target) {
  const next = mode === target ? 'off' : target;
  penEnd();
  drawEnd();

  // 离开旧模式时的清理
  if (mode === 'trail') {
    trails.length = 0;
    ctx.pen?.clearRect(0, 0, innerWidth, innerHeight);
  }

  mode = next;

  // 同步 Dock 工具栏状态
  byId('btn-pen')?.classList.toggle('active', mode === 'trail');
  byId('btn-retain')?.classList.toggle('active', mode === 'retain');
  byId('btn-draw')?.classList.toggle('active', mode === 'board');

  // 同步画布事件捕获
  penCanvas?.classList.toggle('active', mode === 'trail');
  drawCanvas?.classList.toggle('active', mode === 'retain' || mode === 'board');

  // 同步全屏黑板磨砂层
  byId('board-sheet')?.classList.toggle('active', mode === 'board');

  // 刷新当前画面笔迹
  redrawDraw();

  // Toast 状态反馈
  if (mode === 'trail') toast('激光笔模式：随画随隐 · Esc 退出');
  else if (mode === 'retain') toast('留痕笔模式：按页保存 · Z 撤回 · R 清空 · Esc 退出');
  else if (mode === 'board') toast('临时黑板模式：纯净板书 · Z 撤回 · R 清空 · Esc 退出');
  else toast('批注已退出');
}

// 保持契约向后兼容
function togglePen() { setLecturerMode('trail'); }
function toggleRetain() { setLecturerMode('retain'); }
function toggleDraw() { setLecturerMode('board'); }

/* ==========================================================================
   专注演讲模式 (Focus Mode - H 键)
   ========================================================================== */
function toggleFocus() {
  focusMode = !focusMode;
  document.body.classList.toggle('focus-mode', focusMode);
  byId('btn-focus')?.classList.toggle('active', focusMode);
  toast(focusMode ? '专注模式：已隐藏所有控件 (按 H 退出)' : '已退出专注模式');
}

/* ==========================================================================
   4 色调色盘控制 (快捷键 C)
   ========================================================================== */
function setDrawColor(color) {
  currentDrawColor = color;
  const indicator = byId('color-dot-indicator');
  if (indicator) indicator.style.background = color;
  const popup = byId('color-picker-popup');
  if (popup) popup.classList.remove('open');
  colorPickerOpen = false;
  toast(`画笔颜色已切换`);
}

function toggleColorPicker(e) {
  if (e) e.stopPropagation();
  colorPickerOpen = !colorPickerOpen;
  const popup = byId('color-picker-popup');
  if (popup) popup.classList.toggle('open', colorPickerOpen);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.();
  }
}

/* ==========================================================================
   键盘快捷键体系
   ========================================================================== */
function onKey(event) {
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
  const key = event.key.toLowerCase();

  if (key === 'escape') {
    if (colorPickerOpen) { toggleColorPicker(); return; }
    if (mode !== 'off') { setLecturerMode('off'); return; }
    if (focusMode) { toggleFocus(); return; }
    if (menuOpen) { setMenu(false); return; }
    return;
  }

  // 撤回：Z 或 Ctrl/Cmd+Z
  if ((key === 'z' || ((event.ctrlKey || event.metaKey) && key === 'z')) && (mode === 'retain' || mode === 'board')) {
    event.preventDefault();
    undoCurrentStroke();
    return;
  }

  // 擦除当前画痕：R
  if (key === 'r' && (mode === 'retain' || mode === 'board')) {
    event.preventDefault();
    clearCurrentMarks();
    return;
  }

  // 快速切颜色 1-4
  if (['1', '2', '3', '4'].includes(key) && mode !== 'off') {
    const colors = ['#f05d5e', '#3B82F6', '#55a88c', '#f59e0b'];
    setDrawColor(colors[parseInt(key, 10) - 1]);
    return;
  }

  // 导航键
  if (key === 'arrowright' || key === ' ' || key === 'arrowdown' || key === 'pagedown') {
    event.preventDefault();
    show(index + 1);
    return;
  }
  if (key === 'arrowleft' || key === 'arrowup' || key === 'pageup') {
    event.preventDefault();
    show(index - 1);
    return;
  }
  if (key === 'home') { show(0); return; }
  if (key === 'end') { show(deck.pages.length - 1); return; }

  // 讲师武器快捷键
  if (key === 'm') { setMenu(!menuOpen); return; }
  if (key === 't') { togglePen(); return; }
  if (key === 'p') { toggleRetain(); return; }
  if (key === 'd') { toggleDraw(); return; }
  if (key === 'h') { toggleFocus(); return; }
  if (key === 'c') { toggleColorPicker(); return; }
  if (key === 'f') { toggleFullscreen(); return; }
  if (key === '?') {
    toast('← → 翻页 · M 目录 · T 激光 · P 留痕 · D 黑板 · H 专注 · C 调色 · R 擦除 · Esc 退出');
  }
}

/* ==========================================================================
   触控滑动手势 (Touch Swipe)
   ========================================================================== */
let touchStartX = 0;
let touchStartY = 0;

function setupTouchSwipe() {
  viewport.addEventListener('touchstart', (e) => {
    if (mode !== 'off' || !e.touches.length) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  viewport.addEventListener('touchend', (e) => {
    if (mode !== 'off' || !e.changedTouches.length) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(diffX) > 48 && Math.abs(diffY) < 60) {
      if (diffX < 0) show(index + 1);
      else show(index - 1);
    }
  }, { passive: true });
}

function bind() {
  const on = (id, event, handler) => {
    const el = byId(id);
    if (el) el.addEventListener(event, handler);
  };
  const onAny = (ids, event, handler) => {
    ids.forEach((id) => on(id, event, handler));
  };

  onAny(['btn-menu', 'toggle-menu'], 'click', () => setMenu(!menuOpen));
  onAny(['close-menu'], 'click', () => setMenu(false));
  onAny(['menu-overlay'], 'click', () => setMenu(false));

  onAny(['nav-prev', 'previous-page'], 'click', () => show(index - 1));
  onAny(['nav-next', 'next-page'], 'click', () => show(index + 1));

  onAny(['btn-pen', 'toggle-pen'], 'click', togglePen);
  onAny(['btn-retain'], 'click', toggleRetain);
  onAny(['btn-draw', 'toggle-draw'], 'click', toggleDraw);
  onAny(['btn-focus'], 'click', toggleFocus);
  onAny(['btn-fullscreen', 'toggle-fullscreen'], 'click', toggleFullscreen);

  // 调色盘绑定
  on('btn-color', 'click', toggleColorPicker);
  on('draw-color', 'input', (e) => setDrawColor(e.target.value));

  document.querySelectorAll('.color-dot').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setDrawColor(btn.dataset.color);
    });
  });

  document.addEventListener('click', (e) => {
    if (colorPickerOpen && !byId('color-picker-wrap')?.contains(e.target)) {
      toggleColorPicker();
    }
  });

  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', resizeCanvases);

  // 路由 hash 响应
  window.addEventListener('hashchange', () => {
    const target = pageFromHash();
    if (target !== index) show(target);
  });

  penCanvas?.addEventListener('pointerdown', penStart);
  penCanvas?.addEventListener('pointermove', penMove);
  penCanvas?.addEventListener('pointerup', penEnd);

  drawCanvas?.addEventListener('pointerdown', drawStart);
  drawCanvas?.addEventListener('pointermove', drawMove);
  drawCanvas?.addEventListener('pointerup', drawEnd);

  setupTouchSwipe();
}

async function start() {
  if (window.__EMBEDDED_DECK__) {
    deck = window.__EMBEDDED_DECK__;
  } else {
    const response = await fetch('deck.json');
    deck = await response.json();
  }
  document.title = deck.title;
  resizeCanvases();
  bind();
  buildMenu();
  await show(pageFromHash());
  window.__deck = {
    show,
    get index() { return index; },
    get deck() { return deck; }
  };
}

start().catch((error) => {
  viewport.innerHTML = `<article class="slide"><h1 class="section-title">Deck startup failed</h1><p class="lead">${error.message}</p></article>`;
});
