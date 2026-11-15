import { computed, onUnmounted, ref } from 'vue';
import type { ComputedRef } from 'vue';

const supportedLocales = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'de-DE', 'ru-RU', 'es-ES', 'ar-SA'] as const;
type V2exLocale = (typeof supportedLocales)[number];
type MessageDictionary = Record<string, string>;

const messages = import.meta.glob<MessageDictionary>('../i18n/*.json', {
  eager: true,
  import: 'default',
});

function normalizeLocale(value: string): V2exLocale {
  const language = value.trim().replace(/_/g, '-').split('-')[0].toLowerCase();
  return supportedLocales.find((locale) => locale.toLowerCase().startsWith(`${language}-`)) ?? 'zh-CN';
}

function initialLocale(): V2exLocale {
  const documentLocale = typeof document === 'undefined' ? '' : document.documentElement.lang;
  if (documentLocale) return normalizeLocale(documentLocale);

  try {
    const storedLocale = typeof window === 'undefined' ? null : window.localStorage.getItem('otools:locale');
    if (storedLocale) return normalizeLocale(storedLocale);
  } catch {
    // Storage may be unavailable in an embedded webview.
  }

  return normalizeLocale(typeof navigator === 'undefined' ? '' : navigator.language);
}

function messageFor(locale: V2exLocale, key: string): string | undefined {
  const message = messages[`../i18n/${locale}.json`]?.[key];
  return typeof message === 'string' ? message : undefined;
}

export function useV2exI18n(): {
  locale: ComputedRef<V2exLocale>;
  t: (key: string, values?: Record<string, string | number>) => string;
  direction: ComputedRef<'ltr' | 'rtl'>;
} {
  const locale = ref<V2exLocale>(initialLocale());
  const direction = computed<'ltr' | 'rtl'>(() => (locale.value === 'ar-SA' ? 'rtl' : 'ltr'));

  const t = (key: string, values?: Record<string, string | number>): string => {
    const message = messageFor(locale.value, key) ?? messageFor('en-US', key) ?? messageFor('zh-CN', key) ?? key;
    return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      const value = values?.[name];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : placeholder;
    });
  };

  const onLocaleChanged = (event: Event) => {
    const value = (event as CustomEvent<{ locale?: unknown }>).detail?.locale;
    if (typeof value === 'string' && value.trim()) locale.value = normalizeLocale(value);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('otools-locale-changed', onLocaleChanged);
  }

  const observer =
    typeof document !== 'undefined' && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => {
          locale.value = initialLocale();
        })
      : undefined;
  if (observer) {
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('otools-locale-changed', onLocaleChanged);
    }
    observer?.disconnect();
  });

  return { locale: computed(() => locale.value), t, direction };
}
