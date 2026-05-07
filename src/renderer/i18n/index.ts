import i18next, { type TFunction } from 'i18next';
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

const resources = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

type RefreshCallback = () => void;
const refreshCallbacks: Set<RefreshCallback> = new Set();

export function registerRefreshCallback(callback: RefreshCallback): () => void {
  refreshCallbacks.add(callback);
  return () => refreshCallbacks.delete(callback);
}

function triggerRefresh(): void {
  updatePageTranslations();
  refreshCallbacks.forEach((cb) => cb());
}

export function initI18n(lng: SupportedLanguage = 'zh-CN'): Promise<TFunction<'translation', undefined>> {
  return i18next.init({
    lng,
    fallbackLng: 'zh-CN',
    resources,
    interpolation: {
      escapeValue: false,
    },
  });
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options);
}

export function changeLanguage(lng: SupportedLanguage): Promise<TFunction<'translation', undefined>> {
  const result = i18next.changeLanguage(lng);
  result.then(() => triggerRefresh());
  return result;
}

export function getCurrentLanguage(): SupportedLanguage {
  return (i18next.language as SupportedLanguage) || 'zh-CN';
}

export function onLanguageChanged(callback: (lng: SupportedLanguage) => void): () => void {
  const handler = (lng: string) => callback(lng as SupportedLanguage);
  i18next.on('languageChanged', handler);
  return () => i18next.off('languageChanged', handler);
}

export function updatePageTranslations(): void {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && el instanceof HTMLInputElement) {
      el.placeholder = t(key);
    }
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key && el instanceof HTMLElement) {
      el.title = t(key);
    }
  });
}

export { i18next };
