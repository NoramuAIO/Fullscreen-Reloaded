// Minimal DOM and SpotiKit mocks for Node `node:test` suites.

class StubEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.composed = Boolean(init.composed);
    this.detail = init.detail !== undefined ? init.detail : null;
    this.defaultPrevented = false;
    this.cancelBubble = false;
    this._immediateStopped = false;
    this.target = init.target || null;
    this.currentTarget = null;
    for (const [k, v] of Object.entries(init)) {
      if (!(k in this)) this[k] = v;
    }
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopPropagation() {
    this.cancelBubble = true;
  }
  stopImmediatePropagation() {
    this.cancelBubble = true;
    this._immediateStopped = true;
  }
}

class StubClassList {
  constructor(el) {
    this._el = el;
    this._set = new Set();
  }
  _syncFromAttr(val) {
    this._set.clear();
    if (!val) return;
    for (const token of String(val).trim().split(/\s+/)) {
      if (token) this._set.add(token);
    }
  }
  _syncToAttr() {
    const val = Array.from(this._set).join(" ");
    this._el._attrs.set("class", val);
  }
  add(...tokens) {
    for (const t of tokens) {
      if (t) this._set.add(String(t));
    }
    this._syncToAttr();
  }
  remove(...tokens) {
    for (const t of tokens) {
      this._set.delete(String(t));
    }
    this._syncToAttr();
  }
  toggle(token, force) {
    const key = String(token);
    if (force === true) {
      this._set.add(key);
      this._syncToAttr();
      return true;
    }
    if (force === false) {
      this._set.delete(key);
      this._syncToAttr();
      return false;
    }
    if (this._set.has(key)) {
      this._set.delete(key);
      this._syncToAttr();
      return false;
    }
    this._set.add(key);
    this._syncToAttr();
    return true;
  }
  contains(token) {
    return this._set.has(String(token));
  }
  replace(oldToken, newToken) {
    if (!this._set.has(String(oldToken))) return false;
    this._set.delete(String(oldToken));
    this._set.add(String(newToken));
    this._syncToAttr();
    return true;
  }
  get length() {
    return this._set.size;
  }
  [Symbol.iterator]() {
    return this._set.values();
  }
  toString() {
    return Array.from(this._set).join(" ");
  }
}

function createStyleObj() {
  const props = new Map();
  const target = {
    setProperty(name, value) {
      if (value === null || value === undefined || value === "") {
        props.delete(name);
      } else {
        props.set(name, String(value));
      }
    },
    removeProperty(name) {
      const prev = props.get(name) || "";
      props.delete(name);
      return prev;
    },
    getPropertyValue(name) {
      return props.get(name) || "";
    },
    get cssText() {
      return Array.from(props.entries())
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ");
    },
    set cssText(val) {
      props.clear();
      if (!val) return;
      for (const decl of String(val).split(";")) {
        const idx = decl.indexOf(":");
        if (idx === -1) continue;
        const k = decl.slice(0, idx).trim();
        const v = decl.slice(idx + 1).trim();
        if (k) props.set(k, v);
      }
    },
  };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (typeof prop === "string") return props.get(prop) || "";
      return undefined;
    },
    set(obj, prop, value) {
      if (prop === "cssText") {
        obj.cssText = value;
        return true;
      }
      if (typeof prop === "string") {
        obj.setProperty(prop, value);
        return true;
      }
      obj[prop] = value;
      return true;
    },
  });
}

function parseSimpleSelector(part) {
  const tokens = { tag: null, id: null, classes: [], attrs: [] };
  let rest = part.trim();
  if (!rest || rest === "*") return tokens;

  const tagMatch = rest.match(/^[A-Za-z0-9_-]+/);
  if (tagMatch) {
    tokens.tag = tagMatch[0].toUpperCase();
    rest = rest.slice(tagMatch[0].length);
  }

  while (rest.length > 0) {
    if (rest[0] === "#") {
      const m = rest.slice(1).match(/^[A-Za-z0-9_-]+/);
      if (!m) break;
      tokens.id = m[0];
      rest = rest.slice(1 + m[0].length);
    } else if (rest[0] === ".") {
      const m = rest.slice(1).match(/^[A-Za-z0-9_-]+/);
      if (!m) break;
      tokens.classes.push(m[0]);
      rest = rest.slice(1 + m[0].length);
    } else if (rest[0] === "[") {
      const end = rest.indexOf("]");
      if (end === -1) break;
      const inner = rest.slice(1, end).trim();
      const eqIdx = inner.indexOf("=");
      if (eqIdx === -1) {
        tokens.attrs.push({ name: inner, value: null });
      } else {
        const name = inner.slice(0, eqIdx).trim();
        let value = inner.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        tokens.attrs.push({ name, value });
      }
      rest = rest.slice(end + 1);
    } else {
      break;
    }
  }

  return tokens;
}

