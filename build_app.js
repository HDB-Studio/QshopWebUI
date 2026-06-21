// 构建 app.js 的脚本 —— 分块写入，避免单次超时
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, 'js', 'app.js');
const chunks = [];

chunks.push(`// ============================================================================
//  QshopWebUI — 前端主控脚本 (组件化 / 增量更新 / 分页懒加载)
//  架构说明:
//    - 所有 UI 拆分为带 mount / update 方法的组件
//    - switchTab 只在 tab 之间切换显示，不重建 DOM
//    - 数据层走分页 (默认 60 条 / 页)，滚动时才加载更多
//    - 不再在启动时 QSDB.getAll() 读取全部数据
// ============================================================================
(function(global) {
  'use strict';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, opts, children) {
    const node = document.createElement(tag);
    if (opts) {
      for (const k in opts) {
        const v = opts[k];
        if (k === 'class') node.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'style' && typeof v === 'string') node.setAttribute('style', v);
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children) {
      const arr = Array.isArray(children) ? children : [children];
      for (const c of arr) {
        if (c == null || c === false) continue;
        if (c.nodeType) node.appendChild(c);
        else if (Array.isArray(c)) c.forEach((x) => x && x.nodeType && node.appendChild(x));
        else node.appendChild(document.createTextNode(String(c)));
      }
    }
    return node;
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  }
  function throttle(fn, ms) {
    let last = 0, pending = null;
    return function () {
      const ctx = this, args = arguments;
      const now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(ctx, args); }
      else if (!pending) { pending = setTimeout(() => { last = Date.now(); pending = null; fn.apply(ctx, args); }, ms - (now - last)); }
    };
  }
  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toLocaleString('zh-CN');
  }

  const state = { currentTab: 'home', currentMaterial: null, search: '', sort: 'relevance', page: 1, pageSize: 60, isAdmin: false };
`);

chunks.push(`
  const COLOR_MAP = {
    'GRASS': '#4ade80', 'DIRT': '#a16207', 'STONE': '#6b7280',
    'COBBLESTONE': '#4b5563', 'WOOD': '#92400e', 'LOG': '#78350f',
    'PLANK': '#a16207', 'BRICK': '#ef4444', 'IRON': '#cbd5e1',
    'GOLD': '#facc15', 'DIAMOND': '#06b6d4', 'EMERALD': '#10b981',
    'REDSTONE': '#f87171', 'LAPIS': '#3b82f6', 'COAL': '#1f2937',
    'SAND': '#fde68a', 'GRAVEL': '#9ca3af', 'GLASS': '#e0f2fe',
    'OBSIDIAN': '#312e81', 'TNT': '#dc2626', 'SWORD': '#e11d48',
    'BOW': '#78350f', 'APPLE': '#dc2626', 'BREAD': '#f59e0b'
  };

  function colorFor(mat) {
    if (!mat) return '#374151';
    const key = String(mat).toUpperCase();
    for (const k in COLOR_MAP) if (key.indexOf(k) > -1) return COLOR_MAP[k];
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    const hue = ((h % 360) + 360) % 360;
    return 'hsl(' + hue + ', 55%, 55%)';
  }

  function normalizeItemName(name) {
    if (!name) return 'unknown';
    let s = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (s.slice(0, 10) === 'minecraft_') s = s.slice(10);
    return s;
  }

  function getItemImageCandidates(material) {
    const name = normalizeItemName(material);
    return ['assets/items/' + name + '.png', 'assets/items/' + name + '.gif', 'images/' + name + '.png'];
  }

  function renderCubeInContainer(container, material) {
    if (!container) return;
    container.innerHTML = '';
    const color = colorFor(material);
    const img = document.createElement('img');
    img.alt = material || 'item';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.className = 'shop-item-img';
    img.onerror = function () {
      if (img.parentNode) img.parentNode.removeChild(img);
      const cube = el('div', { class: 'shop-item-cube', style: { background: color, boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.18), inset 4px 4px 0 rgba(255,255,255,0.18)' } });
      cube.textContent = (material || '?').substring(0, 2).toUpperCase();
      container.appendChild(cube);
    };
    const cands = getItemImageCandidates(material);
    if (cands.length > 0) img.src = cands[0];
    container.appendChild(img);
  }

  function renderNBTPanel(nbt) {
    if (!nbt || typeof nbt !== 'object') return null;
    try {
      const text = typeof nbt === 'string' ? nbt : JSON.stringify(nbt);
      if (text.length < 4) return null;
      return el('div', { class: 'nbt-panel' }, [el('small', { text: 'NBT: ' + text.substring(0, 120) + (text.length > 120 ? '...' : '') })]);
    } catch (e) { return null; }
  }
`);

