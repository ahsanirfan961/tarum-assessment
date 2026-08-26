/**
 * "Has this workspace's walkthrough been dismissed?" as an external store.
 *
 * localStorage is the source of truth and React subscribes to it, mirroring
 * how the theme is handled in src/lib/theme.js. Doing it this way rather than
 * with a mount effect keeps the server render honest: the server snapshot is
 * "already seen", so the guide never renders into the HTML and then has to be
 * torn down on hydration.
 *
 * Versioned so a future rewrite of the slides can show again for everyone.
 */
const seenKey = (kind) => `fomi-guide-seen-v1-${kind}`;

const listeners = new Set();

export function subscribeGuideSeen(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getGuideSeen(kind) {
  try {
    return localStorage.getItem(seenKey(kind)) === "1";
  } catch {
    // Private browsing: report as seen, so a guide that cannot be dismissed
    // permanently does not reappear on every navigation.
    return true;
  }
}

export function getGuideSeenOnServer() {
  return true;
}

export function markGuideSeen(kind) {
  try {
    localStorage.setItem(seenKey(kind), "1");
  } catch {
    // Nothing to persist to; dismissing still closes it for this session.
  }
  for (const listener of listeners) listener();
}
