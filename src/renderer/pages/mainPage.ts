import '../api/bridge';
import { MenuScene, MenuItemType, ItemProtectionLevel } from '../../shared/enums';
import type { MenuItemEntry, ToggleItemParams, SystemMenuStyle } from '../../shared/types';
import { t, registerRefreshCallback } from '../i18n';
import { escapeHtml } from '../utils/html';
import { getSettingsStore } from '../utils/settingsStore';

// ── 分组类型 ──
type GroupKey = 'app' | 'system' | 'dangerous';

function categorizeItem(item: MenuItemEntry): GroupKey {
  if (item.protectionLevel === ItemProtectionLevel.Protected) return 'dangerous';
  if (item.origin === 'system' || item.protectionLevel === ItemProtectionLevel.Warning) return 'system';
  return 'app';
}

// 折叠状态：内存保存，不持久化；默认应用展开，系统/高危折叠
const groupCollapseState: Map<MenuScene, Set<GroupKey>> = new Map();

function getCollapsedSet(scene: MenuScene): Set<GroupKey> {
  let set = groupCollapseState.get(scene);
  if (!set) {
    set = new Set<GroupKey>(['system', 'dangerous']);
    groupCollapseState.set(scene, set);
  }
  return set;
}

interface MainWindow extends Window {
  showUndo?: (msg: string, itemId: number) => void;
  invalidateAllScenesCache?: () => void;
}

export const SCENE_REG_ROOTS: Record<MenuScene, string> = {
  [MenuScene.Desktop]:            'HKEY_CLASSES_ROOT\\DesktopBackground\\Shell',
  [MenuScene.File]:               'HKEY_CLASSES_ROOT\\*\\shell',
  [MenuScene.Folder]:             'HKEY_CLASSES_ROOT\\Directory\\shell',
  [MenuScene.Drive]:              'HKEY_CLASSES_ROOT\\Drive\\shell',
  [MenuScene.DirectoryBackground]:'HKEY_CLASSES_ROOT\\Directory\\Background\\shell',
  [MenuScene.RecycleBin]:         'HKEY_CLASSES_ROOT\\CLSID\\{645FF040-5081-101B-9F08-00AA002F954E}\\shell',
};

export function getSceneName(scene: MenuScene): string {
  const sceneKeys: Record<MenuScene, string> = {
    [MenuScene.Desktop]:            'nav.desktop',
    [MenuScene.File]:               'nav.file',
    [MenuScene.Folder]:             'nav.folder',
    [MenuScene.Drive]:              'nav.drive',
    [MenuScene.DirectoryBackground]:'nav.directoryBackground',
    [MenuScene.RecycleBin]:         'nav.recycleBin',
  };
  return t(sceneKeys[scene]);
}

let currentItems: MenuItemEntry[] = [];
let selectedItemId: number | null = null;
let filterMode: 'all' | 'enabled' | 'disabled' = 'all';
let loadingScene = false;
let currentScene: MenuScene = MenuScene.Desktop;
let pendingScene: MenuScene | null = null;

const RENDERER_CACHE_TTL = 2 * 60 * 1000; // 2 分钟
const rendererCache = new Map<MenuScene, { items: MenuItemEntry[]; timestamp: number }>();

export function refreshCurrentContent(): void {
  renderItems();
  updateSceneHeader(currentScene);
  updateStatusBar(currentScene);
  if (selectedItemId !== null) {
    showDetail(selectedItemId);
  } else {
    resetDetailPanel();
  }
}

registerRefreshCallback(refreshCurrentContent);

