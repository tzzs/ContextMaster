import './api/bridge';
import './styles/themes.css';
import { MenuScene } from '../shared/enums';
import type { MenuItemEntry } from '../shared/types';
import { loadScene, preloadBadgeCounts, renderGlobalResults, restoreSceneTitle, onNavigateAway } from './pages/mainPage';
import { loadHistory, filterHistory, clearAllHistory } from './pages/historyPage';
import { loadBackups, createBackup, importBackup } from './pages/backupPage';
import { initSettings, requestAdminRestart, toggleSwitch, openLogDir } from './pages/settingsPage';

// i18n 和主题
import { initI18n, t, updatePageTranslations, registerRefreshCallback } from './i18n';
import { initTheme, getThemeManager } from './utils/themeManager';
import { getSettingsStore } from './utils/settingsStore';

// ── 全局搜索 ──
let allScenesCache: Map<MenuScene, MenuItemEntry[]> | null = null;
let globalSearchTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureAllScenesCache(): Promise<Map<MenuScene, MenuItemEntry[]>> {
  if (allScenesCache) return allScenesCache;
  const cache = new Map<MenuScene, MenuItemEntry[]>();
  const scenes = Object.values(MenuScene) as MenuScene[];
  await Promise.all(
    scenes.map(async (scene) => {
      const result = await window.api.getMenuItems(scene);
      if (result.success) cache.set(scene, result.data);
    })
  );
  allScenesCache = cache;
  return cache;
}

async function doGlobalSearch(query: string): Promise<void> {
  if (!query.trim()) {
    restoreSceneTitle(currentScene);
    return;
  }
  const cache = await ensureAllScenesCache();
  const q = query.toLowerCase();
  const matched: MenuItemEntry[] = [];
  for (const items of cache.values()) {
    for (const item of items) {
      if (
        item.name.toLowerCase().includes(q) ||
        item.command.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.registryKey.toLowerCase().includes(q)
      ) {
        matched.push(item);
      }
    }
  }
  renderGlobalResults(matched, query);
}

// ── Undo Bar ──
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let lastUndoRecordId: number | null = null;

function showUndo(msg: string, recordId?: number): void {
  const bar = document.getElementById('undoBar');
  const msgEl = document.getElementById('undoMsg');
  if (!bar || !msgEl) return;
  msgEl.textContent = msg;
  bar.classList.add('show');
  lastUndoRecordId = recordId ?? null;
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 5000);
}

function hideUndo(): void {
  document.getElementById('undoBar')?.classList.remove('show');
}

async function doUndo(): Promise<void> {
  hideUndo();
  if (lastUndoRecordId == null) return;
  const result = await window.api.undoOperation(lastUndoRecordId);
  if (!result.success) alert(`撤销失败: ${result.error}`);
}

// ── 页面切换 ──
type PageId = 'main' | 'history' | 'backup' | 'settings';
let currentPage: PageId = 'main';
let currentScene: MenuScene = MenuScene.Desktop;

async function switchPage(page: PageId, navEl?: HTMLElement, scene?: MenuScene): Promise<void> {
  const searchEl = document.getElementById('globalSearch') as HTMLInputElement | null;
  if (searchEl) searchEl.value = '';

  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));

  if (navEl) navEl.classList.add('active');
  document.getElementById(`page-${page}`)?.classList.add('active');
  currentPage = page;

  if (page === 'main') {
    const s = scene ?? currentScene;
    currentScene = s;
    await loadScene(s);
  } else {
    onNavigateAway();
    if (page === 'history') {
      await loadHistory();
    } else if (page === 'backup') {
      await loadBackups();
    } else if (page === 'settings') {
      await initSettings();
    }
  }
}

// ── 窗口控制 ──
async function updateMaximizeBtn(): Promise<void> {
  const btn = document.getElementById('winMaximize');
  if (!btn) return;
  const isMax = await window.api.isMaximized();
  btn.title = isMax ? t('window.restore') : t('window.maximize');
}

async function checkAdminStatus(): Promise<void> {
  const result = await window.api.isAdmin();
  const isAdmin = result.success && result.data;

  const sbDot = document.getElementById('sbDot') as HTMLElement | null;
  const sbAdmin = document.getElementById('sbAdmin');
  if (sbDot) sbDot.style.background = isAdmin ? '#70D070' : 'rgba(255,255,255,0.4)';
  if (sbAdmin) sbAdmin.textContent = isAdmin ? t('statusBar.adminMode') : t('statusBar.standardMode');
  if (sbAdmin) {
    (sbAdmin as HTMLElement).style.cursor = '';
    (sbAdmin as HTMLElement).onclick = null;
  }
}

function refreshMainContent(): void {
  updateMaximizeBtn();
  checkAdminStatus();
}

function invalidateAllScenesCache(): void {
  allScenesCache = null;
}

// ── 暴露给 HTML inline onclick ──
Object.assign(window, {
  showUndo,
  hideUndo,
  doUndo,
  switchPage,
  updateMaximizeBtn,
  invalidateAllScenesCache,
  // History
  filterHistory: (mode: string, btn: HTMLElement) => filterHistory(mode, btn),
  clearHistory: clearAllHistory,
  // Backup
  createBackup,
  importBackup,
  // Settings
  requestAdminRestart,
  toggleSwitch,
  openLogDir,
});

// ── 初始化 ──
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化 i18n 和主题（从设置中读取）
  const settingsStore = getSettingsStore();
  const settings = settingsStore.getSettings();
  
  // 初始化主题
  initTheme();
  const themeManager = getThemeManager();
  themeManager.setTheme(settings.theme);
  
  // 初始化 i18n
  await initI18n(settings.language);
  
  // 应用页面翻译
  updatePageTranslations();
  
  // 注册语言切换刷新回调
  registerRefreshCallback(refreshMainContent);

  // 管理员检查
  await checkAdminStatus();

  // 全局搜索绑定（300ms 防抖）
  document.getElementById('globalSearch')?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value;
    if (globalSearchTimer) clearTimeout(globalSearchTimer);
    globalSearchTimer = setTimeout(() => doGlobalSearch(query), 300);
  });

  // 默认加载桌面右键场景
  const defaultNav = document.querySelector<HTMLElement>('.nav-item[data-scene="Desktop"]');
  await switchPage('main', defaultNav ?? undefined, MenuScene.Desktop);

  // 后台预加载其余场景的 badge 数量（不阻塞 UI）
  preloadBadgeCounts(MenuScene.Desktop);

  // 窗口最大化状态同步
  window.addEventListener('resize', updateMaximizeBtn);
});