chunks.push(`
  const ShopCard = {
    mount(shop) {
      if (!shop) return el('div');
      const root = el('div', { class: 'shop-card fade-in' });
      const left = el('div', { class: 'shop-card-left' });
      root.appendChild(left);
      renderCubeInContainer(left, shop.material);

      const right = el('div', { class: 'shop-card-right' });
      root.appendChild(right);

      const tags = el('div');
      tags.appendChild(el('span', {
        class: 'neo-badge ' + (shop.shop_type === 'BUYING' ? 'info' : 'inverted'),
        text: shop.shop_type === 'BUYING' ? '收购' : '出售'
      }));
      tags.appendChild(el('span', {
        class: 'neo-badge ' + (shop.price_reasonable ? 'ok' : 'warn'),
        text: shop.price_reasonable ? '合理' : '偏高'
      }));

      right.appendChild(el('div', { class: 'shop-card-header' }, [
        el('div', { class: 'shop-title' }, [
          el('div', { class: 'shop-name', text: shop.item_name || shop.material }),
          el('small', { class: 'shop-material', text: shop.material })
        ]),
        tags
      ]));

      const table = el('table', { class: 'kv-table' });
      function tr(label, valueNode) {
        table.appendChild(el('tr', null, [el('td', { text: label }), el('td', null, [valueNode])]));
      }
      tr('店主', document.createTextNode(shop.owner_name || '-'));
      tr('价格', el('span', { class: 'price-col', text: '$' + Number(shop.price || 0).toFixed(2) }));
      tr('堆叠', document.createTextNode(String(shop.stacking_amount || 1)));
      tr('世界', document.createTextNode(shop.world || 'world'));
      tr('坐标', document.createTextNode('(' + shop.x + ', ' + shop.y + ', ' + shop.z + ')'));
      right.appendChild(table);

      const nbtEl = renderNBTPanel(shop.nbt);
      if (nbtEl) right.appendChild(nbtEl);
      return root;
    }
  };
`);

chunks.push(`
  const StatsPanel = {
    el: null,
    mount(root) {
      if (this.el) return;
      const row = el('div', { class: 'stats-row' }, [
        el('div', { class: 'stat-card', id: 'stat-shops' }, [el('div', { class: 'val', text: '...' }), el('div', { class: 'lbl', text: '家商店' })]),
        el('div', { class: 'stat-card', id: 'stat-materials' }, [el('div', { class: 'val', text: '...' }), el('div', { class: 'lbl', text: '种物品' })]),
        el('div', { class: 'stat-card', id: 'stat-sellers' }, [el('div', { class: 'val', text: '...' }), el('div', { class: 'lbl', text: '家出售' })]),
        el('div', { class: 'stat-card', id: 'stat-buyers' }, [el('div', { class: 'val', text: '...' }), el('div', { class: 'lbl', text: '家收购' })])
      ]);
      root.appendChild(row);
      this.el = row;
    },
    update(stats, materialCount) {
      if (!this.el) return;
      const vals = this.el.querySelectorAll('.val');
      if (!vals || vals.length < 4) return;
      vals[0].textContent = fmt(stats && stats.total_shops);
      vals[1].textContent = fmt(materialCount || (stats && stats.total_materials));
      vals[2].textContent = fmt(stats && (stats.selling_shops !== undefined ? stats.selling_shops : stats.total_shops));
      vals[3].textContent = fmt(stats && (stats.buying_shops !== undefined ? stats.buying_shops : 0));
    }
  };

  const Toolbar = {
    el: null, matSelect: null, sortSelect: null, searchInput: null,
    onSearchChange: null, onFilterChange: null,
    mount(root, opts) {
      if (this.el) return;
      this.onSearchChange = opts && opts.onSearchChange;
      this.onFilterChange = opts && opts.onFilterChange;
      const self = this;
      const tb = el('div', { class: 'toolbar' });

      const searchBox = el('div', { class: 'search-box', style: { flex: '2', minWidth: '280px' } }, [
        el('input', { type: 'text', id: 'search-input', placeholder: '搜索物品名 / 店主 / 材质...' }),
        el('button', { class: 'search-btn', text: '搜索' })
      ]);
      tb.appendChild(searchBox);

      const matSelect = el('select', { class: 'filter-select', id: 'filter-material' });
      matSelect.appendChild(el('option', { value: '', text: '全部分类 (加载中...)' }));
      tb.appendChild(matSelect);

      const sortSelect = el('select', { class: 'filter-select', id: 'filter-sort' });
      [['relevance', '默认排序'], ['activity', '活跃度'], ['price_asc', '价格低→高'], ['price_desc', '价格高→低'], ['owner', '店主A-Z'], ['newest', '最新']].forEach(([val, label]) => {
        sortSelect.appendChild(el('option', { value: val, text: label }));
      });
      tb.appendChild(sortSelect);

      const clearBtn = el('button', {
        class: 'neo-btn', text: '重置筛选',
        onclick: () => {
          state.search = ''; state.currentMaterial = null; state.page = 1; state.sort = 'relevance';
          if (self.searchInput) self.searchInput.value = '';
          if (self.matSelect) self.matSelect.value = '';
          if (self.sortSelect) self.sortSelect.value = 'relevance';
          if (self.onFilterChange) self.onFilterChange();
        }
      });
      tb.appendChild(clearBtn);
      root.appendChild(tb);

      this.el = tb; this.matSelect = matSelect; this.sortSelect = sortSelect;
      this.searchInput = searchBox.querySelector('input');
      const searchBtn = searchBox.querySelector('button');

      const doSearch = debounce(() => {
        state.search = self.searchInput.value;
        state.page = 1;
        if (self.onSearchChange) self.onSearchChange();
      }, 150);

      this.searchInput.addEventListener('input', doSearch);
      this.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
      if (searchBtn) searchBtn.addEventListener('click', doSearch);
      matSelect.addEventListener('change', () => { state.currentMaterial = matSelect.value || null; state.page = 1; if (self.onFilterChange) self.onFilterChange(); });
      sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; state.page = 1; if (self.onFilterChange) self.onFilterChange(); });

      if (state.sort) sortSelect.value = state.sort;
      if (state.search) this.searchInput.value = state.search;
    },
    updateMaterials(mats) {
      if (!this.matSelect) return;
      const cur = this.matSelect.value;
      this.matSelect.innerHTML = '';
      const totalMat = Array.isArray(mats) ? mats.length : 0;
      this.matSelect.appendChild(el('option', { value: '', text: '全部分类 (' + fmt(totalMat) + ')' }));
      if (Array.isArray(mats)) {
        mats.forEach((m) => {
          const name = typeof m === 'string' ? m : m.material;
          const count = typeof m === 'object' && m.shops !== undefined ? m.shops : 0;
          this.matSelect.appendChild(el('option', { value: name, text: name + ' (' + fmt(count) + ')' }));
        });
      }
      if (state.currentMaterial) this.matSelect.value = state.currentMaterial;
      else if (cur) this.matSelect.value = cur;
    }
  };
`);

