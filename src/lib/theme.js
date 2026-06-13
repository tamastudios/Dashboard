const KEY = 'tama-theme';

export function getTheme() {
  return localStorage.getItem(KEY) ||
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(KEY, theme); } catch {}
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  return getTheme();
}

export function initTheme() {
  setTheme(getTheme());
}
