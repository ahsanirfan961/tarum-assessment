export const THEME_STORAGE_KEY = "fomi-theme";

/**
 * Runs before paint to stamp the saved theme on <html>, so a dark-mode user
 * never sees a light flash. Kept as a string because it ships inline in <head>.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

/*
  The live theme lives on the <html> element, written before React boots. That
  makes the document the source of truth and React a subscriber, which is what
  the tiny store below exposes.
*/

const listeners = new Set();

export function subscribeTheme(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

export function getServerTheme() {
  return "light";
}

export function setTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private browsing: the attribute still applies for this session.
  }
  for (const listener of listeners) listener();
}
