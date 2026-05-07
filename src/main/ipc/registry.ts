import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { MenuScene, MenuItemType } from '../../shared/enums';
import { ToggleItemParams, BatchToggleParams } from '../../shared/types';
import { MenuManagerService } from '../services/MenuManagerService';
import { wrapHandler } from '../utils/ipcWrapper';
import log from '../utils/logger';

export function registerRegistryHandlers(menuManager: MenuManagerService): void {
  ipcMain.handle(
    IPC.REGISTRY_GET_ITEMS,
    wrapHandler((_event: unknown, scene: MenuScene) => {
      log.debug(`[Registry] Getting items for scene: ${scene}`);
      return menuManager.getMenuItems(scene, false, 'high');
    })
  );

  ipcMain.handle(
    IPC.REGISTRY_TOGGLE,
    wrapHandler(async (_event: unknown, params: ToggleItemParams) => {
      log.info(`[Registry] Toggle item: ${params.name} (${params.isEnabled ? 'enabled' : 'disabled'} -> ${params.isEnabled ? 'disabled' : 'enabled'})`);
      const item = {
        id: -1,
        name: params.name,
        command: '',
        iconPath: null,
        isEnabled: params.isEnabled,
        source: '',
        menuScene: params.menuScene,
        registryKey: params.registryKey,
        type: params.type ?? MenuItemType.System,
      };
      const result = await menuManager.toggleItem(item);
      menuManager.invalidateCache(params.menuScene);
      log.info(`[Registry] Toggle completed: ${params.name} -> ${!params.isEnabled}`);
      return { newState: !params.isEnabled, newRegistryKey: result.newRegistryKey };
    })
  );

  ipcMain.handle(
    IPC.REGISTRY_BATCH,
    wrapHandler(async (_event: unknown, params: BatchToggleParams) => {
      log.info(`[Registry] Batch ${params.enable ? 'enable' : 'disable'}: ${params.items.length} items`);
      const start = Date.now();
      if (params.enable) {
        await menuManager.batchEnable(params.items);
      } else {
        await menuManager.batchDisable(params.items);
      }
      const elapsed = Date.now() - start;
      log.info(`[Registry] Batch operation completed in ${elapsed}ms`);
      return true;
    })
  );
}
