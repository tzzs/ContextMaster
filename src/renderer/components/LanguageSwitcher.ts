import type { SupportedLanguage } from '../i18n';
import { SUPPORTED_LANGUAGES, changeLanguage, getCurrentLanguage, onLanguageChanged, t } from '../i18n';
import { getSettingsStore } from '../utils/settingsStore';

export interface LanguageSwitcherOptions {
  onChange?: (lang: SupportedLanguage) => void;
}

export function createLanguageSwitcher(container: HTMLElement, options: LanguageSwitcherOptions = {}): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'native-select';
  select.style.minWidth = '140px';

  SUPPORTED_LANGUAGES.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = `${lang.flag} ${lang.name}`;
    select.appendChild(option);
  });

  // Set current value
  select.value = getCurrentLanguage();

  // Listen for changes
  select.addEventListener('change', () => {
    const lang = select.value as SupportedLanguage;
    changeLanguage(lang).then(() => {
      getSettingsStore().setSetting('language', lang);
      options.onChange?.(lang);
    });
  });

  // Listen for external changes
  onLanguageChanged((lang) => {
    select.value = lang;
  });

  container.appendChild(select);
  return select;
}

export function createLanguageSelectorButton(container: HTMLElement, options: LanguageSwitcherOptions = {}): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'language-selector';
  wrapper.style.display = 'flex';
  wrapper.style.gap = '8px';
  wrapper.style.alignItems = 'center';

  const buttons = new Map<SupportedLanguage, HTMLButtonElement>();

  SUPPORTED_LANGUAGES.forEach(lang => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn';
    btn.title = lang.name;
    btn.innerHTML = `${lang.flag} ${lang.name}`;
    btn.style.cssText = `
      height: 32px;
      padding: 0 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--surface);
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      color: var(--text);
    `;

    btn.addEventListener('click', () => {
      changeLanguage(lang.code).then(() => {
        getSettingsStore().setSetting('language', lang.code);
        options.onChange?.(lang.code);
      });
    });

    btn.addEventListener('mouseenter', () => {
      if (getCurrentLanguage() !== lang.code) {
        btn.style.background = 'var(--surface2)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (getCurrentLanguage() !== lang.code) {
        btn.style.background = 'var(--surface)';
      }
    });

    buttons.set(lang.code, btn);
    wrapper.appendChild(btn);
  });

  // Update button states
  const updateButtons = (currentLang: SupportedLanguage) => {
    buttons.forEach((btn, lang) => {
      if (lang === currentLang) {
        btn.style.background = 'var(--accent)';
        btn.style.borderColor = 'var(--accent)';
        btn.style.color = '#fff';
      } else {
        btn.style.background = 'var(--surface)';
        btn.style.borderColor = 'var(--border)';
        btn.style.color = 'var(--text)';
      }
    });
  };

  // Initial state
  updateButtons(getCurrentLanguage());

  // Listen for changes
  onLanguageChanged((lang) => {
    updateButtons(lang);
  });

  container.appendChild(wrapper);
  return wrapper;
}

export function createLanguageDropdown(container: HTMLElement, options: LanguageSwitcherOptions = {}): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'lang-dropdown-wrapper';
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === getCurrentLanguage()) || SUPPORTED_LANGUAGES[0];

  const btn = document.createElement('button');
  btn.className = 'lang-dropdown-btn';
  btn.innerHTML = `${currentLang.flag} ${currentLang.name} <span style="margin-left:4px;">▼</span>`;
  btn.style.cssText = `
    height: 32px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
    color: var(--text);
  `;

  const dropdown = document.createElement('div');
  dropdown.className = 'lang-dropdown-menu';
  dropdown.style.cssText = `
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 140px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    z-index: 1000;
    display: none;
    overflow: hidden;
  `;

  SUPPORTED_LANGUAGES.forEach(lang => {
    const item = document.createElement('div');
    item.className = 'lang-dropdown-item';
    item.innerHTML = `${lang.flag} ${lang.name}`;
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
      color: var(--text);
    `;

    item.addEventListener('mouseenter', () => {
      item.style.background = 'var(--surface2)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });

    item.addEventListener('click', () => {
      changeLanguage(lang.code).then(() => {
        getSettingsStore().setSetting('language', lang.code);
        btn.innerHTML = `${lang.flag} ${lang.name} <span style="margin-left:4px;">▼</span>`;
        dropdown.style.display = 'none';
        options.onChange?.(lang.code);
      });
    });

    dropdown.appendChild(item);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
  });

  document.addEventListener('click', () => {
    dropdown.style.display = 'none';
  });

  onLanguageChanged((langCode) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    if (lang) {
      btn.innerHTML = `${lang.flag} ${lang.name} <span style="margin-left:4px;">▼</span>`;
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdown);
  container.appendChild(wrapper);
  return wrapper;
}