function matchesSimple(el, part) {
  if (!el || el.nodeType !== 1) return false;
  const spec = parseSimpleSelector(part);
  if (spec.tag && el.tagName !== spec.tag) return false;
  if (spec.id && el.id !== spec.id) return false;
  for (const cls of spec.classes) {
    if (!el.classList.contains(cls)) return false;
  }
  for (const attr of spec.attrs) {
    if (!el.hasAttribute(attr.name)) return false;
    if (attr.value !== null && el.getAttribute(attr.name) !== attr.value) {
      return false;
    }
  }
  return true;
}

function matchesSingleSelector(el, selector) {
  const trimmed = selector.trim();
  if (!trimmed) return false;
  // Split into combinator tokens: ">" or whitespace
  const rawTokens = trimmed.replace(/\s*>\s*/g, " > ").trim().split(/\s+/);
  let idx = rawTokens.length - 1;
  if (!matchesSimple(el, rawTokens[idx])) return false;
  idx--;
  let cur = el;
  while (idx >= 0) {
    if (rawTokens[idx] === ">") {
      idx--;
      cur = cur.parentNode;
      if (!cur || !matchesSimple(cur, rawTokens[idx])) return false;
      idx--;
    } else {
      let parent = cur.parentNode;
      let found = false;
      while (parent) {
        if (matchesSimple(parent, rawTokens[idx])) {
          cur = parent;
          found = true;
          break;
        }
        parent = parent.parentNode;
      }
      if (!found) return false;
      idx--;
    }
  }
  return true;
}

function matchesSelector(el, selector) {
  if (!selector) return false;
  return String(selector)
    .split(",")
    .some((s) => matchesSingleSelector(el, s));
}

class StubNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this._listeners = new Map();
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx >= 0 ? this.parentNode.childNodes[idx + 1] || null : null;
  }

  get isConnected() {
    let cur = this;
    while (cur) {
      if (cur === this.ownerDocument || cur === this.ownerDocument?.documentElement) {
        return true;
      }
      cur = cur.parentNode;
    }
    return false;
  }

  appendChild(child) {
    if (!child) return child;
    if (typeof child === "string") {
      child = this.ownerDocument.createTextNode(child);
    }
    if (child.nodeType === 11) {
      const items = [...child.childNodes];
      for (const item of items) this.appendChild(item);
      return child;
    }
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(newNode, refNode) {
    if (!refNode) return this.appendChild(newNode);
    const idx = this.childNodes.indexOf(refNode);
    if (idx === -1) return this.appendChild(newNode);
    if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
    newNode.parentNode = this;
    this.childNodes.splice(idx, 0, newNode);
    return newNode;
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  replaceChildren(...nodes) {
    while (this.childNodes.length) {
      this.removeChild(this.childNodes[0]);
    }
    this.append(...nodes);
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  contains(other) {
    if (!other) return false;
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  addEventListener(type, listener, options = false) {
    if (typeof listener !== "function") return;
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const once = typeof options === "object" && Boolean(options?.once);
    const signal = typeof options === "object" ? options?.signal : undefined;

    if (signal?.aborted) return;

    if (!this._listeners.has(type)) this._listeners.set(type, []);
    const list = this._listeners.get(type);
    const existing = list.find((entry) => entry.listener === listener && entry.capture === capture);
    if (existing) return;

    const entry = { listener, capture, once };
    list.push(entry);

    if (signal && typeof signal.addEventListener === "function") {
      signal.addEventListener(
        "abort",
        () => {
          this.removeEventListener(type, listener, { capture });
        },
        { once: true }
      );
    }
  }

  removeEventListener(type, listener, options = false) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const list = this._listeners.get(type);
    if (!list) return;
    const next = list.filter((entry) => !(entry.listener === listener && entry.capture === capture));
    if (next.length === 0) this._listeners.delete(type);
    else this._listeners.set(type, next);
  }

  _invokeListeners(event, capturePhase) {
    const list = this._listeners.get(event.type);
    if (!list || list.length === 0) return;
    for (const entry of [...list]) {
      if (entry.capture !== capturePhase) continue;
      if (event._immediateStopped) break;
      if (entry.once) {
        this.removeEventListener(event.type, entry.listener, { capture: entry.capture });
      }
      entry.listener.call(this, event);
    }
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    const path = [];
    let cur = this;
    while (cur) {
      path.push(cur);
      cur = cur.parentNode;
    }
    // Capture phase: top-down (excluding target or including non-target ancestors)
    for (let i = path.length - 1; i >= 1; i--) {
      if (event.cancelBubble) break;
      event.currentTarget = path[i];
      path[i]._invokeListeners(event, true);
    }
    // Target phase
    if (!event.cancelBubble) {
      event.currentTarget = this;
      this._invokeListeners(event, true);
      if (!event._immediateStopped) {
        this._invokeListeners(event, false);
      }
    }
    // Bubble phase
    if (event.bubbles) {
      for (let i = 1; i < path.length; i++) {
        if (event.cancelBubble) break;
        event.currentTarget = path[i];
        path[i]._invokeListeners(event, false);
      }
    }
    event.currentTarget = null;
    return !event.defaultPrevented;
  }
}

class StubTextNode extends StubNode {
  constructor(ownerDocument, text = "") {
    super(ownerDocument);
    this.nodeType = 3;
    this.nodeName = "#text";
    this.textContent = String(text);
  }
}

class StubDocumentFragment extends StubNode {
  constructor(ownerDocument) {
    super(ownerDocument);
    this.nodeType = 11;
    this.nodeName = "#document-fragment";
  }
}

class StubElement extends StubNode {
  constructor(ownerDocument, tagName, namespaceURI = null) {
    super(ownerDocument);
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.nodeName = this.tagName;
    this.namespaceURI = namespaceURI;
    this._attrs = new Map();
    this.classList = new StubClassList(this);
    this.style = createStyleObj();
    this._textContent = "";
    this._innerHTML = "";
    this.dataset = new Proxy(
      {},
      {
        get: (_, key) => {
          const attrName = "data-" + String(key).replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
          return this.getAttribute(attrName) ?? undefined;
        },
        set: (_, key, val) => {
          const attrName = "data-" + String(key).replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
          this.setAttribute(attrName, String(val));
          return true;
        },
      }
    );
  }

  get id() {
    return this.getAttribute("id") || "";
  }
  set id(val) {
    this.setAttribute("id", String(val));
  }

  get className() {
    return this.getAttribute("class") || "";
  }
  set className(val) {
    this.setAttribute("class", String(val));
  }

  get textContent() {
    if (this.childNodes.length === 0) return this._textContent;
    return this.childNodes.map((c) => c.textContent || "").join("");
  }
  set textContent(val) {
    this.childNodes.length = 0;
    this._textContent = val === null || val === undefined ? "" : String(val);
  }

  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(val) {
    this._innerHTML = val === null || val === undefined ? "" : String(val);
    this.childNodes.length = 0;
    this._textContent = "";
  }

  setAttribute(name, value) {
    const key = String(name);
    const val = String(value);
    this._attrs.set(key, val);
    if (key === "class") {
      this.classList._syncFromAttr(val);
    }
  }

  getAttribute(name) {
    const key = String(name);
    return this._attrs.has(key) ? this._attrs.get(key) : null;
  }

  hasAttribute(name) {
    return this._attrs.has(String(name));
  }

  removeAttribute(name) {
    const key = String(name);
    this._attrs.delete(key);
    if (key === "class") {
      this.classList._syncFromAttr("");
    }
  }

  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (matchesSelector(cur, selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
  }
  focus() {}
  blur() {}
  click() {
    this.dispatchEvent(new StubEvent("click", { bubbles: true, cancelable: true }));
  }
}

class StubDocument extends StubNode {
  constructor() {
    super(null);
    this.ownerDocument = this;
    this.nodeType = 9;
    this.nodeName = "#document";
    this.documentElement = new StubElement(this, "html");
    this.documentElement.parentNode = this;
    this.childNodes.push(this.documentElement);
    this.head = new StubElement(this, "head");
    this.body = new StubElement(this, "body");
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(tag) {
    return new StubElement(this, tag);
  }

  createElementNS(ns, tag) {
    return new StubElement(this, tag, ns);
  }

  createTextNode(text) {
    return new StubTextNode(this, text);
  }

  createDocumentFragment() {
    return new StubDocumentFragment(this);
  }

  getElementById(id) {
    const targetId = String(id);
    const walk = (node) => {
      for (const child of node.children) {
        if (child.id === targetId) return child;
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this.documentElement);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }
}

function createStorageStub() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

export function installDomStub() {
  const doc = new StubDocument();
  const storage = createStorageStub();
  let rafSeq = 0;
  const rafTimers = new Map();

  const raf = (cb) => {
    const id = ++rafSeq;
    const t = setTimeout(() => {
      rafTimers.delete(id);
      cb(Date.now());
    }, 0);
    rafTimers.set(id, t);
    return id;
  };
  const cancelRaf = (id) => {
    const t = rafTimers.get(id);
    if (t) {
      clearTimeout(t);
      rafTimers.delete(id);
    }
  };

  const loc = { href: "https://xpui.app.spotify.com/", pathname: "/", search: "", hash: "" };
  const nav = { language: "en-US", languages: ["en-US", "en"], userAgent: "node-test" };

  const win = {
    document: doc,
    localStorage: storage,
    CustomEvent: StubEvent,
    Element: StubElement,
    location: loc,
    navigator: nav,
    requestAnimationFrame: raf,
    cancelAnimationFrame: cancelRaf,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: doc.addEventListener.bind(doc),
    removeEventListener: doc.removeEventListener.bind(doc),
    dispatchEvent: doc.dispatchEvent.bind(doc),
    getComputedStyle: () => createStyleObj(),
  };
  doc.defaultView = win;

  const globals = {
    document: doc,
    window: win,
    Element: StubElement,
    CustomEvent: StubEvent,
    localStorage: storage,
    requestAnimationFrame: raf,
    cancelAnimationFrame: cancelRaf,
    location: loc,
    navigator: nav,
  };

  const saved = new Map();
  for (const [key, value] of Object.entries(globals)) {
    const desc = Object.getOwnPropertyDescriptor(globalThis, key);
    saved.set(key, desc);
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }

  function reset() {
    for (const id of rafTimers.keys()) cancelRaf(id);
    for (const [key, desc] of saved.entries()) {
      if (desc === undefined) {
        delete globalThis[key];
      } else {
        Object.defineProperty(globalThis, key, desc);
      }
    }
  }

  return { document: doc, window: win, localStorage: storage, reset };
}

export function createSpotiKitMock(overrides = {}) {
  let abortController = new AbortController();
  const stopCallbacks = [];
  const playerListeners = new Map();
  const storageScopes = new Map();
  const profileMenuItems = [];
  const playbarItems = [];
  const notifications = [];
  const injectedStyles = [];

  const emitPlayer = (event, payload) => {
    const set = playerListeners.get(event);
    if (!set) return;
    for (const cb of [...set]) cb(payload);
  };

  const defaultPlayer = {
    track: null,
    state: { item: null },
    duration: 0,
    position: 0,
    isPlaying: false,
    shuffle: false,
    repeat: "off",
    volume: 0.8,
    muted: false,
    seek(ms) {
      this.position = Math.max(0, Number(ms) || 0);
    },
    toggle() {
      this.isPlaying = !this.isPlaying;
      emitPlayer("playpause", { isPlaying: this.isPlaying });
    },
    play() {
      this.isPlaying = true;
      emitPlayer("playpause", { isPlaying: true });
    },
    pause() {
      this.isPlaying = false;
      emitPlayer("playpause", { isPlaying: false });
    },
    next() {},
    previous() {},
    setShuffle(val) {
      this.shuffle = Boolean(val);
    },
    setRepeat(mode) {
      this.repeat = mode;
    },
    setVolume(vol) {
      this.volume = Math.max(0, Math.min(1, Number(vol) || 0));
    },
    setMuted(muted) {
      this.muted = Boolean(muted);
    },
    on(event, cb) {
      if (!playerListeners.has(event)) playerListeners.set(event, new Set());
      playerListeners.get(event).add(cb);
      return () => this.off(event, cb);
    },
    off(event, cb) {
      playerListeners.get(event)?.delete(cb);
    },
  };

  const buildPlayer = () => {
    const base = {
      ...defaultPlayer,
      state: { item: null },
      ...(overrides.Player || {}),
    };
    base.state = {
      item: null,
      ...(overrides.Player?.state || {}),
    };
    return base;
  };

  const buildQueue = () => ({
    next: [],
    prev: [],
    ...(overrides.Queue || {}),
    ...(Array.isArray(overrides.Queue?.next) ? { next: [...overrides.Queue.next] } : {}),
    ...(Array.isArray(overrides.Queue?.prev) ? { prev: [...overrides.Queue.prev] } : {}),
    ...(Array.isArray(overrides.Queue?.previous) ? { previous: [...overrides.Queue.previous] } : {}),
  });

  const SpotiKit = {
    ready: overrides.ready ?? Promise.resolve(),
    Player: buildPlayer(),
    Queue: buildQueue(),
    Navigation: {
      go: () => {},
      push: () => {},
      ...(overrides.Navigation || {}),
    },
    Http: {
      get: async () => ({}),
      post: async () => ({}),
      ...(overrides.Http || {}),
    },
    Audio: {
      analysis: async () => ({}),
      features: async () => ({}),
      ...(overrides.Audio || {}),
    },
    Locale: {
      language: "en",
      ...(overrides.Locale || {}),
    },
    Platform: {
      AuthorizationAPI: {
        getState: () => ({ token: { accessToken: "mock-access-token" } }),
        getAccessToken: async () => "mock-access-token",
      },
      PlayerAPI: {
        getQueue: async () => ({ nextTracks: [] }),
      },
      History: {
        push: () => {},
      },
      Translations: {
        getLocale: () => "en",
      },
      ...(overrides.Platform || {}),
    },
    Storage: overrides.Storage || {
      scope(namespace) {
        const key = String(namespace);
        if (!storageScopes.has(key)) {
          const map = new Map();
          storageScopes.set(key, {
            get(k) {
              return map.has(k) ? map.get(k) : null;
            },
            set(k, v) {
              map.set(k, v);
            },
            remove(k) {
              map.delete(k);
            },
            delete(k) {
              map.delete(k);
            },
            clear() {
              map.clear();
            },
          });
        }
        return storageScopes.get(key);
      },
    },
    ProfileMenu: overrides.ProfileMenu || {
      add(item) {
        profileMenuItems.push(item);
        return () => {
          const idx = profileMenuItems.indexOf(item);
          if (idx !== -1) profileMenuItems.splice(idx, 1);
        };
      },
    },
    Playbar: overrides.Playbar || {
      add(item) {
        const handle = { ...item, active: Boolean(item?.active), removed: false };
        playbarItems.push(handle);
        return {
          setActive(val) {
            handle.active = Boolean(val);
          },
          remove() {
            handle.removed = true;
          },
        };
      },
    },
    notify:
      overrides.notify ||
      ((message, options) => {
        notifications.push({ message, options });
      }),
  };

  const runStopCallbacks = () => {
    while (stopCallbacks.length > 0) {
      const fn = stopCallbacks.pop();
      try {
        fn();
      } catch {
        // Ignore cleanup errors during mock teardown
      }
    }
    for (const styleEntry of injectedStyles.splice(0)) {
      styleEntry.remove();
    }
  };

  const bindSignal = (ctrl) => {
    ctrl.signal.addEventListener("abort", runStopCallbacks, { once: true });
  };
  bindSignal(abortController);

  const ctx = {
    id: "fullscreen-reloaded",
    get signal() {
      return abortController.signal;
    },
    onStop(fn) {
      if (typeof fn === "function") stopCallbacks.push(fn);
    },
    style(css) {
      let el = null;
      if (typeof document !== "undefined" && document.head) {
        el = document.createElement("style");
        el.setAttribute("data-spotikit-style", "fullscreen-reloaded");
        el.textContent = String(css || "");
        document.head.appendChild(el);
      }
      const remove = () => {
        if (el && typeof el.remove === "function") el.remove();
      };
      injectedStyles.push({ css, el, remove });
      return remove;
    },
    url(rel = "") {
      return `spotikit://fullscreen-reloaded/${String(rel).replace(/^\/+/, "")}`;
    },
    use(name) {
      return SpotiKit[name] ?? null;
    },
    ...(overrides.ctx || {}),
  };

  const emitTrack = (track) => {
    SpotiKit.Player.track = track;
    if (SpotiKit.Player.state) SpotiKit.Player.state.item = track;
    emitPlayer("track", track);
  };

  const reset = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
    runStopCallbacks();
    playerListeners.clear();
    storageScopes.clear();
    profileMenuItems.length = 0;
    playbarItems.length = 0;
    notifications.length = 0;
    for (const k of Object.keys(SpotiKit.Player)) delete SpotiKit.Player[k];
    Object.assign(SpotiKit.Player, buildPlayer());
    for (const k of Object.keys(SpotiKit.Queue)) delete SpotiKit.Queue[k];
    Object.assign(SpotiKit.Queue, buildQueue());
    abortController = new AbortController();
    bindSignal(abortController);
  };

  return {
    SpotiKit,
    ctx,
    get abortController() {
      return abortController;
    },
    emitTrack,
    reset,
  };
}
