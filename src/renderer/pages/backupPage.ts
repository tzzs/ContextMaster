import '../api/bridge';
import type { BackupSnapshot } from '../../shared/types';
import { BackupType } from '../../shared/enums';
import { t, registerRefreshCallback } from '../i18n';
import { escapeHtml } from '../utils/html';
import { showAlert, showConfirm, showPrompt } from '../utils/dialog';

let backups: BackupSnapshot[] = [];

export function refreshBackupContent(): void {
  renderBackup();
}

registerRefreshCallback(refreshBackupContent);

export async function loadBackups(): Promise<void> {
  const result = await window.api.getBackups();
  if (!result.success) {
    await showAlert(`${t('backup.loadFailed')}: ${result.error}`);
    return;
  }
  backups = result.data;
  renderBackup();
}

export function renderBackup(): void {
  const grid = document.getElementById('backupGrid');
  if (!grid) return;

  if (!backups.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <svg viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></svg>
      <div>${t('backup.noBackups')}</div>
    </div>`;
    return;
  }

  grid.innerHTML = backups.map((b) => {
    const isAuto = b.type === BackupType.Auto;
    const items = countItems(b.menuItemsJson);
    const sizeKb = Math.round(b.menuItemsJson.length / 1024 * 10) / 10;
    const dateStr = formatDate(b.creationTime);
    const tagStyle = isAuto
      ? 'background:#EFF6FC;color:var(--accent)'
      : 'background:var(--success-bg);color:var(--success)';

    return `
    <div class="backup-card ${b.type.toLowerCase()}">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <div style="flex:1;">
          <div class="backup-name">${escapeHtml(b.name)}</div>
          <div class="backup-date">${dateStr}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px;">SHA256: ${b.sha256Checksum.substring(0, 12)}…</div>
        </div>
        <span class="tag" style="${tagStyle}">${isAuto ? t('backup.auto') : t('backup.manual')}</span>
      </div>
      <div class="backup-stats">
        <div class="backup-stat"><strong>${items}</strong>${t('backup.items')}</div>
        <div class="backup-stat"><strong>${sizeKb}KB</strong>${t('backup.fileSize')}</div>
      </div>
      <div class="backup-actions">
        <button class="btn btn-secondary" style="flex:1;justify-content:center;font-size:12px;"
          onclick="window._backupPage.restoreBackup(${b.id})">${t('backup.restore')}</button>
        <button class="btn btn-secondary" style="flex:1;justify-content:center;font-size:12px;"
          onclick="window._backupPage.exportBackup(${b.id})">${t('backup.export')}</button>
        <button class="icon-btn danger" title="${t('backup.delete')}"
          onclick="window._backupPage.deleteBackup(${b.id})">
          <svg viewBox="0 0 16 16" style="width:12px;height:12px;fill:currentColor;">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3.5v-.5A1.5 1.5 0 0 1 7.5 0h1A1.5 1.5 0 0 1 10 1.5V2H13.5a1 1 0 0 1 1 1z"/>
          </svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

export async function createBackup(): Promise<void> {
  const name = await showPrompt(
    t('backup.enterNote'),
    `${t('backup.manualBackup')} · ${new Date().toLocaleDateString('zh-CN')}`
  );
  if (!name) return;

  const result = await window.api.createBackup(name);
  if (!result.success) {
    await showAlert(`${t('backup.createFailed')}: ${result.error}`);
    return;
  }
  backups.unshift(result.data);
  renderBackup();
  (window as Window & { showUndo?: (msg: string) => void })
    .showUndo?.(`${t('backup.backupCreated')}: ${name}`);
}

export async function restoreBackup(id: number): Promise<void> {
  const b = backups.find((x) => x.id === id);
  if (!b) return;

  const diffResult = await window.api.previewRestoreDiff(id);
  if (!diffResult.success) {
    await showAlert(`${t('backup.previewFailed')}: ${diffResult.error}`);
    return;
  }
  const diffCount = diffResult.data.length;
  const confirmMsg = diffCount > 0
    ? `${t('backup.willRestore')}「${b.name}」\n${t('backup.itemsWillChange', { count: diffCount })}\n${t('backup.autoSnapshot')}\n\n${t('backup.confirmContinue')}`
    : `${t('backup.noDiff')}「${b.name}」${t('backup.noNeedRestore')}`;

  if (diffCount === 0) { await showAlert(confirmMsg); return; }
  if (!await showConfirm(confirmMsg)) return;

  const result = await window.api.restoreBackup(id);
  if (!result.success) {
    await showAlert(`${t('backup.restoreFailed')}: ${result.error}`);
    return;
  }
  await loadBackups();
  (window as Window & { showUndo?: (msg: string) => void })
    .showUndo?.(`${t('backup.restored')}: ${b.name}`);
}

export async function exportBackup(id: number): Promise<void> {
  const result = await window.api.exportBackup(id);
  if (!result.success) {
    await showAlert(`${t('backup.exportFailed')}: ${result.error}`);
  }
}

export async function importBackup(): Promise<void> {
  const result = await window.api.importBackup();
  if (!result.success) {
    if (result.error !== t('backup.noFileSelected')) await showAlert(`${t('backup.importFailed')}: ${result.error}`);
    return;
  }
  backups.unshift(result.data);
  renderBackup();
  (window as Window & { showUndo?: (msg: string) => void })
    .showUndo?.(`${t('backup.imported')}: ${result.data.name}`);
}

export async function deleteBackup(id: number): Promise<void> {
  if (!await showConfirm(t('backup.confirmDelete'))) return;
  const result = await window.api.deleteBackup(id);
  if (!result.success) { await showAlert(`${t('backup.deleteFailed')}: ${result.error}`); return; }
  backups = backups.filter((b) => b.id !== id);
  renderBackup();
}

function countItems(json: string): number {
  try {
    return (JSON.parse(json) as unknown[]).length;
  } catch {
    return 0;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN').replace(/\//g, '-');
  } catch { return iso; }
}

const backupPageApi = { createBackup, restoreBackup, exportBackup, importBackup, deleteBackup };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any)._backupPage = backupPageApi;