chunks.push(`
  const ShopGrid = {
    el: null, grid: null, moreBtn: null, status: null,
    currentPage: 1, currentTotal: 0, renderedCount: 0, isLoading: false,
    mount(root) {
      if (this.el) return;
      const wrap = el('div', { id: 'shop-results' });
      root.appendChild(wrap);

      const skeletonRow = el('div', { class: 'shop-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '14px' } });
      for (let i = 0; i < 6; i++) skeletonRow.appendChild(el('div', { class: 'skeleton-shop' }));
      const initLoad = el('div', { class: 'loading-indicator', style: { padding: '30px 20px', gap: '16px' } }, [
        skeletonRow, el('div', { class: 'spinner-dual' }),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', letterSpacing: '1px', color: '#374151' } }, [
          el('span', { text: '正在加载商店数据' }),
          el('span', { class: 'pulse-dot' }), el('span', { class: 'pulse-dot' }), el('span', { class: 'pulse-dot' })
        ])
      ]);
      wrap.appendChild(initLoad);

      const grid = el('div', { class: 'shop-grid' });
      wrap.appendChild(grid);
      const status = el('div', { style: { textAlign: 'center', margin: '16px 4px 4px', fontSize: '12px', color: '#6b7280' } });
      wrap.appendChild(status);
      const self = this;
      const moreBtn = el('button', {
        class: 'neo-btn',
        style: { display: 'none', margin: '10px auto 0', padding: '10px 28px', fontSize: '13px' },
        text: '加载更多',
        onclick: () => self._loadMore()
      });
      wrap.appendChild(moreBtn);

      window.addEventListener('scroll', throttle(() => {
        if (self.isLoading) return;
        if (self.renderedCount >= self.currentTotal) return;
        const rect = moreBtn.getBoundingClientRect();
        if (rect.top < window.innerHeight + 200) self._loadMore();
      }, 300), { passive: true });

      this.el = wrap; this.grid = grid; this.moreBtn = moreBtn; this.status = status;
    },
    async reload() {
      this.currentPage = 1; this.renderedCount = 0;
      if (this.grid) this.grid.innerHTML = '';
      if (this.moreBtn) this.moreBtn.style.display = 'none';
      if (this.status) this.status.textContent = '查询中...';
      this._showSkeleton();
      await this._loadPage(1, true);
    },
    _showSkeleton() {
      if (!this.grid) return;
      this.grid.innerHTML = '';
      for (let i = 0; i < 6; i++) this.grid.appendChild(el('div', { class: 'skeleton-shop' }));
    },
    async _loadMore() {
      if (this.isLoading) return;
      if (this.renderedCount >= this.currentTotal) return;
      await this._loadPage(this.currentPage + 1, false);
    },
    async _loadPage(page, replace) {
      this.isLoading = true;
      if (this.moreBtn) this.moreBtn.style.display = 'none';
      try {
        const opts = { page: page, pageSize: state.pageSize, sort: state.sort };
        if (state.currentMaterial) opts.material = state.currentMaterial;
        const data = await QSDB.searchShops(state.search, opts);
        if (!data || !data.success) throw new Error((data && data.error) || '查询失败');
        const results = Array.isArray(data.results) ? data.results : [];
        this.currentTotal = typeof data.total === 'number' ? data.total : results.length;
        if (replace) { this.grid.innerHTML = ''; this.renderedCount = 0; }
        this.currentPage = page;

        const frag = document.createDocumentFragment();
        for (const s of results) { try { frag.appendChild(ShopCard.mount(s)); } catch (e) {} }
        this.grid.appendChild(frag);
        this.renderedCount += results.length;

        if (this.status) {
          if (this.currentTotal === 0) this.status.textContent = '没有符合条件的商店';
          else this.status.textContent = '已显示 ' + fmt(this.renderedCount) + ' / 共 ' + fmt(this.currentTotal) + ' 家';
        }
        if (this.renderedCount < this.currentTotal) {
          this.moreBtn.style.display = 'block';
          this.moreBtn.textContent = '加载更多 (还剩 ' + fmt(this.currentTotal - this.renderedCount) + ')';
        } else {
          this.moreBtn.style.display = 'none';
        }
      } catch (err) {
        if (replace && this.grid) this.grid.innerHTML = '';
        if (this.status) this.status.textContent = '加载失败: ' + (err.message || '未知错误');
        if (this.moreBtn) { this.moreBtn.style.display = 'block'; this.moreBtn.textContent = '重试'; }
      } finally {
        this.isLoading = false;
      }
    }
  };
`);

