import type { SupportedLanguage } from '../i18n';

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  language: SupportedLanguage;
}

const SETTINGS_KEY = 'contextmaster_settings';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'zh-CN',
};

class SettingsStore {
  private settings: AppSettings;
  private listeners: Set<(settings: AppSettings) => void> = new Set();

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
      }
    } catch {
      // localStorage not available
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // localStorage not available
    }
  }

  private notifyListeners(): void {
    const settings = { ...this.settings };
    this.listeners.forEach((listener) => {
      listener(settings);
    });
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    if (this.settings[key] === value) return;
    this.settings[key] = value;
    this.saveSettings();
    this.notifyListeners();
  }

  public onSettingsChange(callback: (settings: AppSettings) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    this.notifyListeners();
  }
}

let settingsStoreInstance: SettingsStore | null = null;

export function getSettingsStore(): SettingsStore {
  if (!settingsStoreInstance) {
    settingsStoreInstance = new SettingsStore();
  }
  return settingsStoreInstance;
}

export { SettingsStore, DEFAULT_SETTINGS };
