/* =========================================================
   store.js — content loading, persistence, file handling
   Layered model:
     1. assets/data/content.json  (base file you can edit in any text editor)
     2. localStorage override    (changes made in the browser editor)
     3. IndexedDB media blobs    (uploaded PDFs / images / video)
   ========================================================= */

const Store = (() => {
  const LS_KEY = 'carey-portfolio:content';
  const DB_NAME = 'carey-portfolio-media';
  const DB_STORE = 'files';
  const BASE = 'assets/data/content.json';

  /**
   * Ids that must never come back.
   *
   * A browser can hold overrides saved by an older build of the site, and
   * those overrides are merged on top of the current content on every load.
   * The old merge replaced whole arrays, so a card that had been deleted
   * from content.json — "football", for instance — was faithfully restored
   * from the stale copy and kept showing up in the Sports section.
   *
   * This list is the authoritative record of removed items. Anything listed
   * here is stripped from the merged result no matter where it came from,
   * which closes that hole permanently rather than relying on the browser
   * happening to have a clean cache.
   */
  const REMOVED_IDS = [
    'football',
    'soccer'
  ];

  /**
   * Titles that must never come back.
   *
   * The id list above is the primary record, but a stale copy saved by a
   * very old build may carry a card with no id at all. Matching on the
   * title as well means such a card is dropped too — the safety net works
   * even when the id is missing.
   */
  const REMOVED_TITLE_RE = /\b(football|soccer)\b/i;

  let base = null;      // original content.json
  let live = null;      // current working content (base + overrides merged)
  let db = null;

  /* ---------- IndexedDB ---------- */
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(DB_STORE)) {
          d.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  function idbPut(key, blob) {
    if (!db) return Promise.resolve(false);
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(blob, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  function idbGet(key) {
    if (!db) return Promise.resolve(null);
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  function idbKeys() {
    if (!db) return Promise.resolve([]);
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  function idbDelete(key) {
    if (!db) return Promise.resolve(false);
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  /* ---------- content ---------- */
  function clone(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(clone);
    const out = {};
    for (const k of Object.keys(v)) out[k] = clone(v[k]);
    return out;
  }

  /**
   * Merge the saved overrides on top of the base content.
   *
   * Both sides are deep-copied: without that, nested objects stay shared
   * with `base`, so editing the live content would silently corrupt the
   * original and Reset could never restore it.
   *
   * Lists are merged *by id* rather than replaced wholesale. The old code
   * returned the override's array verbatim, which meant a card deleted
   * from content.json was restored from a stale browser copy and reappeared
   * in the rendered page. Matching by id keeps the override's wording for
   * cards that still exist, drops cards that no longer exist, and lets
   * genuinely new cards (added in Edit mode) survive.
   */
  function deepMerge(baseObj, over, keyName) {
    // A removed item is never allowed back, whatever the override says.
    if (isRemoved(over)) return undefined;

    if (Array.isArray(baseObj)) {
      if (!Array.isArray(over)) return clone(baseObj);

      // Arrays of plain values (lists of strings, numbers) have no ids to
      // match on, so the override simply wins.
      const hasIds = baseObj.some(x => x && typeof x === 'object' && x.id != null);
      if (!hasIds) {
        return clone(over).filter(v => !isRemoved(v));
      }

      const baseById = new Map();
      baseObj.forEach(x => {
        if (x && typeof x === 'object' && x.id != null) baseById.set(String(x.id), x);
      });

      const out = [];
      const seen = new Set();

      // 1. keep the base's order; pull the override's fields onto each entry
      baseObj.forEach(b => {
        if (isRemoved(b)) return;                                    // removed
        const id = b && typeof b === 'object' && b.id != null ? String(b.id) : null;
        const o = id !== null ? over.find(x => x && typeof x === 'object' && String(x.id) === id) : null;
        const merged = o ? deepMerge(b, o) : clone(b);
        if (merged === undefined) return;
        out.push(merged);
        if (id !== null) seen.add(id);
      });

      // 2. append entries the override added (Edit mode can create new cards)
      over.forEach(o => {
        if (!o || typeof o !== 'object') return;
        if (isRemoved(o)) return;                                    // removed
        const id = o.id != null ? String(o.id) : null;
        if (id !== null && seen.has(id)) return;                     // already merged
        const merged = clone(o);
        if (merged === undefined) return;
        out.push(merged);
        if (id !== null) seen.add(id);
      });

      return out;
    }

    if (typeof baseObj !== 'object' || baseObj === null) {
      return over === undefined ? baseObj : over;
    }
    if (typeof over !== 'object' || over === null) return clone(baseObj);
    const out = clone(baseObj);
    for (const k of Object.keys(over)) {
      if (k.startsWith('_')) continue;
      const merged = deepMerge(baseObj[k], over[k], k);
      if (merged === undefined) delete out[k];
      else out[k] = merged;
    }
    return out;
  }

  /**
   * True when a value is an item that has been removed from the site.
   *
   * Both the id and the title are checked: an old copy saved before ids
   * existed may only carry a title, and one saved later carries both.
   */
  function isRemoved(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    if (v.id != null && REMOVED_IDS.indexOf(String(v.id)) !== -1) return true;
    if (typeof v.title === 'string' && REMOVED_TITLE_RE.test(v.title)) return true;
    return false;
  }

  function getOverrides() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setOverrides(obj) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearOverrides() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  /**
   * Overrides saved in a browser can outlive a content restructure: the
   * saved copy still holds fields (a "Football" card, say) that no longer
   * exist in the new content, and the old version would keep showing.
   *
   * Two guards work together:
   *
   *  1. SCHEMA — each save records the schema version it was made against.
   *     When the shipped content moves to a new version, stale overrides
   *     are dropped.
   *
   *  2. FINGERPRINT — each save also records a fingerprint of the *shape*
   *     of the content it was made from (which sections exist, how many
   *     cards each holds, which ids are present). If the shipped content's
   *     shape has changed since the save, the override is dropped as well.
   *     This catches everything the version number cannot: an old browser
   *     tab that saved against a content.json we have since restructured.
   */
  const VERSION_KEY = LS_KEY + ':version';
  const FINGERPRINT_KEY = LS_KEY + ':fingerprint';

  function currentSchemaVersion() {
    const v = (base && base._meta && base._meta.schemaVersion) || 0;
    return String(v);
  }

  /**
   * A stable fingerprint of the content *shape* (not its text).
   *
   * Only the structural skeleton matters: which top-level sections exist,
   * how many entries each list holds, and which ids they carry. Editing a
   * sentence does not change the fingerprint — adding, removing or
   * reordering a card does.
   */
  function contentFingerprint() {
    try {
      const parts = [];
      const walk = (node, path, depth) => {
        if (depth > 3) return;
        if (Array.isArray(node)) {
          const ids = node.map(x => (x && typeof x === 'object' && x.id) ? String(x.id) : '').join('|');
          parts.push(path + '[' + node.length + ':' + ids + ']');
          node.forEach((x, i) => { if (x && typeof x === 'object') walk(x, path + '.' + i, depth + 1); });
          return;
        }
        if (node && typeof node === 'object') {
          const keys = Object.keys(node).filter(k => !k.startsWith('_')).sort();
          parts.push(path + '{' + keys.join(',') + '}');
          keys.forEach(k => walk(node[k], path + '.' + k, depth + 1));
        }
      };
      walk(base, '', 0);
      return parts.join(';');
    } catch (e) {
      return '';
    }
  }

  function dropStaleOverrides() {
    try {
      const saved = localStorage.getItem(VERSION_KEY);
      const savedFp = localStorage.getItem(FINGERPRINT_KEY);
      const now = currentSchemaVersion();
      const nowFp = contentFingerprint();

      const hasOverride = localStorage.getItem(LS_KEY) !== null;

      // Legacy case: overrides were saved by an older build that had no
      // version stamp at all (saved === null). Without this check those
      // stale copies — e.g. one still holding a "Football" card — would
      // survive forever and keep resurrecting deleted content.
      const legacy = saved === null && hasOverride;

      // An override that carries no fingerprint cannot be checked against
      // the current content shape, so it cannot be trusted either. This is
      // the state a browser is left in when the fingerprint feature was
      // introduced: the old copy is still there, it just was never
      // stamped. Such copies are discarded as well.
      const unstamped = savedFp === null && hasOverride;

      // Shape changed since the save → the override describes content
      // that no longer exists. Discard it.
      const shapeChanged = savedFp !== null && savedFp !== nowFp;

      if ((saved !== null && saved !== now) || legacy || unstamped || shapeChanged) {
        clearOverrides();
        try { localStorage.setItem(VERSION_KEY, now); } catch (e) {}
        try { localStorage.setItem(FINGERPRINT_KEY, nowFp); } catch (e) {}
        return true;   // stale overrides were discarded
      }
      if (saved === null) {
        try { localStorage.setItem(VERSION_KEY, now); } catch (e) {}
      }
      if (savedFp === null) {
        try { localStorage.setItem(FINGERPRINT_KEY, nowFp); } catch (e) {}
      }
    } catch (e) {}
    return false;
  }

  async function load() {
    db = await openDB();
    let fetched = null;

    // Try the JSON first (it is the file you edit).
    // On file:// the browser blocks fetch(), so we fall back to the
    // generated content.js, which is loaded via a <script> tag.
    try {
      const res = await fetch(BASE + '?t=' + Date.now());
      if (res.ok) {
        fetched = await res.json();
      }
    } catch (e) { /* file:// protocol — use the script fallback below */ }

    base = fetched || window.__CONTENT_FALLBACK__ || null;

    if (!base) {
      base = { _meta: { error: 'Could not load content.json' } };
      console.error('[store] No content source available. Check that assets/data/content.json or content.js exists.');
    } else if (!fetched) {
      // running from file:// — the script fallback is in use
      document.documentElement.setAttribute('data-content-source', 'script');
    } else {
      document.documentElement.setAttribute('data-content-source', 'json');
    }

    // drop overrides saved against an older content structure
    const dropped = dropStaleOverrides();

    const over = getOverrides();
    live = over ? deepMerge(base, over) : clone(base);
    if (dropped) {
      console.info('[store] Content structure changed — cleared outdated local edits.');
    }
    return live;
  }

  /** Save the current live object as an override (keeps content.json intact). */
  function save() {
    const ok = setOverrides(live);
    try { localStorage.setItem(VERSION_KEY, currentSchemaVersion()); } catch (e) {}
    try { localStorage.setItem(FINGERPRINT_KEY, contentFingerprint()); } catch (e) {}
    return ok;
  }

  function reset() {
    clearOverrides();
    try { localStorage.setItem(VERSION_KEY, currentSchemaVersion()); } catch (e) {}
    try { localStorage.setItem(FINGERPRINT_KEY, contentFingerprint()); } catch (e) {}
    live = clone(base);
    return live;
  }

  /** Replace the whole content with an imported object. */
  function replaceAll(obj) {
    live = obj;
    setOverrides(obj);
    return live;
  }

  /** Resolve a media reference: may be a normal path, or a `db:<key>` token. */
  async function resolveMedia(src) {
    if (!src) return '';
    if (src.startsWith('db:')) {
      const blob = await idbGet(src.slice(3));
      return blob ? URL.createObjectURL(blob) : '';
    }
    return src;
  }

  function getDb() { return db; }

  const api = {
    load, save, reset, replaceAll, getOverrides, clearOverrides,
    resolveMedia, idbPut, idbGet, idbKeys, idbDelete, getDb,
    get base() { return base; },
    get live() { return live; },
    set live(v) { live = v; }
  };

  window.Store = api;
  return api;
})();
