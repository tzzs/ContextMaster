import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { MenuScene, MenuItemType } from '../../shared/enums';
import { ToggleItemParams, BatchToggleParams } from '../../shared/types';
import { MenuManagerService } from '../services/MenuManagerService';
import { wrapHandler } from '../utils/ipcWrapper';

export function registerRegistryHandlers(menuManager: MenuManagerService): void {
  ipcMain.handle(
    IPC.REGISTRY_GET_ITEMS,
    wrapHandler((_event: unknown, scene: MenuScene) =>
      menuManager.getMenuItems(scene)
    )
  );

  ipcMain.handle(
    IPC.REGISTRY_TOGGLE,
    wrapHandler(async (_event: unknown, params: ToggleItemParams) => {
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
      return { newState: !params.isEnabled, newRegistryKey: result.newRegistryKey };
    })
  );

  ipcMain.handle(
    IPC.REGISTRY_BATCH,
    wrapHandler(async (_event: unknown, params: BatchToggleParams) => {
      if (params.enable) {
        await menuManager.batchEnable(params.items);
      } else {
        await menuManager.batchDisable(params.items);
      }
      return true;
    })
  );
}
