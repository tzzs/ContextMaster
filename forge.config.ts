import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import path from 'path';
import { execFileSync } from 'child_process';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    executableName: 'ContextMaster',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'ContextMaster',
      iconUrl: 'https://raw.githubusercontent.com/placeholder/contextmaster/main/assets/icon.ico',
      setupIcon: './assets/icon.ico',
    }),
    new MakerZIP({}, ['darwin']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
  hooks: {
    // 打包后注入 UAC manifest（需要 Windows SDK mt.exe）
    postPackage: async (config, buildPath) => {
      if (process.platform !== 'win32') return;
      try {
        const exePath = path.join(
          buildPath.outputPaths[0],
          'ContextMaster.exe'
        );
        const manifestPath = path.resolve('./assets/app.manifest');
        execFileSync('mt.exe', [
          '-manifest', manifestPath,
          `-outputresource:${exePath};#1`,
        ]);
        console.log('UAC manifest injected successfully');
      } catch (e) {
        console.warn('Failed to inject UAC manifest (mt.exe not found):', e);
      }
    },
  },
};

export default config;