export async function loadScene(scene: MenuScene, forceRefresh = false): Promise<void> {
  if (loadingScene) {
    pendingScene = scene;
    // 立即更新 header 和导航高亮，表明请求已被接受
    const titleEl = document.getElementById('sceneTitle');
    if (titleEl) titleEl.innerHTML = `${getSceneName(scene)} <span class="loading-badge">…</span>`;
    return;
  }
  loadingScene = true;
  currentScene = scene;
  pendingScene = null;

  // 检查 Renderer 缓存（stale-while-revalidate）
  if (!forceRefresh) {
    const cached = rendererCache.get(scene);
    if (cached && Date.now() - cached.timestamp < RENDERER_CACHE_TTL) {
      console.debug(`[Renderer] cache hit: ${scene}`);
      currentItems = cached.items;
      selectedItemId = null;
      resetDetailPanel();
      updateSceneHeader(scene);
      renderItems();
      updateStatusBar(scene);
      loadingScene = false;
      // TTL 剩余不足 30s 时后台静默刷新，避免下次切换出现加载状态
      if (Date.now() - cached.timestamp > RENDERER_CACHE_TTL - 30_000) {
        void silentRefreshScene(scene);
      }
      if (pendingScene !== null) {
        const next = pendingScene;
        pendingScene = null;
        await loadScene(next);
      }
      return;
    }
  }

  const listEl = document.getElementById('itemList');
  const loadStart = Date.now();
  // 仅在首次加载（无旧内容可显示）时清空列表显示 loading；
  // 切场景时保留旧场景列表可见，只在标题上标记加载状态，避免用户看到的列表"消失"
  const hasOldContent = currentItems.length > 0 && listEl && !listEl.querySelector('.loading-state');
  if (listEl && !hasOldContent) {
    listEl.innerHTML = `<div class="loading-state">
      <div class="loading-spinner"></div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <span>${t('main.loading')}</span>
        <span id="loadingElapsed" style="font-size:11px;color:var(--text3);">正在扫描注册表…</span>
      </div>
    </div>`;
  }
  // 始终在标题上显示 loading 提示
  const titleEl = document.getElementById('sceneTitle');
  if (titleEl) titleEl.innerHTML = `${getSceneName(scene)} <span class="loading-badge">加载中…</span>`;

  // 进度文本：每秒更新 elapsed 提示
  const elapsedTimer = setInterval(() => {
    const el = document.getElementById('loadingElapsed');
    const elapsed = Math.floor((Date.now() - loadStart) / 1000);
    if (titleEl) {
      titleEl.innerHTML = `${getSceneName(scene)} <span class="loading-badge">加载中 ${elapsed}s…</span>`;
    }
    if (!el) return;
    if (elapsed >= 8) {
      el.textContent = `正在扫描注册表… 已耗时 ${elapsed}s（首次加载较慢，请稍候）`;
    } else if (elapsed >= 3) {
      el.textContent = `正在扫描注册表… 已耗时 ${elapsed}s`;
    }
  }, 1000);

  if (!hasOldContent) {
    selectedItemId = null;
    resetDetailPanel();
  }

  const result = await window.api.getMenuItems(scene);
  clearInterval(elapsedTimer);
  loadingScene = false;

  if (!result.success) {
    showError(`${t('main.loadFailed')}: ${result.error}`);
  } else {
    currentItems = result.data;
    rendererCache.set(scene, { items: result.data, timestamp: Date.now() });
    updateSceneHeader(scene);
    renderItems();
    updateStatusBar(scene);
  }

  // 若加载期间有新的场景请求，执行最新的那个
  if (pendingScene !== null) {
    const next = pendingScene;
    pendingScene = null;
    await loadScene(next);
  }
}

async function silentRefreshScene(scene: MenuScene): Promise<void> {
  const result = await window.api.getMenuItems(scene);
  if (result.success) {
    rendererCache.set(scene, { items: result.data, timestamp: Date.now() });
  }
}

