/**
 * 插件自带主题引导（独立仓库版）。
 *
 * 宿主的 `plugins/shared/plugin-theme-sync.ts` 依赖宿主 `src/` 内部的模块，
 * 独立仓库不能引用它，所以这里只保留本插件真正需要的能力：
 *   1. 决定亮 / 暗（优先宿主注入的 `window.__OTOOLS_THEME__`，其次本地缓存，最后跟随系统）；
 *   2. 在 `<html>` 上挂 `light` / `dark` 类，`styles.css` 里的令牌靠它切换；
 *   3. 按宿主的强调色档位写入 `--v2-accent`（亮暗各一套取值，与宿主一致）；
 *   4. 监听宿主父窗口的 `otools:theme-sync` 消息与系统配色变化。
 */

type ThemeMode = 'light' | 'dark' | 'system';
type ThemeAccent = 'classic' | 'violet' | 'emerald' | 'amber' | 'pink';

type InjectedTheme = {
  themeMode?: string;
  themeAccent?: string;
  resolvedTheme?: string;
};

const MODE_CACHE_KEY = 'otools:theme-mode';
const ACCENT_CACHE_KEY = 'otools:theme-accent';
const SYNC_MESSAGE_TYPE = 'otools:theme-sync';
const DEFAULT_MODE: ThemeMode = 'system';
const DEFAULT_ACCENT: ThemeAccent = 'classic';

// 与宿主 src/style.scss 的强调色档位保持一致（暗色取更亮的一档）。
const ACCENTS: Record<ThemeAccent, { light: string; dark: string }> = {
  classic: { light: '#2370c6', dark: '#4f94e8' },
  violet: { light: '#8b5cf6', dark: '#a78bfa' },
  emerald: { light: '#10b981', dark: '#28b57a' },
  amber: { light: '#f59e0b', dark: '#d7941a' },
  pink: { light: '#e0528d', dark: '#f772a8' },
};

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

const isThemeAccent = (value: unknown): value is ThemeAccent =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACCENTS, value);

const readInjectedTheme = (): InjectedTheme | null => {
  if (typeof window === 'undefined') return null;
  const detail = (window as unknown as { __OTOOLS_THEME__?: InjectedTheme }).__OTOOLS_THEME__;
  return detail && typeof detail === 'object' ? detail : null;
};

const readCached = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const prefersDark = (): boolean => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

const resolveMode = (): ThemeMode => {
  const injected = readInjectedTheme();
  if (isThemeMode(injected?.themeMode)) return injected.themeMode;
  const cached = readCached(MODE_CACHE_KEY);
  if (isThemeMode(cached)) return cached;
  return DEFAULT_MODE;
};

const resolveAccent = (): ThemeAccent => {
  const injected = readInjectedTheme();
  if (isThemeAccent(injected?.themeAccent)) return injected.themeAccent;
  const cached = readCached(ACCENT_CACHE_KEY);
  if (isThemeAccent(cached)) return cached;
  return DEFAULT_ACCENT;
};

const applyTheme = (mode: ThemeMode = resolveMode(), accent: ThemeAccent = resolveAccent()): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const injected = readInjectedTheme();
  const resolved = injected?.resolvedTheme === 'dark' || injected?.resolvedTheme === 'light'
    ? injected.resolvedTheme
    : mode === 'system'
      ? (prefersDark() ? 'dark' : 'light')
      : mode;

  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved !== 'dark');
  root.style.setProperty('--v2-accent', ACCENTS[accent][resolved === 'dark' ? 'dark' : 'light']);
  root.dataset.theme = resolved;
};

let installed = false;

export const installPluginTheme = (): void => {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  applyTheme();

  // 宿主父窗口（iframe 模式）与独立窗口的主题广播。
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data as (InjectedTheme & { type?: string }) | null;
    if (!data || typeof data !== 'object' || data.type !== SYNC_MESSAGE_TYPE) return;
    (window as unknown as { __OTOOLS_THEME__?: InjectedTheme }).__OTOOLS_THEME__ = data;
    applyTheme(
      isThemeMode(data.themeMode) ? data.themeMode : undefined,
      isThemeAccent(data.themeAccent) ? data.themeAccent : undefined,
    );
  });

  // 系统配色变化只在「跟随系统」时生效。
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (resolveMode() === 'system' && !readInjectedTheme()?.resolvedTheme) applyTheme();
    });
  } catch {
    // 老 webview 没有 addEventListener on MediaQueryList，忽略即可。
  }
};
