// 主题管理器
// 支持 system/light/dark 三种模式

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'contextmaster-theme';

class ThemeManager {
  private currentMode: ThemeMode = 'system';
  private mediaQuery: MediaQueryList | null = null;
  private listeners: Array<(mode: ThemeMode, isDark: boolean) => void> = [];

  constructor() {
    this.loadTheme();
    this.setupMediaQuery();
    this.applyTheme();
  }

  private loadTheme(): void {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        this.currentMode = saved;
      }
    } catch {
      // localStorage 不可用
    }
  }

  private saveTheme(): void {
    try {
      localStorage.setItem(THEME_KEY, this.currentMode);
    } catch {
      // localStorage 不可用
    }
  }

  private setupMediaQuery(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', () => {
        if (this.currentMode === 'system') {
          this.applyTheme();
        }
      });
    }
  }

  private applyTheme(): void {
    const isDark = this.isDark();
    
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // 通知所有监听器
    this.listeners.forEach(listener => {
      listener(this.currentMode, isDark);
    });
  }

  public setTheme(mode: ThemeMode): void {
    if (this.currentMode === mode) return;
    
    this.currentMode = mode;
    this.saveTheme();
    this.applyTheme();
  }

  public getTheme(): ThemeMode {
    return this.currentMode;
  }

  public isDark(): boolean {
    if (this.currentMode === 'system') {
      return this.mediaQuery?.matches ?? false;
    }
    return this.currentMode === 'dark';
  }

  public onChange(callback: (mode: ThemeMode, isDark: boolean) => void): () => void {
    this.listeners.push(callback);
    
    // 立即调用一次
    callback(this.currentMode, this.isDark());
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // 别名方法，用于兼容
  public onThemeChange = this.onChange.bind(this);
}

// 全局实例
let themeManager: ThemeManager | null = null;

export function getThemeManager(): ThemeManager {
  if (!themeManager) {
    themeManager = new ThemeManager();
  }
  return themeManager;
}

export function initTheme(): void {
  getThemeManager();
}

export { ThemeManager };