// ── 渲染条目列表（按 origin/protection 三段分组）──
export function renderItems(): void {
  const listEl = document.getElementById('itemList');
  if (!listEl) return;

  let items = currentItems.slice();
  if (filterMode === 'enabled')  items = items.filter((i) => i.isEnabled);
  if (filterMode === 'disabled') items = items.filter((i) => !i.isEnabled);

  const searchEl = document.getElementById('itemSearch') as HTMLInputElement | null;
  const search = searchEl?.value.toLowerCase() ?? '';
  if (search) {
    items = items.filter(
      (i) => i.name.toLowerCase().includes(search) ||
              i.command.toLowerCase().includes(search)
    );
  }

  // 按 origin/protection 分组
  const showDangerous = getSettingsStore().getSettings().showDangerousItems;
  const groups: Record<GroupKey, MenuItemEntry[]> = { app: [], system: [], dangerous: [] };
  for (const item of items) {
    groups[categorizeItem(item)].push(item);
  }
  const dangerousHiddenCount = !showDangerous ? groups.dangerous.length : 0;
  if (!showDangerous) groups.dangerous = [];

  const totalVisible = groups.app.length + groups.system.length + groups.dangerous.length;
  if (!totalVisible && !dangerousHiddenCount) {
    listEl.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></svg>
      <div>${t('main.noItems')}</div>
    </div>`;
    return;
  }

  const collapsed = getCollapsedSet(currentScene);
  const sections: string[] = [];
  const renderSection = (key: GroupKey, title: string, accent: 'app' | 'system' | 'danger') => {
    const list = groups[key];
    if (!list.length) return;
    const isCollapsed = collapsed.has(key);
    const arrow = isCollapsed ? '▸' : '▾';
    const accentClass = accent === 'danger' ? 'group-header-danger' : accent === 'system' ? 'group-header-system' : '';
    sections.push(`<div class="group-header ${accentClass}" data-group="${key}" onclick="window._mainPage.toggleGroup('${key}')">
      <span class="group-arrow">${arrow}</span>
      <span class="group-title">${escapeHtml(title)}</span>
      <span class="group-count">${list.length}</span>
    </div>`);
    if (!isCollapsed) {
      sections.push(...list.map((item) => renderItemCard(item)));
    }
  };

  renderSection('app', t('main.groupApp') ?? '应用菜单', 'app');
  renderSection('system', t('main.groupSystem') ?? '系统菜单', 'system');
  renderSection('dangerous', `${t('main.groupDangerous') ?? '高危系统条目'} ⚠`, 'danger');

  if (dangerousHiddenCount > 0) {
    sections.push(`<div class="dangerous-hidden-hint" onclick="window._mainPage.openSecuritySettings()">
      <svg viewBox="0 0 16 16" style="width:12px;height:12px;fill:var(--text3);flex-shrink:0;"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
      <span>${dangerousHiddenCount} 条高危系统条目已隐藏 · 在设置中开启「显示高危条目」可查看</span>
    </div>`);
  }

  listEl.innerHTML = sections.join('');
}

// 折叠/展开分组
export function toggleGroup(key: GroupKey): void {
  const collapsed = getCollapsedSet(currentScene);
  if (collapsed.has(key)) collapsed.delete(key);
  else collapsed.add(key);
  renderItems();
}

// 跳转到设置页"安全"section
export function openSecuritySettings(): void {
  const navSettings = document.querySelector<HTMLElement>('.nav-item[data-page="settings"]');
  if (navSettings) navSettings.click();
}

function renderItemCard(item: MenuItemEntry, showScene = false): string {
  const isSelected = item.id === selectedItemId;
  const isProtected = item.protectionLevel === ItemProtectionLevel.Protected;
  const typeTag =
    item.type === MenuItemType.Custom
      ? `<span class="tag tag-custom">${t('item.custom')}</span>`
      : item.type === MenuItemType.ShellExt
        ? `<span class="tag tag-shellext">${t('item.shellExt')}</span>`
        : `<span class="tag tag-system">${t('item.system')}</span>`;
  const stateTag = item.isEnabled
    ? `<span class="tag tag-enabled">${t('item.enabled')}</span>`
    : `<span class="tag tag-disabled">${t('item.disabled')}</span>`;
  const extendedTag = item.isExtended ? '<span class="tag tag-extended">Shift</span>' : '';
  const subCmdTag = item.hasSubCommands ? '<span class="tag tag-subcmd">▸</span>' : '';
  const sourceText = showScene
    ? `${getSceneName(item.menuScene)}${item.source ? ' · ' + item.source : ''}`
    : (item.source || t('item.sourceUnknown'));

  const toggleDisabled = isProtected ? ' disabled' : '';
  const toggleTitle = isProtected && item.protectionReason
    ? ` title="${escapeHtml(item.protectionReason)}"`
    : '';

  const fallbackTag = item.nameFromFallback
    ? '<span class="fallback-name-tag" title="无本地化数据，显示为原始键名">（原始键名）</span>'
    : '';

  return `
  <div class="item-card${item.isEnabled ? '' : ' disabled-row'}${isSelected ? ' selected' : ''}${isProtected ? ' protected-row' : ''}"
       onclick="window._mainPage.selectItem(${item.id})">
    <div class="checkbox" onclick="event.stopPropagation()">
      <svg viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/></svg>
    </div>
    <div class="item-icon">📄</div>
    <div class="item-info">
      <div class="item-name">${escapeHtml(item.name)}${fallbackTag}</div>
      <div class="item-cmd">${escapeHtml(item.command || '—')}</div>
      <div class="item-source">${escapeHtml(sourceText)}</div>
    </div>
    <div class="item-meta">
      ${typeTag}
      ${extendedTag}
      ${subCmdTag}
      ${stateTag}
      <button class="toggle-switch ${item.isEnabled ? 'on' : 'off'}"${toggleDisabled}${toggleTitle}
        onclick="event.stopPropagation();window._mainPage.toggleItem(${item.id})">
        <div class="toggle-thumb"></div>
      </button>
    </div>
    <div class="item-actions">
      <button class="icon-btn danger" title="删除" onclick="event.stopPropagation();">
        <svg viewBox="0 0 16 16" style="width:13px;height:13px;fill:currentColor;">
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
          <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3.5v-.5A1.5 1.5 0 0 1 7.5 0h1A1.5 1.5 0 0 1 10 1.5V2H13.5a1 1 0 0 1 1 1z"/>
        </svg>
      </button>
    </div>
  </div>`;
}

// ── 选中条目 ──
export function selectItem(id: number): void {
  selectedItemId = id;
  renderItems();
  showDetail(id);
}

// ── 切换状态 ──
export async function toggleItem(id: number): Promise<void> {
  const item = currentItems.find((i) => i.id === id);
  if (!item) return;

  if (item.protectionLevel === ItemProtectionLevel.Protected) {
    showOperationError(item.protectionReason || '该条目受系统保护，无法修改');
    return;
  }
  if (item.protectionLevel === ItemProtectionLevel.Warning) {
    const action = item.isEnabled ? '禁用' : '启用';
    if (!confirm(`${item.name} 是${item.protectionReason || '系统功能'}，确定要${action}吗？`)) return;
  }

  const params: ToggleItemParams = {
    registryKey: item.registryKey,
    isEnabled: item.isEnabled,
    name: item.name,
    menuScene: item.menuScene,
    type: item.type,
  };

  const result = await window.api.toggleItem(params);
  if (!result.success) {
    showOperationError(`${t('main.operationFailed')}: ${result.error}`);
    return;
  }

  item.isEnabled = result.data.newState;
  if (result.data.newRegistryKey) {
    item.registryKey = result.data.newRegistryKey;
  }
  // toggle 后使该场景的 renderer 缓存失效，确保下次切回时拿到最新状态
  rendererCache.delete(item.menuScene);
  renderItems();
  const action = item.isEnabled ? t('history.operation.enable') : t('history.operation.disable');
  const win = window as MainWindow;
  win.showUndo?.(`${t('main.actionDone')}${action}「${item.name}」`, id);
  win.invalidateAllScenesCache?.();

  updateStatusBarFromCurrent();
  if (selectedItemId === id) showDetail(id);
}

// ── 详情面板 ──
export function showDetail(id: number): void {
  const item = currentItems.find((i) => i.id === id);
  if (!item) return;

  const isShellExt = item.type === MenuItemType.ShellExt;
  // ShellExt: registryKey 已含完整相对路径；禁用时键名以 '-' 开头，需还原实际路径
  // Classic Shell: 从 SCENE_REG_ROOTS 拼接
  const regItemPath = (() => {
    if (isShellExt) {
      const sep    = item.registryKey.lastIndexOf('\\');
      const parent = item.registryKey.substring(0, sep + 1); // 含末尾 '\'
      const name   = item.registryKey.substring(sep + 1);
      const actual = item.isEnabled ? name : `-${name}`;
      return `HKEY_CLASSES_ROOT\\${parent}${actual}`;
    }
    return `${SCENE_REG_ROOTS[item.menuScene]}\\${item.registryKey.split('\\').pop()}`;
  })();
  const regCmdPath = `${regItemPath}\\command`;
  // 在 HTML onclick 属性里，反斜杠会被 JS 当转义前缀消耗，必须双写
  const regItemPathAttr = regItemPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const disabledNoteContent = isShellExt
    ? t('detail.disabledNoteShellExt')
    : t('detail.disabledNote');
  const legacyNote = item.isEnabled ? '' : `
    <div style="display:flex;align-items:flex-start;gap:6px;background:var(--danger-bg);border:1px solid rgba(196,43,28,0.18);border-radius:var(--radius-sm);padding:7px 9px;margin-top:4px;">
      <svg viewBox="0 0 16 16" style="width:12px;height:12px;fill:var(--danger);flex-shrink:0;margin-top:1px;"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
      <span style="font-size:11px;color:var(--danger);line-height:1.5;">${disabledNoteContent}</span>
    </div>`;

  const nameEl = document.getElementById('detailName');
  const subEl = document.getElementById('detailSub');
  const bodyEl = document.getElementById('detailBody');
  const actionsEl = document.getElementById('detailActions');

  if (nameEl) nameEl.textContent = item.name;
  if (subEl) subEl.textContent = item.source || t('item.sourceUnknown');
  if (bodyEl) bodyEl.innerHTML = `
    <div class="detail-field">
      <div class="detail-field-label">${t('item.name')}</div>
      <div class="detail-field-value">${escapeHtml(item.name)}</div>
    </div>
    <div class="detail-field">
      <div class="detail-field-label">${t('item.status')}</div>
      <div class="detail-field-value">
        <span class="tag ${item.isEnabled ? 'tag-enabled' : 'tag-disabled'}">${item.isEnabled ? t('item.enabled') : t('item.disabled')}</span>
      </div>
    </div>
    <div class="detail-field">
      <div class="detail-field-label">${t('item.type')}</div>
      <div class="detail-field-value">
        <span class="tag ${item.type === MenuItemType.Custom ? 'tag-custom' : item.type === MenuItemType.ShellExt ? 'tag-shellext' : 'tag-system'}">${item.type === MenuItemType.Custom ? t('item.custom') : item.type === MenuItemType.ShellExt ? t('item.shellExt') : t('item.system')}</span>
        ${item.isExtended ? '<span class="tag tag-extended" style="margin-left:4px;">Shift+右键</span>' : ''}
        ${item.hasSubCommands ? '<span class="tag tag-subcmd" style="margin-left:4px;">含子菜单</span>' : ''}
      </div>
    </div>
    ${item.origin ? `<div class="detail-field">
      <div class="detail-field-label">来源分类</div>
      <div class="detail-field-value">
        <span class="tag ${item.origin === 'system' ? 'tag-shellext' : 'tag-custom'}">${item.origin === 'system' ? '系统内置' : '第三方应用'}</span>
      </div>
    </div>` : ''}
    ${item.protectionLevel !== ItemProtectionLevel.Normal ? `<div class="detail-field">
      <div class="detail-field-label">保护级别</div>
      <div class="detail-field-value">
        <span class="tag ${item.protectionLevel === ItemProtectionLevel.Protected ? 'tag-disabled' : 'tag-extended'}">${item.protectionLevel === ItemProtectionLevel.Protected ? '受保护' : '需确认'}</span>
        ${item.protectionReason ? `<span style="font-size:11px;color:var(--text3);margin-left:6px;">${escapeHtml(item.protectionReason)}</span>` : ''}
      </div>
    </div>
    ${item.protectionLevel === ItemProtectionLevel.Protected ? `<div style="display:flex;align-items:flex-start;gap:6px;background:var(--danger-bg);border:1px solid rgba(196,43,28,0.18);border-radius:var(--radius-sm);padding:7px 9px;margin-top:4px;">
      <svg viewBox="0 0 16 16" style="width:12px;height:12px;fill:var(--danger);flex-shrink:0;margin-top:1px;"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
      <span style="font-size:11px;color:var(--danger);line-height:1.5;">⚠ 此条目影响资源管理器核心功能，禁用可能导致桌面/资源管理器异常</span>
    </div>` : ''}` : ''}
    <div class="detail-field">
      <div class="detail-field-label">${t('item.source')}</div>
      <div class="detail-field-value">${escapeHtml(item.source || '—')}</div>
    </div>
    <div class="detail-field">
      <div class="detail-field-label">${t('item.command')}</div>
      <div class="detail-field-value mono">${escapeHtml(item.command || '—')}</div>
    </div>
    <div class="detail-field">
      <div class="detail-field-label">${t('item.scene')}</div>
      <div class="detail-field-value">${getSceneName(item.menuScene)}</div>
    </div>

    <div style="height:1px;background:var(--border2);margin:10px 0 12px;"></div>

    <div class="detail-field">
      <div class="detail-field-label">${t('item.registryPath')}</div>
      <div style="position:relative;">
        <div class="detail-field-value mono" style="padding-right:28px;word-break:break-all;line-height:1.6;">${escapeHtml(regItemPath)}</div>
        <button onclick="window.api.copyToClipboard('${regItemPathAttr}').then(() => window._mainPage.flashCopyBtn(this))"
          title="${t('item.copyPath')}"
          style="position:absolute;top:4px;right:4px;width:20px;height:20px;border:none;background:transparent;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;color:var(--text3);">
          <svg viewBox="0 0 16 16" style="width:11px;height:11px;fill:currentColor;"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>
        </button>
      </div>
      ${legacyNote}
    </div>

    ${isShellExt ? `<div class="detail-field">
      <div class="detail-field-label">COM 标识符</div>
      <div class="detail-field-value mono" style="word-break:break-all;line-height:1.6;color:var(--text3);">${escapeHtml(item.command)}</div>
    </div>
    ${item.dllPath ? `<div class="detail-field">
      <div class="detail-field-label">提供程序 DLL</div>
      <div class="detail-field-value mono" style="word-break:break-all;line-height:1.6;color:var(--text3);">${escapeHtml(item.dllPath)}</div>
    </div>` : ''}` : `<div class="detail-field">
      <div class="detail-field-label">命令子键路径</div>
      <div class="detail-field-value mono" style="word-break:break-all;line-height:1.6;color:var(--text3);">${escapeHtml(regCmdPath)}</div>
    </div>`}

    <div class="detail-field">
      <div class="detail-field-label">${t('item.openInRegedit')}</div>
      <button onclick="window.api.openRegedit('${regItemPathAttr}').then(r=>{if(!r.success)alert('${t('item.locateFailed')}: '+r.error);}).catch(e=>alert('${t('main.callFailed')}: '+e))"
        style="display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);font-size:11px;cursor:pointer;color:var(--text2);font-family:inherit;margin-top:2px;">
        <svg viewBox="0 0 16 16" style="width:11px;height:11px;fill:currentColor;"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>
        ${t('item.locateInRegedit')}
      </button>
    </div>
  `;
  if (actionsEl) {
    const isProtected = item.protectionLevel === ItemProtectionLevel.Protected;
    actionsEl.style.display = 'flex';
    const toggleBtn = actionsEl.querySelector('.btn-primary') as HTMLButtonElement | null;
    if (toggleBtn) {
      toggleBtn.disabled = isProtected;
      toggleBtn.title = isProtected ? (item.protectionReason || '受保护条目') : '';
      toggleBtn.style.opacity = isProtected ? '0.4' : '';
      toggleBtn.style.cursor = isProtected ? 'not-allowed' : '';
    }
  }
}

export function flashCopyBtn(btn: HTMLButtonElement): void {
  const orig = btn.innerHTML;
  btn.innerHTML = '<svg viewBox="0 0 16 16" style="width:11px;height:11px;fill:var(--success);"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/></svg>';
  setTimeout(() => { btn.innerHTML = orig; }, 1500);
}

// ── 筛选 ──
export function setFilter(mode: 'all' | 'enabled' | 'disabled', btn: HTMLElement): void {
  filterMode = mode;
  document.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderItems();
}

// ── 状态栏 ──
let cachedMenuStyle: SystemMenuStyle | null = null;

function updateStatusBar(scene: MenuScene): void {
  const sbScene = document.getElementById('sbScene');
  if (sbScene) sbScene.textContent = `${t('statusBar.currentScene')}${getSceneName(scene)}`;
  updateStatusBarFromCurrent();
  if (!cachedMenuStyle) {
    void loadMenuStyleLabel();
  }
}

async function loadMenuStyleLabel(): Promise<void> {
  const result = await window.api.getMenuStyle();
  if (!result.success) return;
  cachedMenuStyle = result.data;
  const el = document.getElementById('sbMenuStyle');
  if (!el) return;
  const label = cachedMenuStyle.menuStyle === 'win11-new'
    ? 'Win11 新版菜单'
    : cachedMenuStyle.osVersion === 'win11'
      ? 'Win11 经典菜单'
      : 'Win10 经典菜单';
  el.textContent = label;
}

function updateStatusBarFromCurrent(): void {
  const enabled = currentItems.filter((i) => i.isEnabled).length;
  const disabled = currentItems.length - enabled;
  const sbCount = document.getElementById('sbCount');
  if (sbCount) sbCount.textContent = `${t('statusBar.enabled')} ${enabled} / ${t('statusBar.disabled')} ${disabled}`;
}

function updateSceneHeader(scene: MenuScene): void {
  const titleEl = document.getElementById('sceneTitle');
  if (titleEl) {
    titleEl.innerHTML = `${getSceneName(scene)} <span>${currentItems.length} ${t('main.items')}</span>`;
  }
  const badgeEl = document.getElementById(`badge-${scene}`);
  if (badgeEl) badgeEl.textContent = String(currentItems.length);
}

function resetDetailPanel(): void {
  const nameEl = document.getElementById('detailName');
  const subEl = document.getElementById('detailSub');
  const bodyEl = document.getElementById('detailBody');
  const actionsEl = document.getElementById('detailActions');
  if (nameEl) nameEl.textContent = t('main.selectItem');
  if (subEl) subEl.textContent = t('main.selectItemDesc');
  if (bodyEl) bodyEl.innerHTML = `<div class="empty-state" style="height:160px;">
    <svg viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></svg>
    <div style="font-size:12px;">${t('main.noItemSelected')}</div>
  </div>`;
  if (actionsEl) actionsEl.style.display = 'none';
}

function showError(msg: string): void {
  const listEl = document.getElementById('itemList');
  if (listEl) listEl.innerHTML = `<div class="empty-state" style="color:var(--danger);">${escapeHtml(msg)}</div>`;
}

function showOperationError(msg: string): void {
  let toast = document.getElementById('opErrorToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'opErrorToast';
    toast.style.cssText = [
      'position:absolute', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
      'background:var(--danger)', 'color:#fff', 'padding:8px 16px',
      'border-radius:var(--radius-sm)', 'font-size:13px', 'z-index:999',
      'box-shadow:0 2px 8px rgba(0,0,0,0.25)', 'pointer-events:none',
      'white-space:nowrap', 'max-width:80%', 'text-overflow:ellipsis', 'overflow:hidden',
    ].join(';');
    const contentArea = document.getElementById('itemList')?.parentElement ?? document.body;
    contentArea.style.position = 'relative';
    contentArea.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.display = 'block';
  toast.style.opacity = '1';

  clearTimeout((toast as HTMLElement & { _hideTimer?: ReturnType<typeof setTimeout> })._hideTimer);
  (toast as HTMLElement & { _hideTimer?: ReturnType<typeof setTimeout> })._hideTimer = setTimeout(() => {
    if (toast) toast.style.display = 'none';
  }, 3000);
}

// ── 从详情面板触发切换 ──
export async function toggleFromDetail(): Promise<void> {
  if (selectedItemId == null) return;
  await toggleItem(selectedItemId);
}

// ── 从详情面板删除（暂无后端支持，提示开发中）──
export function deleteSelected(): void {
  if (selectedItemId == null) return;
  const item = currentItems.find((i) => i.id === selectedItemId);
  if (!item) return;
  alert(`${t('main.deleteDev')}\n\n${t('item.name')}: ${item.name}`);
}

export function renderGlobalResults(items: MenuItemEntry[], query: string): void {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById('page-main')?.classList.add('active');

  const titleEl = document.getElementById('sceneTitle');
  if (titleEl) titleEl.innerHTML = `${t('main.searchResults')} <span>${items.length} ${t('main.matchesFor')}「${escapeHtml(query)}」</span>`;

  selectedItemId = null;
  resetDetailPanel();

  const listEl = document.getElementById('itemList');
  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></svg>
      <div>${t('main.noMatchFor')}「${escapeHtml(query)}」</div>
    </div>`;
    return;
  }

  listEl.innerHTML = items.map((item) => renderItemCard(item, true)).join('');
}

