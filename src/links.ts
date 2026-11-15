import { openExternal } from 'otools-plugin-sdk/runtime';

export function openLink(url: string): void {
  const target = url.trim();
  if (!target) return;
  try {
    if (openExternal(target)) return;
  } catch {
    // Fall through to window.open for plain browser previews.
  }
  if (typeof window !== 'undefined') {
    window.open(target, '_blank', 'noopener,noreferrer');
  }
}

export async function copyText(text: string): Promise<boolean> {
  const value = String(text ?? '');
  if (!value) return false;

  const otools = (window as unknown as { otools?: { copyText?: (input: string) => void } }).otools;
  if (otools && typeof otools.copyText === 'function') {
    try {
      otools.copyText(value);
      return true;
    } catch {
      // fall through
    }
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
