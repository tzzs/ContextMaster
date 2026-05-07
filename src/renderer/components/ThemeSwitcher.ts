import type { ThemeMode } from '../utils/themeManager';
import { getThemeManager } from '../utils/themeManager';
import { t } from '../i18n';

export interface ThemeSwitcherOptions {
  onChange?: (mode: ThemeMode) => void;
}

export function createThemeSwitcher(container: HTMLElement, options: ThemeSwitcherOptions = {}): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'native-select';
  select.style.minWidth = '140px';

  const modes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: t('settings.appearance.themeSystem') },
    { value: 'light', label: t('settings.appearance.themeLight') },
    { value: 'dark', label: t('settings.appearance.themeDark') },
  ];

  modes.forEach(mode => {
    const option = document.createElement('option');
    option.value = mode.value;
    option.textContent = mode.label;
    select.appendChild(option);
  });

  // Set current value
  const themeManager = getThemeManager();
  select.value = themeManager.getTheme();

  // Listen for changes
  select.addEventListener('change', () => {
    const mode = select.value as ThemeMode;
    themeManager.setTheme(mode);
    options.onChange?.(mode);
  });

  // Listen for external changes
  themeManager.onThemeChange((mode) => {
    select.value = mode;
  });

  container.appendChild(select);
  return select;
}

export function createThemeSelectorButton(container: HTMLElement, options: ThemeSwitcherOptions = {}): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'theme-selector';
  wrapper.style.display = 'flex';
  wrapper.style.gap = '8px';
  wrapper.style.alignItems = 'center';

  const themeManager = getThemeManager();

  const modes: { value: ThemeMode; icon: string; label: string }[] = [
    { value: 'system', icon: '💻', label: t('settings.appearance.themeSystem') },
    { value: 'light', icon: '☀️', label: t('settings.appearance.themeLight') },
    { value: 'dark', icon: '🌙', label: t('settings.appearance.themeDark') },
  ];

  const buttons = new Map<ThemeMode, HTMLButtonElement>();

  modes.forEach(mode => {
    const btn = document.createElement('button');
    btn.className = 'theme-btn';
    btn.title = mode.label;
    btn.innerHTML = mode.icon;
    btn.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--surface);
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `;

    btn.addEventListener('click', () => {
      themeManager.setTheme(mode.value);
      options.onChange?.(mode.value);
    });

    btn.addEventListener('mouseenter', () => {
      if (themeManager.getTheme() !== mode.value) {
        btn.style.background = 'var(--surface2)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (themeManager.getTheme() !== mode.value) {
        btn.style.background = 'var(--surface)';
      }
    });

    buttons.set(mode.value, btn);
    wrapper.appendChild(btn);
  });

  // Update button states
  const updateButtons = (currentMode: ThemeMode) => {
    buttons.forEach((btn, mode) => {
      if (mode === currentMode) {
        btn.style.background = 'var(--accent)';
        btn.style.borderColor = 'var(--accent)';
      } else {
        btn.style.background = 'var(--surface)';
        btn.style.borderColor = 'var(--border)';
      }
    });
  };

  // Initial state
  updateButtons(themeManager.getTheme());

  // Listen for changes
  themeManager.onThemeChange((mode) => {
    updateButtons(mode);
  });

  container.appendChild(wrapper);
  return wrapper;
}
