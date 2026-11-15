const currentLocale = (): string => {
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'zh-CN';
};

export function relativeTime(unixSeconds: number): string {
  const timestamp = Number(unixSeconds) * 1000;
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const locale = currentLocale();

  try {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (abs < 60) return formatter.format(diffSeconds, 'second');
    if (abs < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute');
    if (abs < 86400) return formatter.format(Math.round(diffSeconds / 3600), 'hour');
    if (abs < 86400 * 30) return formatter.format(Math.round(diffSeconds / 86400), 'day');
    if (abs < 86400 * 365) return formatter.format(Math.round(diffSeconds / (86400 * 30)), 'month');
    return formatter.format(Math.round(diffSeconds / (86400 * 365)), 'year');
  } catch {
    const minutes = Math.round(Math.abs(diffSeconds) / 60);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
  }
}

export function absoluteTime(unixSeconds: number): string {
  const date = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(currentLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatCount(value: number | undefined | null): string {
  const count = Number(value ?? 0);
  if (!Number.isFinite(count)) return '0';
  try {
    return new Intl.NumberFormat(currentLocale()).format(count);
  } catch {
    return String(count);
  }
}

const DROP_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
  'svg',
  'math',
  'video',
  'audio',
  'canvas',
  'noscript',
  'template',
]);

const ALLOWED_TAGS = new Set([
  'a',
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'blockquote',
  'ul',
  'ol',
  'li',
  'img',
  'pre',
  'code',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'div',
  'span',
]);

const isSafeUrl = (value: string): boolean =>
  /^https?:\/\//i.test(value) || value.startsWith('//') || value.startsWith('/');

export function absoluteUrl(href: string): string {
  const value = href.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `https://www.v2ex.com${value}`;
  return `https://www.v2ex.com/${value.replace(/^\.?\//, '')}`;
}

export function parseTopicIdFromHref(href: string): number | null {
  const match = absoluteUrl(href).match(/^https:\/\/www\.v2ex\.com\/t\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

/**
 * V2EX 的 content_rendered 是服务端渲染过的 HTML，但插件仍然在客户端做一次
 * 白名单清洗：去掉脚本、事件属性、非 http(s) 链接与 data: 图片。
 */
export function sanitizeHtml(raw: string | undefined | null): string {
  const html = String(raw ?? '').trim();
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return '';

  const doc = new DOMParser().parseFromString(`<div id="v2ex-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('v2ex-root');
  if (!root) return '';

  const cleanElement = (element: Element): void => {
    const tag = element.tagName.toLowerCase();

    if (DROP_TAGS.has(tag)) {
      element.remove();
      return;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      const parent = element.parentNode;
      if (!parent) return;
      while (element.firstChild) {
        const child = element.firstChild;
        parent.insertBefore(child, element);
        if (child.nodeType === 1) cleanElement(child as Element);
      }
      parent.removeChild(element);
      return;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const keep =
        (tag === 'a' && (name === 'href' || name === 'title')) ||
        (tag === 'img' && (name === 'src' || name === 'alt' || name === 'title'));
      if (!keep) element.removeAttribute(attribute.name);
    }

    if (tag === 'a') {
      const href = element.getAttribute('href')?.trim() || '';
      if (!href || !isSafeUrl(href) || /^javascript:/i.test(href)) {
        element.removeAttribute('href');
      } else {
        element.setAttribute('href', absoluteUrl(href));
      }
      element.setAttribute('rel', 'noopener noreferrer');
    }

    if (tag === 'img') {
      const src = element.getAttribute('src')?.trim() || '';
      if (!src || !isSafeUrl(src)) {
        element.remove();
        return;
      }
      element.setAttribute('src', absoluteUrl(src));
      element.setAttribute('loading', 'lazy');
      element.setAttribute('referrerpolicy', 'no-referrer');
    }

    for (const child of Array.from(element.children)) {
      cleanElement(child);
    }
  };

  for (const child of Array.from(root.children)) {
    cleanElement(child);
  }

  return root.innerHTML;
}

export function plainText(raw: string | undefined | null): string {
  const html = String(raw ?? '').trim();
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, ' ');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export function truncate(text: string, length: number): string {
  const value = text.trim();
  if (value.length <= length) return value;
  return `${value.slice(0, length).trimEnd()}…`;
}