export function restoreSceneTitle(scene: MenuScene): void {
  const titleEl = document.getElementById('sceneTitle');
  if (titleEl) {
    titleEl.innerHTML = `${getSceneName(scene)} <span>${currentItems.length} ${t('main.items')}</span>`;
  }
  renderItems();
  resetDetailPanel();
}

// ── 预加载其余场景的 badge 数量（延迟 + 并发，依赖 PS 信号量自然限流）──
// 延迟 1.2s 启动让首屏 Desktop 渲染完毕，避免争抢 PS 槽位；
// 并发发起所有场景请求，每个完成后立即更新对应 badge
let preloadBadgeCancelled = false;
export async function preloadBadgeCounts(skipScene: MenuScene): Promise<void> {
  preloadBadgeCancelled = false;
  await new Promise(resolve => setTimeout(resolve, 1200));
  if (preloadBadgeCancelled) return;

  const allScenes = Object.values(MenuScene) as MenuScene[];
  const targetScenes = allScenes.filter((scene) => scene !== skipScene);

  await Promise.all(targetScenes.map(async (scene) => {
    if (preloadBadgeCancelled) return;
    const result = await window.api.getMenuItems(scene).catch(() => null);
    if (preloadBadgeCancelled) return;
    const badgeEl = document.getElementById(`badge-${scene}`);
    if (!badgeEl) return;

    if (result && result.success && 'data' in result) {
      badgeEl.textContent = String(result.data.length);
      rendererCache.set(scene, { items: result.data, timestamp: Date.now() });
    } else {
      badgeEl.textContent = '?';
    }
  }));
}

