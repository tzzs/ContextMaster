import '../api/bridge';
import type { OperationRecord } from '../../shared/types';
import { OperationType } from '../../shared/enums';

const OP_LABELS: Record<OperationType, string> = {
  [OperationType.Enable]:  '启用',
  [OperationType.Disable]: '禁用',
  [OperationType.Create]:  '新增',
  [OperationType.Delete]:  '删除',
  [OperationType.Update]:  '修改',
  [OperationType.Backup]:  '备份',
  [OperationType.Restore]: '恢复',
};

const OP_CSS_CLASS: Record<OperationType, string> = {
  [OperationType.Enable]:  'enable',
  [OperationType.Disable]: 'disable',
  [OperationType.Create]:  'add',
  [OperationType.Delete]:  'delete',
  [OperationType.Update]:  'add',
  [OperationType.Backup]:  'add',
  [OperationType.Restore]: 'enable',
};

let allRecords: OperationRecord[] = [];
let filterType: string = 'all';

export async function loadHistory(): Promise<void> {
  const listEl = document.getElementById('historyList');
  if (listEl) listEl.innerHTML = `<div class="empty-state"><div>加载中…</div></div>`;

  const result = await window.api.getHistory();
  if (!result.success) {
    if (listEl) listEl.innerHTML = `<div class="empty-state" style="color:var(--danger);">加载失败: ${result.error}</div>`;
    return;
  }

  allRecords = result.data;
  renderHistory();
}

export function renderHistory(filter?: string): void {
  if (filter !== undefined) filterType = filter;
  const listEl = document.getElementById('historyList');
  if (!listEl) return;

  let data = allRecords;
  if (filterType !== 'all') {
    data = data.filter((h) => h.operationType.toLowerCase() === filterType);
  }

  if (!data.length) {
    listEl.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></svg>
      <div>暂无操作记录</div>
    </div>`;
    return;
  }

  listEl.innerHTML = data.map((h) => {
    const label = OP_LABELS[h.operationType] ?? h.operationType;
    const cssClass = OP_CSS_CLASS[h.operationType] ?? 'add';
    const timeStr = formatTime(h.timestamp);
    const canUndo =
      h.operationType === OperationType.Enable ||
      h.operationType === OperationType.Disable;

    return `
    <div class="history-item">
      <span class="h-type ${cssClass}">${label}</span>
      <div class="h-info">
        <div class="h-name">${escapeHtml(h.targetEntryName)}</div>
        <div class="h-detail">${label} · ${escapeHtml(h.registryPath)}</div>
      </div>
      <div class="h-time">${timeStr}</div>
      ${canUndo ? `<button class="h-undo" onclick="window._historyPage.undoRecord(${h.id})">撤销</button>` : ''}
    </div>`;
  }).join('');
}

export async function undoRecord(id: number): Promise<void> {
  const result = await window.api.undoOperation(id);
  if (!result.success) {
    alert(`撤销失败: ${result.error}`);
    return;
  }
  await loadHistory();
  (window as Window & { showUndo?: (msg: string) => void })
    .showUndo?.('撤销成功');
}

export async function clearAllHistory(): Promise<void> {
  if (!confirm('确定清除所有操作记录？')) return;
  await window.api.clearHistory();
  allRecords = [];
  renderHistory();
}

export function filterHistory(mode: string, btn: HTMLElement): void {
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  btn.classList.add('active');
  renderHistory(mode);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const timeStr = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `今天 ${timeStr}`;
    if (diffDays === 1) return `昨天 ${timeStr}`;
    return d.toLocaleDateString('zh-CN') + ' ' + timeStr;
  } catch {
    return iso;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const historyPageApi = { undoRecord, filterHistory, clearAllHistory };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)._historyPage = historyPageApi;
