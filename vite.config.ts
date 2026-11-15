import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 独立仓库：本文件不依赖宿主 OTools 仓的任何脚本/别名。
// 插件只需要 `otools-plugin-sdk` 的 runtime（invoke / openExternal），
// 该子路径由 vendor/otools-plugin-sdk 的 package.json exports 指向已构建的 dist。
const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('./plugin.json', import.meta.url)), 'utf8'),
) as { uuid?: string; packid?: string };

const pluginIdentity = manifest.uuid?.trim() || manifest.packid?.trim() || '';

export default defineConfig({
  // 宿主从 file:// 或插件自己的 origin 加载 dist/index.html，必须用相对路径。
  base: './',
  plugins: [vue()],
  define: {
    // SDK runtime 在宿主桥未注入时用它定位插件命令通道。
    __OTOOLS_PLUGIN_UUID__: JSON.stringify(pluginIdentity),
  },
  server: {
    host: '127.0.0.1',
    port: 6570,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