export function cancelBadgePreload(): void {
  preloadBadgeCancelled = true;
}

export function onNavigateAway(): void {
  pendingScene = null;  // 取消挂起的场景切换请求，避免导航离开后触发残留副作用
}

// ── 注入 loading spinner 样式 ──
(function injectSpinnerStyles() {
  if (document.getElementById('_cmSpinnerStyles')) return;
  const style = document.createElement('style');
  style.id = '_cmSpinnerStyles';
  style.textContent = `
.loading-state { display:flex; align-items:center; justify-content:center; height:200px; gap:10px; color:var(--text3); }
.loading-spinner { width:18px; height:18px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:cmSpin 0.7s linear infinite; flex-shrink:0; }
@keyframes cmSpin { to { transform:rotate(360deg); } }
.loading-badge { font-size:11px; color:var(--text3); font-weight:normal; }
  `.trim();
  document.head.appendChild(style);
})();

// 挂载到 window 供 HTML inline onclick 调用
const mainPageApi = { selectItem, toggleItem, setFilter, flashCopyBtn, toggleFromDetail, deleteSelected, toggleGroup, openSecuritySettings };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)._mainPage = mainPageApi;

// 监听"显示高危条目"开关变化，立即刷新当前列表
window.addEventListener('cm:show-dangerous-changed', () => {
  renderItems();
  updateStatusBarFromCurrent();
});
