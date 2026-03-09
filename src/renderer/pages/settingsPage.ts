import '../api/bridge';

export async function initSettings(): Promise<void> {
  // 显示管理员状态
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

export async function requestAdminRestart(): Promise<void> {
  if (!confirm('确定要以管理员身份重启应用吗？')) return;
  await window.api.restartAsAdmin();
}

export function toggleSwitch(btn: HTMLElement): void {
  btn.classList.toggle('on');
  btn.classList.toggle('off');
}

const settingsPageApi = { requestAdminRestart, toggleSwitch };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)._settingsPage = settingsPageApi;