chunks.push(`
  const Nav = {
    el: null,
    mount(root) { if (this.el) return; this.el = root; },
    render() {
      if (!this.el) return;
      const tabs = [
        { key: 'home', label: '首页', hint: '快速浏览' },
        { key: 'shops', label: '商店浏览', hint: '分页查看' },
        { key: 'admin', label: '数据管理', hint: '生成 / 清空' },
        { key: 'data', label: '导入导出', hint: 'JSON / CSV' }
      ];
      this.el.innerHTML = '';
      tabs.forEach((t) => {
        const btn = el('div', {
          class: 'nav-item' + (state.currentTab === t.key ? ' active' : ''),
          'data-tab': t.key,
          onclick: () => switchTab(t.key)
        }, [
          el('div', { class: 'nav-label', text: t.label }),
          el('div', { class: 'nav-hint', text: t.hint })
        ]);
        this.el.appendChild(btn);
      });

      const status = el('div', { class: 'server-panel', style: { marginTop: '10px', padding: '12px 16px', background: '#f3f4f6', borderRadius: '8px', border: '1px solid #e5e7eb' } }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#374151', fontWeight: '600' } }, [
          el('span', { id: 'server-dot', style: { width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 1.4s infinite' } }),
          el('span', { id: 'server-online', text: '服务器运行中' })
        ]),
        el('div', { id: 'server-info', style: { marginTop: '6px', fontSize: '11px', color: '#6b7280', letterSpacing: '0.2px' }, text: 'QshopWebUI v4.0' })
      ]);
      this.el.appendChild(status);
    },
    highlight(tab) {
      if (!this.el) return;
      $$('.nav-item', this.el).forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
    }
  };

  const Tabs = {
    home: null, shops: null, admin: null, data: null,
    mount(root) {
      this.home = el('div', { class: 'tab-panel', 'data-tab': 'home', style: { display: 'none' } });
      this.shops = el('div', { class: 'tab-panel', 'data-tab': 'shops', style: { display: 'none' } });
      this.admin = el('div', { class: 'tab-panel', 'data-tab': 'admin', style: { display: 'none' } });
      this.data = el('div', { class: 'tab-panel', 'data-tab': 'data', style: { display: 'none' } });
      root.appendChild(this.home); root.appendChild(this.shops); root.appendChild(this.admin); root.appendChild(this.data);
    },
    show(tab) {
      ['home', 'shops', 'admin', 'data'].forEach((t) => {
        if (!this[t]) return;
        this[t].style.display = (t === tab) ? '' : 'none';
      });
    }
  };
`);

