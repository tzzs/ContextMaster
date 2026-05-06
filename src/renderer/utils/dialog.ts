/** 使用 HTML5 原生 <dialog> 封装的弹窗工具函数，替代 Electron 不支持的 prompt/confirm/alert */

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Dialog element #${id} not found`);
  return el as T;
}

/** 弹出输入框，返回用户输入或 null（取消） */
export function showPrompt(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = getEl<HTMLDialogElement>('cm-prompt-dialog');
    const msgEl = getEl<HTMLElement>('cm-prompt-msg');
    const input = getEl<HTMLInputElement>('cm-prompt-input');
    const okBtn = getEl<HTMLButtonElement>('cm-prompt-ok');
    const cancelBtn = getEl<HTMLButtonElement>('cm-prompt-cancel');

    msgEl.textContent = message;
    input.value = defaultValue;

    const cleanup = () => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.removeEventListener('keydown', onKey);
      dialog.close();
    };

    const onOk = () => { cleanup(); resolve(input.value || null); };
    const onCancel = () => { cleanup(); resolve(null); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onOk(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('keydown', onKey);

    dialog.showModal();
    input.select();
  });
}

/** 弹出确认框，返回 true（确认）或 false（取消） */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = getEl<HTMLDialogElement>('cm-confirm-dialog');
    const msgEl = getEl<HTMLElement>('cm-confirm-msg');
    const okBtn = getEl<HTMLButtonElement>('cm-confirm-ok');
    const cancelBtn = getEl<HTMLButtonElement>('cm-confirm-cancel');

    msgEl.textContent = message;

    const cleanup = () => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.removeEventListener('keydown', onKey);
      dialog.close();
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onOk(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('keydown', onKey);

    dialog.showModal();
  });
}

/** 弹出提示框 */
export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const dialog = getEl<HTMLDialogElement>('cm-alert-dialog');
    const msgEl = getEl<HTMLElement>('cm-alert-msg');
    const okBtn = getEl<HTMLButtonElement>('cm-alert-ok');

    msgEl.textContent = message;

    const cleanup = () => {
      okBtn.removeEventListener('click', onOk);
      dialog.removeEventListener('keydown', onKey);
      dialog.close();
    };

    const onOk = () => { cleanup(); resolve(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onOk(); }
    };

    okBtn.addEventListener('click', onOk);
    dialog.addEventListener('keydown', onKey);

    dialog.showModal();
  });
}
