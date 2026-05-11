import '../api/bridge';
import { t, changeLanguage, getCurrentLanguage, registerRefreshCallback, type SupportedLanguage } from '../i18n';
import { getThemeManager, type ThemeMode } from '../utils/themeManager';
import { getSettingsStore } from '../utils/settingsStore';
import { debug } from '../utils/debug';

let isSettingsInitialized = false;

export async function initSettings(): Promise<void> {
  await updateAdminStatus();
  initAppearanceSettings();
  initSecuritySettings();
  void initMenuStyleSettings();
}

async function initMenuStyleSettings(): Promise<void> {
  const currentEl = document.getElementById('menuStyleCurrent');
  const btnClassic = document.getElementById('btnSetClassic') as HTMLButtonElement | null;
  const btnWin11 = document.getElementById('btnSetWin11') as HTMLButtonElement | null;
  const result = await window.api.getMenuStyle();
  if (!result.success) {
    if (currentEl) currentEl.textContent = '检测失败';
    return;
  }
  const { menuStyle, osVersion, buildNumber } = result.data;
  const label = menuStyle === 'win11-new'
    ? 'Win11 新版菜单（精简）'
    : osVersion === 'win11' ? 'Win10 经典菜单（已切回经典样式）' : 'Win10 经典菜单';
  if (currentEl) currentEl.textContent = `${label} · build ${buildNumber}`;

  // 非 Win11 系统：禁用切换按钮
  if (osVersion !== 'win11') {
    if (btnClassic) { btnClassic.disabled = true; btnClassic.style.opacity = '0.4'; btnClassic.style.cursor = 'not-allowed'; }
    if (btnWin11) { btnWin11.disabled = true; btnWin11.style.opacity = '0.4'; btnWin11.style.cursor = 'not-allowed'; }
    return;
  }
  // 当前样式按钮置灰
  if (menuStyle === 'classic' && btnClassic) { btnClassic.disabled = true; btnClassic.style.opacity = '0.4'; }
  if (menuStyle === 'win11-new' && btnWin11) { btnWin11.disabled = true; btnWin11.style.opacity = '0.4'; }
}

export async function switchMenuStyle(target: 'classic' | 'win11-new'): Promise<void> {
  const label = target === 'classic' ? 'Win10 经典菜单' : 'Win11 新版菜单';
  if (!confirm(`确定要切换到「${label}」？\n\n这将重启资源管理器进程（explorer.exe），所有打开的文件资源管理器窗口会被关闭。\n\n桌面/任务栏会短暂消失后自动恢复。`)) return;
  const result = await window.api.setMenuStyle(target);
  if (!result.success) {
    alert(`切换失败: ${result.error}`);
    return;
  }
  alert(`已切换到「${label}」。如果资源管理器没有自动恢复，请手动按 Win+E 启动。`);
  // 重新初始化样式显示
  await initMenuStyleSettings();
}

function initSecuritySettings(): void {
  const store = getSettingsStore();
  const showDangerous = store.getSettings().showDangerousItems;
  const toggle = document.getElementById('showDangerousToggle');
  if (toggle) {
    toggle.classList.toggle('on', showDangerous);
    toggle.classList.toggle('off', !showDangerous);
  }
}

export function toggleShowDangerous(btn: HTMLElement): void {
  const store = getSettingsStore();
  const newState = !store.getSettings().showDangerousItems;
  btn.classList.toggle('on', newState);
  btn.classList.toggle('off', !newState);
  store.setSetting('showDangerousItems', newState);
  // 通知 mainPage 立即刷新当前列表
  window.dispatchEvent(new CustomEvent('cm:show-dangerous-changed', { detail: newState }));
}

async function updateAdminStatus(): Promise<void> {
  const adminResult = await window.api.isAdmin();
  const adminStatus = document.getElementById('adminStatus');
  if (adminStatus) {
    if (adminResult.success && adminResult.data) {
      adminStatus.textContent = t('settings.permission.adminGranted');
      adminStatus.style.color = 'var(--success)';
    } else {
      adminStatus.textContent = t('settings.permission.adminNotGranted');
      adminStatus.style.color = 'var(--danger)';
    }
  }
}

registerRefreshCallback(updateAdminStatus);

function initAppearanceSettings(): void {
  const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement | null;
  if (themeSelect) {
    const themeManager = getThemeManager();
    
    themeSelect.value = themeManager.getTheme();
    
    themeSelect.onchange = () => {
      const mode = themeSelect.value as ThemeMode;
      debug.log('主题切换到:', mode);
      themeManager.setTheme(mode);
      getSettingsStore().setSetting('theme', mode);
      
      document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
    };
  }

  const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement | null;
  if (languageSelect) {
    languageSelect.value = getCurrentLanguage();
    
    languageSelect.onchange = () => {
      const lang = languageSelect.value as SupportedLanguage;
      debug.log('语言切换到:', lang);
      
      getSettingsStore().setSetting('language', lang);
      
      changeLanguage(lang).then(() => {
        debug.log('语言切换成功');
      }).catch((error) => {
        debug.error('语言切换失败:', error);
        alert('语言切换失败，请重试');
      });
    };
  }
}

export async function requestAdminRestart(): Promise<void> {
  if (!confirm('确定要以管理员身份重启应用吗？')) return;
  await window.api.restartAsAdmin();
}

export function toggleSwitch(btn: HTMLElement): void {
  btn.classList.toggle('on');
  btn.classList.toggle('off');
}

export async function openLogDir(): Promise<void> {
  const result = await window.api.openLogDir();
  if (!result.success) alert(`打开日志目录失败: ${result.error}`);
}

export async function runDiagnose(): Promise<void> {
  const el = document.getElementById('diagnoseResult');
  if (el) el.textContent = '诊断中...';

  const result = await window.api.diagnose();
  const text = result.success
    ? JSON.stringify(result.data, null, 2)
    : `IPC 失败: ${result.error}`;

  if (el) el.textContent = text;
  console.log('[Diagnose]', text);
}

const settingsPageApi = {
  requestAdminRestart,
  toggleSwitch,
  toggleShowDangerous,
  switchMenuStyle,
  openLogDir,
  runDiagnose,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)._settingsPage = settingsPageApi;