chunks.push(`
  let homeInitialized = false;
  async function initHome() {
    if (homeInitialized) return;
    homeInitialized = true;
    const root = Tabs.home;
    try {
      StatsPanel.mount(root);
      Toolbar.mount(root, {
        onSearchChange: () => ShopGrid.reload(),
        onFilterChange: () => ShopGrid.reload()
      });
      ShopGrid.mount(root);

      const [dbStats, matList] = await Promise.all([
        QSDB.getStats().catch(() => ({ total_shops: 0, selling_shops: 0, buying_shops: 0 })),
        QSDB.getMaterials().catch(() => [])
      ]);
      StatsPanel.update(dbStats, Array.isArray(matList) ? matList.length : 0);
      Toolbar.updateMaterials(matList);
      ShopGrid.reload();
    } catch (err) {
      console.error('initHome fail:', err);
      root.appendChild(el('div', { class: 'empty-state' }, [
        el('strong', { text: '初始化失败' }),
        el('p', { text: err.message || '请检查后端服务是否正常' })
      ]));
    }
  }

  let shopsInitialized = false;
  async function initShops() {
    if (shopsInitialized) return;
    shopsInitialized = true;
    const root = Tabs.shops;
    const localToolbar = el('div', { class: 'toolbar' });
    root.appendChild(localToolbar);
    const localInput = el('input', { type: 'text', placeholder: '在商店浏览中搜索...', style: { flex: '2', minWidth: '280px', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px' } });
    const localMat = el('select', { class: 'filter-select' });
    const localSort = el('select', { class: 'filter-select' });
    [['relevance', '默认'], ['price_asc', '价格低→高'], ['price_desc', '价格高→低'], ['owner', '店主A-Z'], ['newest', '最新']].forEach(([val, label]) => {
      localSort.appendChild(el('option', { value: val, text: label }));
    });
    localToolbar.appendChild(localInput);
    localToolbar.appendChild(localMat);
    localToolbar.appendChild(localSort);

    const grid = el('div', { class: 'shop-grid' });
    root.appendChild(grid);
    const info = el('div', { style: { textAlign: 'center', margin: '14px', fontSize: '12px', color: '#6b7280' }, text: '滚动到底部加载更多' });
    root.appendChild(info);

    try {
      const mats = await QSDB.getMaterials();
      localMat.innerHTML = '';
      localMat.appendChild(el('option', { value: '', text: '全部物品 (' + fmt(Array.isArray(mats) ? mats.length : 0) + ')' }));
      if (Array.isArray(mats)) mats.forEach((m) => { const name = typeof m === 'string' ? m : m.material; localMat.appendChild(el('option', { value: name, text: name })); });
    } catch (e) {}

    let p = 1, total = 0, rendered = 0, loading = false;
    const doLoad = async (reset) => {
      if (loading) return;
      loading = true;
      if (reset) { grid.innerHTML = ''; p = 1; rendered = 0; }
      const frag = document.createDocumentFragment();
      try {
        const opts = { page: p, pageSize: state.pageSize, sort: localSort.value };
        if (localMat.value) opts.material = localMat.value;
        const data = await QSDB.searchShops(localInput.value, opts);
        const results = (data && data.success && Array.isArray(data.results)) ? data.results : [];
        total = (data && typeof data.total === 'number') ? data.total : results.length;
        results.forEach((s) => frag.appendChild(ShopCard.mount(s)));
        grid.appendChild(frag);
        rendered += results.length;
        info.textContent = '显示 ' + fmt(rendered) + ' / 共 ' + fmt(total) + ' 条';
        p++;
      } catch (err) { info.textContent = '加载失败: ' + (err.message || '未知错误'); }
      finally { loading = false; }
    };

    const doSearch = debounce(() => { rendered = 0; p = 1; doLoad(true); }, 200);
    localInput.addEventListener('input', doSearch);
    localMat.addEventListener('change', () => { rendered = 0; p = 1; doLoad(true); });
    localSort.addEventListener('change', () => { rendered = 0; p = 1; doLoad(true); });
    window.addEventListener('scroll', throttle(() => {
      if (root.style.display === 'none') return;
      if (loading || rendered >= total) return;
      const rect = grid.getBoundingClientRect();
      if (rect.bottom < window.innerHeight + 200) doLoad(false);
    }, 350), { passive: true });
    doLoad(true);
  }
`);

