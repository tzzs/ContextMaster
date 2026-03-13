import '../api/bridge';
import { t, changeLanguage, getCurrentLanguage, type SupportedLanguage } from '../i18n';
import { getThemeManager, type ThemeMode } from '../utils/themeManager';
import { getSettingsStore } from '../utils/settingsStore';

// 是否已经初始化的标记
let isSettingsInitialized = false;

// 初始化设置页面
export async function initSettings(): Promise<void> {
  // 显示管理员状态
  await updateAdminStatus();

  // 初始化外观设置（每次都初始化，确保事件监听器正确绑定）
  initAppearanceSettings();
}

// 更新管理员状态
async function updateAdminStatus(): Promise<void> {
  const adminResult = await window.api.isAdmin();
  const adminStatus = document.getElementById('adminStatus');
  if (adminStatus) {
    if (adminResult.success && adminResult.data) {
      adminStatus.textContent = '已获取管理员权限';
      adminStatus.style.color = 'var(--success)';
    } else {
      adminStatus.textContent = '未以管理员身份运行';
      adminStatus.style.color = 'var(--danger)';
    }
  }
}

// 初始化外观设置（主题和语言）
function initAppearanceSettings(): void {
  // 主题设置
  const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement | null;
  if (themeSelect) {
    const themeManager = getThemeManager();
    
    // 设置当前值
    themeSelect.value = themeManager.getTheme();
    
    // 使用 onclick 而不是 addEventListener 来避免重复绑定
    themeSelect.onchange = () => {
      const mode = themeSelect.value as ThemeMode;
      console.log('主题切换到:', mode);
      themeManager.setTheme(mode);
      getSettingsStore().setSetting('theme', mode);
      
      // 立即应用主题，不等待外部通知
      document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
    };
  }

  // 语言设置
  const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement | null;
  if (languageSelect) {
    // 设置当前值
    languageSelect.value = getCurrentLanguage();
    
    // 使用 onclick 而不是 addEventListener 来避免重复绑定
    languageSelect.onchange = () => {
      const lang = languageSelect.value as SupportedLanguage;
      console.log('语言切换到:', lang);
      
      // 保存语言设置
      getSettingsStore().setSetting('language', lang);
      
      // 切换语言并刷新页面
      changeLanguage(lang).then(() => {
        console.log('语言切换成功，准备刷新页面');
        // 使用延迟确保设置已保存
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }).catch((error) => {
        console.error('语言切换失败:', error);
        alert('语言切换失败，请重试');
      });
    };
  }
}

// 以管理员身份重启
export async function requestAdminRestart(): Promise<void> {
  if (!confirm('确定要以管理员身份重启应用吗？')) return;
  await window.api.restartAsAdmin();
}

// 切换开关状态
export function toggleSwitch(btn: HTMLElement): void {
  btn.classList.toggle('on');
  btn.classList.toggle('off');
}

// 打开日志目录
export async function openLogDir(): Promise<void> {
  const result = await window.api.openLogDir();
  if (!result.success) alert(`打开日志目录失败: ${result.error}`);
}

// 导出 API 供 HTML 调用
const settingsPageApi = { 
  requestAdminRestart, 
  toggleSwitch, 
  openLogDir 
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)._settingsPage = settingsPageApi;
