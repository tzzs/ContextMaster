import '../api/bridge';
import { t, changeLanguage, getCurrentLanguage, registerRefreshCallback, type SupportedLanguage } from '../i18n';
import { getThemeManager, type ThemeMode } from '../utils/themeManager';
import { getSettingsStore } from '../utils/settingsStore';

let isSettingsInitialized = false;

export async function initSettings(): Promise<void> {
  await updateAdminStatus();
  initAppearanceSettings();
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
      console.log('主题切换到:', mode);
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
      console.log('语言切换到:', lang);
      
      getSettingsStore().setSetting('language', lang);
      
      changeLanguage(lang).then(() => {
        console.log('语言切换成功');
      }).catch((error) => {
        console.error('语言切换失败:', error);
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

const settingsPageApi = { 
  requestAdminRestart, 
  toggleSwitch, 
  openLogDir 
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)._settingsPage = settingsPageApi;