chunks.push(`
  let adminInitialized = false;
  async function initAdmin() {
    if (adminInitialized) return;
    adminInitialized = true;
    const root = Tabs.admin;

    const loginCard = el('div', { class: 'shop-card', style: { padding: '20px', marginBottom: '20px' } }, [
      el('h3', { style: { margin: '0 0 12px', fontSize: '16px' }, text: '管理员登录' }),
      el('p', { style: { fontSize: '12px', color: '#6b7280', margin: '0 0 14px' }, text: '默认口令在 server.js 中配置 (环境变量 QSHOP_ADMIN_PASSWORD)' })
    ]);
    const userInput = el('input', { type: 'text', placeholder: '用户名', style: { marginRight: '10px', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px' } });
    const passInput = el('input', { type: 'password', placeholder: '密码', style: { marginRight: '10px', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px' } });
    const loginBtn = el('button', { class: 'neo-btn', text: '登录', style: { padding: '8px 18px' } });
    const loginMsg = el('div', { style: { marginTop: '10px', fontSize: '12px', color: '#6b7280' } });
    loginCard.appendChild(userInput); loginCard.appendChild(passInput); loginCard.appendChild(loginBtn); loginCard.appendChild(loginMsg);
    root.appendChild(loginCard);

    const seedCard = el('div', { class: 'shop-card', style: { padding: '20px', marginBottom: '20px' } }, [el('h3', { style: { margin: '0 0 12px', fontSize: '16px' }, text: '生成测试数据' })]);
    const countSelect = el('select', { class: 'filter-select', style: { marginRight: '10px' } });
    [[100, '100 条'], [1000, '1,000 条'], [10000, '10,000 条'], [50000, '50,000 条'], [100000, '100,000 条'], [500000, '500,000 条'], [1000000, '1,000,000 条']].forEach(([v, t]) => countSelect.appendChild(el('option', { value: String(v), text: t })));
    countSelect.value = '10000';
    const modeSelect = el('select', { class: 'filter-select', style: { marginRight: '10px' } });
    modeSelect.appendChild(el('option', { value: 'append', text: '追加' }));
    modeSelect.appendChild(el('option', { value: 'replace', text: '替换（清空后生成）' }));
    const seedBtn = el('button', { class: 'neo-btn', text: '生成', style: { padding: '8px 18px' } });
    const seedProgress = el('div', { style: { marginTop: '14px', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', opacity: 0 } });
    const seedBar = el('div', { style: { height: '100%', width: '0%', background: 'linear-gradient(90deg, #8b5cf6, #3b82f6, #06b6d4)', transition: 'width 200ms' } });
    seedProgress.appendChild(seedBar);
    const seedMsg = el('div', { style: { marginTop: '10px', fontSize: '12px', color: '#6b7280' } });
    seedCard.appendChild(countSelect); seedCard.appendChild(modeSelect); seedCard.appendChild(seedBtn); seedCard.appendChild(seedProgress); seedCard.appendChild(seedMsg);
    root.appendChild(seedCard);

    const clearBtn = el('button', {
      class: 'neo-btn', style: { padding: '10px 22px', background: '#fef2f2', color: '#dc2626', border: '2px solid #fecaca', margin: '10px 0' },
      text: '清空所有数据'
    });
    root.appendChild(clearBtn);
    const clearMsg = el('div', { style: { marginTop: '6px', fontSize: '12px', color: '#6b7280' } });
    root.appendChild(clearMsg);

    loginBtn.addEventListener('click', async () => {
      try {
        const r = await QSDB.login(userInput.value || 'admin', passInput.value || '');
        if (r && r.success) { loginMsg.textContent = '登录成功 (角色: ' + (r.role || 'admin') + ')'; loginMsg.style.color = '#10b981'; state.isAdmin = true; }
        else { loginMsg.textContent = (r && r.error) || '登录失败'; loginMsg.style.color = '#dc2626'; }
      } catch (err) { loginMsg.textContent = err.message; loginMsg.style.color = '#dc2626'; }
    });

    seedBtn.addEventListener('click', async () => {
      const count = parseInt(countSelect.value, 10);
      const mode = modeSelect.value;
      if (seedBtn.dataset.running === '1') return;
      seedBtn.dataset.running = '1'; seedBtn.style.opacity = '0.7';
      seedProgress.style.opacity = '1'; seedBar.style.width = '3%';
      seedMsg.textContent = '正在生成 ' + fmt(count) + ' 条数据，这可能需要一些时间...';

      const pollTimer = setInterval(async () => {
        try {
          const info = await QSDB.seedProgress();
          if (info && typeof info.progress === 'number') {
            seedBar.style.width = Math.max(3, Math.min(99, info.progress)) + '%';
            if (info.inserted !== undefined) seedMsg.textContent = '已生成 ' + fmt(info.inserted) + ' / ' + fmt(count) + ' 条' + (info.elapsed_ms ? ' (耗时 ' + Math.round(info.elapsed_ms / 1000) + 's)' : '');
          }
        } catch (e) {}
      }, 600);

      try {
        const r = await QSDB.seedShops(count, mode);
        clearInterval(pollTimer); seedBar.style.width = '100%';
        if (r && r.success) {
          seedMsg.textContent = '完成: ' + fmt(r.inserted || count) + ' 条已生成，模式: ' + (r.mode || mode) + (r.elapsed_ms ? '，耗时 ' + (r.elapsed_ms / 1000).toFixed(1) + 's' : '');
          seedMsg.style.color = '#10b981';
          try { const s = await QSDB.getStats(); StatsPanel.update(s, undefined); } catch (e) {}
        } else {
          seedMsg.textContent = (r && r.error) || '生成失败'; seedMsg.style.color = '#dc2626';
        }
      } catch (err) { clearInterval(pollTimer); seedMsg.textContent = err.message; seedMsg.style.color = '#dc2626'; }
      finally { seedBtn.dataset.running = '0'; seedBtn.style.opacity = ''; }
    });

    clearBtn.addEventListener('click', async () => {
      if (!confirm('确认清空所有商店数据？此操作不可撤销。')) return;
      try {
        const r = await QSDB.clearAllShops();
        if (r && r.success) { clearMsg.textContent = '已清空 ' + fmt(r.cleared || 0) + ' 条数据'; clearMsg.style.color = '#10b981'; try { const s = await QSDB.getStats(); StatsPanel.update(s, undefined); } catch (e) {} }
        else { clearMsg.textContent = (r && r.error) || '清空失败'; clearMsg.style.color = '#dc2626'; }
      } catch (err) { clearMsg.textContent = err.message; clearMsg.style.color = '#dc2626'; }
    });
  }
`);

chunks.push(`
  let dataInitialized = false;
  async function initDataIO() {
    if (dataInitialized) return;
    dataInitialized = true;
    const root = Tabs.data;

    const exportCard = el('div', { class: 'shop-card', style: { padding: '20px', marginBottom: '20px' } }, [el('h3', { style: { margin: '0 0 12px', fontSize: '16px' }, text: '导出数据' })]);
    const exportBtn = el('button', { class: 'neo-btn', text: '导出为 JSON', style: { padding: '8px 18px', marginRight: '10px' } });
    const exportCsvBtn = el('button', { class: 'neo-btn', text: '导出为 CSV', style: { padding: '8px 18px' } });
    const exportMsg = el('div', { style: { marginTop: '12px', fontSize: '12px', color: '#6b7280' } });
    exportCard.appendChild(exportBtn); exportCard.appendChild(exportCsvBtn); exportCard.appendChild(exportMsg);
    root.appendChild(exportCard);

    const importCard = el('div', { class: 'shop-card', style: { padding: '20px' } }, [
      el('h3', { style: { margin: '0 0 12px', fontSize: '16px' }, text: '导入数据' }),
      el('p', { style: { fontSize: '12px', color: '#6b7280', margin: '0 0 12px' }, text: '支持 JSON / CSV 格式，文件大小建议 < 50MB' })
    ]);
    const fileInput = el('input', { type: 'file', accept: '.json,.csv', style: { marginBottom: '12px' } });
    const importBtn = el('button', { class: 'neo-btn', text: '开始导入', style: { padding: '8px 18px' } });
    const importMsg = el('div', { style: { marginTop: '12px', fontSize: '12px', color: '#6b7280' } });
    importCard.appendChild(fileInput); importCard.appendChild(importBtn); importCard.appendChild(importMsg);
    root.appendChild(importCard);

    exportBtn.addEventListener('click', async () => {
      try {
        exportMsg.textContent = '正在导出 (读取全部数据)...';
        const data = await QSDB.exportShops();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'qshop_export_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        exportMsg.textContent = '已导出 ' + fmt((data && data.shops && data.shops.length) || 0) + ' 家商店';
        exportMsg.style.color = '#10b981';
      } catch (err) { exportMsg.textContent = err.message; exportMsg.style.color = '#dc2626'; }
    });

    exportCsvBtn.addEventListener('click', async () => {
      try {
        exportMsg.textContent = '正在导出 CSV...';
        const data = await QSDB.exportShops();
        const shops = (data && Array.isArray(data.shops)) ? data.shops : [];
        const headers = ['id', 'shop_type', 'owner_name', 'material', 'item_name', 'price', 'stacking_amount', 'world', 'x', 'y', 'z'];
        const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); if (s.indexOf(',') > -1 || s.indexOf('"') > -1 || s.indexOf('\n') > -1) return '"' + s.replace(/"/g, '""') + '"'; return s; };
        const lines = [headers.join(',')];
        shops.forEach((s) => lines.push(headers.map((h) => esc(s[h])).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'qshop_export_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        exportMsg.textContent = '已导出 CSV: ' + fmt(shops.length) + ' 行';
        exportMsg.style.color = '#10b981';
      } catch (err) { exportMsg.textContent = err.message; exportMsg.style.color = '#dc2626'; }
    });

    importBtn.addEventListener('click', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) { importMsg.textContent = '请先选择一个文件'; importMsg.style.color = '#dc2626'; return; }
      importMsg.textContent = '正在解析并导入...';
      try {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsText(file);
        });
        let shops = [];
        if (file.name.toLowerCase().endsWith('.csv')) {
          const rows = text.split(/\\r?\\n/).filter((x) => x.trim());
          if (rows.length < 2) throw new Error('CSV 文件为空或格式错误');
          const parseCsv = (line) => { const out = []; let cur = ''; let inQ = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (inQ) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inQ = false; else cur += c; } else { if (c === ',') { out.push(cur); cur = ''; } else if (c === '"') inQ = true; else cur += c; } } out.push(cur); return out; };
          const headers = parseCsv(rows[0]).map((h) => h.trim());
          for (let i = 1; i < rows.length; i++) {
            const vals = parseCsv(rows[i]);
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = vals[idx]; });
            if (obj.price !== undefined) obj.price = parseFloat(obj.price);
            if (obj.stacking_amount !== undefined) obj.stacking_amount = parseInt(obj.stacking_amount, 10);
            if (obj.x !== undefined) obj.x = parseFloat(obj.x);
            if (obj.y !== undefined) obj.y = parseFloat(obj.y);
            if (obj.z !== undefined) obj.z = parseFloat(obj.z);
            shops.push(obj);
          }
        } else {
          const json = JSON.parse(text);
          shops = Array.isArray(json) ? json : (json && Array.isArray(json.shops)) ? json.shops : [];
        }
        if (!shops.length) throw new Error('没有可导入的数据');
        const r = await QSDB.ingestShops(shops);
        importMsg.textContent = '导入完成: 新增 ' + fmt(r.added) + ' / 更新 ' + fmt(r.updated) + ' / 失败 ' + fmt(r.failed);
        importMsg.style.color = '#10b981';
        try { const s = await QSDB.getStats(); StatsPanel.update(s, undefined); } catch (e) {}
      } catch (err) { importMsg.textContent = err.message; importMsg.style.color = '#dc2626'; }
    });
  }

  function showToast(msg, type) {
    const toast = el('div', {
      style: { position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '12px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', background: type === 'ok' ? '#10b981' : type === 'warn' ? '#f59e0b' : '#3b82f6', color: '#fff', zIndex: 99999, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
      text: msg
    });
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transition = 'opacity 400ms'; toast.style.opacity = '0'; }, 2000);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2600);
  }

  async function switchTab(tab) {
    state.currentTab = tab;
    Nav.highlight(tab);
    Tabs.show(tab);
    try {
      if (tab === 'home') await initHome();
      else if (tab === 'shops') await initShops();
      else if (tab === 'admin') await initAdmin();
      else if (tab === 'data') await initDataIO();
    } catch (err) {
      console.error('switchTab fail:', err);
      const panel = Tabs[tab];
      if (panel) panel.appendChild(el('div', { class: 'empty-state' }, [el('strong', { text: '加载失败' }), el('p', { text: err.message || '未知错误' })]));
    }
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  async function updateServerStatus() {
    try {
      const stats = await QSDB.getStats();
      const online = stats && (stats.total_shops !== undefined || stats.total_requests !== undefined);
      const dot = document.getElementById('server-dot');
      const onlineEl = document.getElementById('server-online');
      const infoEl = document.getElementById('server-info');
      if (dot) dot.style.background = online ? '#10b981' : '#dc2626';
      if (onlineEl) onlineEl.textContent = online ? '服务器运行中' : '服务器已断开';
      if (infoEl) infoEl.textContent = '商店 ' + fmt(stats && stats.total_shops) + ' · 请求 ' + fmt(stats && stats.total_requests) + ' · QshopWebUI v4.0';
    } catch (e) {
      const dot = document.getElementById('server-dot');
      if (dot) dot.style.background = '#dc2626';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) { Nav.mount(sidebar); Nav.render(); }
    const contentArea = document.getElementById('content-area');
    if (contentArea) Tabs.mount(contentArea);
    setInterval(updateServerStatus, 6000);
    try { await switchTab('home'); }
    catch (err) {
      console.error('首页初始化失败:', err);
      if (contentArea) contentArea.appendChild(el('div', { class: 'empty-state' }, [
        el('strong', { text: '启动失败' }),
        el('p', { text: err.message || '请刷新页面或检查后端服务' })
      ]));
    }
  });

  global.QS_APP = { switchTab: switchTab, showToast: showToast, getState: () => state };
})(typeof window !== 'undefined' ? window : this);
`);

// 合并并写入
fs.mkdirSync(path.join(__dirname, 'js'), { recursive: true });
const finalContent = chunks.join('\n');
fs.writeFileSync(out, finalContent, 'utf8');
console.log('OK: app.js written — ' + chunks.length + ' chunks, ' + finalContent.length + ' bytes');
