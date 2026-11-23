// Types for the SpotiKit API, for editors. https://github.com/NMWplays/SpotiKit

declare namespace SpotiKit {
  type ReactElement = any;
  type ReactComponent<P = any> = (props: P) => ReactElement;
  type Off = () => void;

  /** What a default export gets when it starts. */
  interface Context {
    /** Its id inside SpotiKit. */
    id: string;
    /** Aborted when it stops. Pass it to addEventListener and fetch. */
    signal: AbortSignal;
    /** Runs when it stops. */
    onStop(stop: () => void): void;
    /** Adds a stylesheet that goes away when it stops. */
    style(css: string): HTMLStyleElement;
    /** The address of a file next to the script. */
    url(path: string): string;
    /** The module of a dependency from spotikit.json, with everything it exports. */
    use<T = any>(dependency: string): T;
  }

  interface ThemeContext extends Context {
    /** The theme's id, also set as data-spotikit-theme on <html>. */
    theme: string;
    /** The color scheme in use, or null. */
    scheme: string | null;
  }

  /**
   * The default export of an extension or theme script. Whatever it adds through the SpotiKit API is
   * removed when it stops; undo anything else in the function it returns or in onStop.
   */
  type Start<C extends Context = Context> = (context: C) => void | (() => void) | Promise<void | (() => void)>;

  interface Removable {
    remove(): void;
  }

  interface PlayerState {
    item: any;
    context: any;
    isPaused: boolean;
    shuffle: boolean;
    repeat: number;
    timestamp: number;
    [key: string]: any;
  }

  interface Track {
    name: string;
    uri: string;
    artists: { name: string; uri: string }[];
    album: { name: string; uri: string; images: { url: string }[] };
    images: { url: string }[];
    metadata: Record<string, string>;
    [key: string]: any;
  }

  type RepeatMode = "off" | "context" | "track";

  interface PlayerEvents {
    track: PlayerState | null;
    playpause: PlayerState;
    progress: number;
    state: PlayerState;
  }

  interface Player {
    readonly track: Track | null;
    readonly isPlaying: boolean;
    /** Milliseconds played. */
    readonly position: number;
    readonly duration: number;
    /** position / duration, between 0 and 1. */
    readonly progress: number;
    readonly shuffle: boolean;
    readonly repeat: RepeatMode;
    /** Between 0 and 1. */
    readonly volume: number;
    readonly muted: boolean;
    readonly liked: boolean;
    readonly state: PlayerState | null;
    readonly service: any;
    play(): Promise<any>;
    pause(): Promise<any>;
    toggle(): Promise<any>;
    next(): Promise<any>;
    previous(): Promise<any>;
    playUri(uri: string, options?: { context?: string; options?: any }): Promise<any>;
    seek(ms: number): Promise<any>;
    seekBy(ms: number): Promise<any>;
    setShuffle(on: boolean): Promise<any>;
    setRepeat(mode: RepeatMode): Promise<any>;
    setVolume(level: number): Promise<any>;
    volumeUp(): Promise<any>;
    volumeDown(): Promise<any>;
    setMuted(muted: boolean): Promise<any>;
    setLiked(liked: boolean): Promise<any>;
    on<K extends keyof PlayerEvents>(type: K, listener: (value: PlayerEvents[K]) => void): Off;
    off<K extends keyof PlayerEvents>(type: K, listener: (value: PlayerEvents[K]) => void): void;
  }

  interface Navigation {
    /** The path of the page in view, like /album/... */
    readonly path: string;
    go(path: string): void;
    replace(path: string): void;
    back(): void;
    forward(): void;
    on(type: "change", listener: (path: string) => void): Off;
  }

  interface QueueEntry {
    uri: string;
    uid: string;
    title: string;
    artist: string;
    album: string;
    image: string;
    provider: "queue" | "context" | string;
  }

  type QueueItems = string | { uri: string; uid?: string } | (string | { uri: string; uid?: string })[];

  interface Queue {
    readonly next: QueueEntry[];
    readonly previous: QueueEntry[];
    readonly current: QueueEntry | null;
    add(items: QueueItems): Promise<any>;
    playNext(items: QueueItems): Promise<any>;
    remove(items: QueueItems): Promise<any>;
    clear(): Promise<any>;
    on(type: "change", listener: (next: QueueEntry[]) => void): Off;
  }

  interface MenuTarget {
    uris: string[];
    uri: string | null;
    type: string | null;
    uids: string[];
    contextUri: string | null;
    trigger: "right-click" | "click" | string;
    element: Element | null;
    props: any;
  }

  interface MenuEntryOptions<T = MenuTarget> {
    label: string;
    /** An icon name (see Icons), an <svg> string or a React element. */
    icon?: string | ReactElement;
    trailingIcon?: string | ReactElement;
    divider?: "before" | "after";
    disabled?: boolean;
    items?: MenuEntryOptions<T>[];
  }

  interface ContextMenuOptions extends MenuEntryOptions<MenuTarget> {
    when?: (target: MenuTarget) => boolean;
    onSelect?: (target: MenuTarget, event: MouseEvent) => void;
    /** Also show in menus that aren't about an item. */
    anyMenu?: boolean;
  }

  interface ProfileMenuOptions extends MenuEntryOptions {
    checked?: boolean;
    when?: () => boolean;
    onSelect?: (entry: MenuEntry, event: MouseEvent) => void;
  }

  interface MenuEntry extends Removable {
    label: string;
    icon: string | ReactElement;
    disabled: boolean;
    divider: "before" | "after" | undefined;
    checked: boolean;
    update(options: Partial<ContextMenuOptions & ProfileMenuOptions>): MenuEntry;
  }

  interface ButtonOptions {
    /** The tooltip and accessible name. */
    label: string;
    /** An icon name (see Icons) or SVG markup. */
    icon?: string;
    onClick?: (button: Button, event: MouseEvent) => void;
    active?: boolean;
    disabled?: boolean;
  }

  interface Button extends Removable {
    label: string;
    icon: string;
    onClick: ((button: Button, event: MouseEvent) => void) | undefined;
    active: boolean;
    disabled: boolean;
    readonly element: HTMLButtonElement;
    update(options: Partial<ButtonOptions>): Button;
  }

  interface Dialog {
    open(options: {
      title?: string;
      content: ReactElement | Node | string | ((dialog: { close(): void }) => ReactElement | Node | string);
      size?: "normal" | "large";
      onClose?: () => void;
    }): { close(): void };
    confirm(options: {
      title: string;
      message?: string;
      confirmLabel?: string;
      cancelLabel?: string;
    }): Promise<boolean>;
    close(): void;
  }

  interface PanelOptions {
    title?: string;
    content?: ReactElement | Node | string;
    render?: ReactComponent<{ panel: string }>;
    actions?: ReactElement;
    /** false draws the content without Spotify's panel frame and header. */
    frame?: boolean;
    style?: Record<string, string | number>;
  }

  interface Panel extends Removable {
    readonly id: string;
    readonly isOpen: boolean;
    open(): Promise<void>;
    close(): Promise<void>;
    toggle(): Promise<void>;
    on(type: "change", listener: (isOpen: boolean) => void): Off;
  }

  interface Panels {
    readonly builtIn: Record<string, string>;
    readonly current: string;
    open(id: string): Promise<void>;
    close(): Promise<void>;
    register(options: PanelOptions): Panel;
    on(type: "change", listener: (id: string) => void): Off;
  }

  interface Apps {
    register(options: {
      id: string;
      name?: string;
      icon?: string;
      activeIcon?: string;
      component: ReactComponent<{ app: { id: string; name: string; path: string } }>;
    }): { id: string; path: string; open(): void; remove(): void };
    remove(id: string): void;
    open(id: string): void;
    list(): { id: string; name: string; path: string }[];
  }

  interface ThemeColors {
    background: string;
    frame?: string;
    elevated?: string;
    text?: string;
    subtext?: string;
    accent?: string;
    onAccent?: string;
    divider?: string;
    negative?: string;
    warning?: string;
    positive?: string;
    announcement?: string;
  }

  interface Themes {
    list(): Promise<
      { id: string; name: string; description: string; author: string; schemes: { id: string; name: string }[] }[]
    >;
    readonly current: { theme: string; scheme: string | null } | null;
    apply(themeId: string, schemeId?: string): Promise<{ theme: string; scheme: string | null }>;
    reset(): void;
    preview(colors: ThemeColors | null, variables?: Record<string, string>): void;
    css(colors: ThemeColors, variables?: Record<string, string>): string;
    readonly roles: string[];
    on(type: "change", listener: (current: { theme: string; scheme: string | null } | null) => void): Off;
  }

  interface Palette {
    id: string;
    name: string;
    colors: Required<ThemeColors>;
  }

  /** People's own color sets, kept per theme, or for Spotify without a theme. */
  interface Palettes {
    readonly roles: string[];
    /** Where palettes are kept right now: a theme, or "spotify". */
    readonly target: { id: string; name: string };
    /** The colors on screen, complete, to start a palette from. */
    base(): Required<ThemeColors>;
    list(target?: string): Palette[];
    /** The palette in use for the current target, or null. */
    readonly active: string | null;
    use(id: string | null): void;
    save(palette: { id?: string | null; name: string; colors: ThemeColors }): Palette;
    remove(id: string): void;
    /** Shows colors without saving them; preview(null) goes back. */
    preview(colors: ThemeColors | null): void;
    export(id: string): string;
    encode(palette: { name?: string; colors: ThemeColors }): string;
    import(code: string): { name: string; colors: Required<ThemeColors> };
    on(type: "change", listener: (state: { target: string; active: string | null; list: Palette[] }) => void): Off;
  }

  interface Window {
    readonly state: "normal" | "maximized" | "minimized" | "hidden";
    minimize(): void;
    maximize(): void;
    restore(): void;
    toggleMaximize(): void;
    close(): void;
    readonly customControls: boolean;
    useCustomControls(on: boolean): void;
    on(type: "change", listener: (state: string) => void): Off;
  }

  interface Store {
    get<T = any>(name: string, fallback?: T): T;
    set(name: string, value: any): void;
    remove(name: string): void;
    has(name: string): boolean;
    keys(): string[];
    clear(): void;
    /** A store of its own inside this one. Give every extension and app one. */
    scope(name: string): Store;
  }

  interface Keyboard {
    /** combo like "mod+shift+l" or "g h". Return false to stop the browser's default. */
    add(combo: string, handler: (event: KeyboardEvent, combo: string) => boolean | void): Removable;
    list(): string[];
  }

  interface HttpOptions {
    query?: Record<string, string | number | boolean>;
    body?: object | string | Blob | FormData | ArrayBuffer;
    headers?: Record<string, string>;
  }

  interface Http {
    get<T = any>(url: string, options?: HttpOptions): Promise<T>;
    post<T = any>(url: string, options?: HttpOptions): Promise<T>;
    put<T = any>(url: string, options?: HttpOptions): Promise<T>;
    patch<T = any>(url: string, options?: HttpOptions): Promise<T>;
    delete<T = any>(url: string, options?: HttpOptions): Promise<T>;
    request<T = any>(
      method: string,
      url: string,
      options?: HttpOptions
    ): Promise<{ status: number; headers: Record<string, string>; body: T }>;
    subscribe(url: string, onMessage: (message: any) => void, onError?: (error: any) => void): { cancel(): void };
  }

  interface GraphQLDefinition {
    name: string;
    operation: "query" | "mutation" | "subscription";
    sha256Hash: string;
  }

  interface GraphQL {
    readonly names: string[];
    readonly definitions: Record<string, GraphQLDefinition>;
    has(name: string): boolean;
    query<T = any>(name: string, variables?: Record<string, any>): Promise<T>;
    request<T = any>(
      definition: GraphQLDefinition,
      variables?: Record<string, any>
    ): Promise<{ data: T; errors?: any[] }>;
  }

  interface URIObject {
    type: string;
    id?: string;
    toURI(): string;
    toURL(): string;
    [key: string]: any;
  }

  interface URI {
    readonly types: Record<string, string>;
    parse(value: string | URIObject): URIObject | null;
    parseStrict(text: string): URIObject;
    isValid(value: unknown): boolean;
    type(value: string | URIObject): string | null;
    is(value: string | URIObject, type: string | string[]): boolean;
    isPlaylist(value: string | URIObject): boolean;
    equals(a: string | URIObject, b: string | URIObject): boolean;
    toUrl(value: string | URIObject): string;
    toPath(value: string | URIObject): string;
    create(type: string, props: Record<string, any>): URIObject;
    toHex(id: string): string;
    fromHex(hex: string): string;
    [shortcut: string]: any;
  }

  interface Locale {
    readonly language: string;
    readonly languages: string[];
    t(key: string, ...values: any[]): string;
    has(key: string): boolean;
    dictionary(): Record<string, string>;
    formatNumber(n: number, options?: Intl.NumberFormatOptions): string;
    formatCompact(n: number): string;
    formatDate(date: Date | number | string, options?: Intl.DateTimeFormatOptions): string;
    formatRelative(date: Date | number | string, options?: any): string;
    list(items: string[]): string;
    lower(text: string): string;
    upper(text: string): string;
  }

  interface ExtractedColors {
    raw: string;
    light: string;
    dark: string;
    isFallback: boolean;
  }

  interface Colors {
    extract(uriOrImage: string): Promise<ExtractedColors>;
    Color: any;
  }

  interface Icons {
    readonly names: string[];
    has(name: string): boolean;
    markup(name: string): string;
    svg(name: string, size?: number): string;
    element(name: string, props?: Record<string, any>): ReactElement;
  }

  interface Tooltip {
    attach(
      element: Element,
      options: string | { content: string; placement?: "top" | "bottom" | "left" | "right"; delay?: number }
    ): { setContent(text: string): void; show(): void; hide(): void; remove(): void };
  }

  interface Title {
    get(): Promise<string>;
    set(title: string): void;
    reset(): void;
    on(type: "change", listener: (title: string) => void): Off;
  }

  interface Hooks {
    usePlayer(): {
      state: PlayerState | null;
      track: Track | null;
      isPlaying: boolean;
      shuffle: boolean;
      repeat: RepeatMode;
    };
    usePosition(): number;
    useQueue(): QueueEntry[];
    useNavigation(): string;
    useColors(uriOrImage: string): ExtractedColors | null;
    useDrag(uris: string[], options?: { label?: string; contextUri?: string }): Record<string, any>;
  }

  interface Components {
    Text: ReactComponent;
    Button: ReactComponent;
    ButtonSecondary: ReactComponent;
    ButtonTertiary: ReactComponent;
    Icon: ReactComponent;
    Link: ReactComponent<{ to: string; [key: string]: any }>;
    Toggle: ReactComponent<{ value: boolean; onSelected: (value: boolean) => void; [key: string]: any }>;
    Slider: ReactComponent;
    Chip: ReactComponent;
    Dropdown: ReactComponent;
    Tooltip: ReactComponent;
    ConfirmDialog: ReactComponent;
    ScrollContainer: ReactComponent;
    Card: ReactComponent;
    Cards: Record<string, ReactComponent>;
    ScrollRow: ReactComponent;
    ContextMenu: ReactComponent<{
      menu: ReactElement;
      trigger?: "click" | "right-click";
      action?: string;
      [key: string]: any;
    }>;
    RightClickMenu: ReactComponent<{ menu: ReactElement; [key: string]: any }>;
    Menu: ReactComponent;
    MenuItem: ReactComponent;
    SubMenuItem: ReactComponent;
    TrackMenu: ReactComponent<{ uri: string; [key: string]: any }>;
    AlbumMenu: ReactComponent<{ uri: string; [key: string]: any }>;
    ArtistMenu: ReactComponent<{ uri: string; [key: string]: any }>;
    PlaylistMenu: ReactComponent<{ uri: string; [key: string]: any }>;
    ShowMenu: ReactComponent<{ uri: string; [key: string]: any }>;
    EpisodeMenu: ReactComponent<{ uri: string; [key: string]: any }>;
    AudiobookMenu: ReactComponent<{ uri: string; [key: string]: any }>;
    PanelFrame: ReactComponent;
    PanelBody: ReactComponent;
    PanelHeader: ReactComponent<{ title: string; [key: string]: any }>;
    [name: string]: any;
  }

  interface Marketplace {
    open(): void;
    installed(): Record<string, any>;
    install(id: string): Promise<any>;
    uninstall(id: string): Promise<boolean>;
    setEnabled(id: string, enabled: boolean): Promise<any>;
    /** Reads a GitHub repository's spotikit.json or manifest.json. */
    load(repository: string): Promise<any[]>;
    [key: string]: any;
  }
}

declare const SpotiKit: {
  /** Spotify's services are there; nearly the whole API works. */
  readonly ready: Promise<any>;
  /** Every packaged extension and app has started too. */
  readonly loaded: Promise<void>;
  readonly version: string;
  readonly channel: string;
  /** When the framework started, as an ISO date. */
  readonly loadedAt: string;
  readonly classMap: Record<string, string>;
  Player: SpotiKit.Player;
  Navigation: SpotiKit.Navigation;
  Queue: SpotiKit.Queue;
  ContextMenu: { add(options: SpotiKit.ContextMenuOptions): SpotiKit.MenuEntry };
  ProfileMenu: { add(options: SpotiKit.ProfileMenuOptions): SpotiKit.MenuEntry };
  Topbar: { add(options: SpotiKit.ButtonOptions & { side?: "left" | "right" }): SpotiKit.Button };
  Playbar: {
    add(options: SpotiKit.ButtonOptions): SpotiKit.Button;
    addWidget(options: SpotiKit.ButtonOptions): SpotiKit.Button;
  };
  Dialog: SpotiKit.Dialog;
  Panels: SpotiKit.Panels;
  Apps: SpotiKit.Apps;
  Themes: SpotiKit.Themes;
  Palettes: SpotiKit.Palettes;
  Window: SpotiKit.Window;
  Marketplace: SpotiKit.Marketplace;
  notify(message: string, options?: { type?: "default" | "error"; duration?: number }): { close(): void };
  Tooltip: SpotiKit.Tooltip;
  Title: SpotiKit.Title;
  Keyboard: SpotiKit.Keyboard;
  Storage: SpotiKit.Store;
  Locale: SpotiKit.Locale;
  Http: SpotiKit.Http;
  GraphQL: SpotiKit.GraphQL;
  URI: SpotiKit.URI;
  Platform: Record<string, any>;
  Colors: SpotiKit.Colors;
  Icons: SpotiKit.Icons;
  Typography: { readonly styles: string[]; className(style: string): string };
  Audio: { analysis(uri?: string): Promise<any> };
  React: any;
  ReactDOM: any;
  Libraries: Record<string, any>;
  Components: SpotiKit.Components;
  Hooks: SpotiKit.Hooks;
  Config: {
    readonly extensions: { id: string; name: string; path: string }[];
    readonly apps: { id: string; name: string }[];
    readonly themes: { id: string; name: string }[];
    readonly snippets: { id: string; name: string }[];
  };
  selfTest(): { report: Record<string, string>; missing: string[] };
};

/** JSX in .tsx files turns into SpotiKit.React.createElement. */
declare namespace JSX {
  type Element = any;
  interface IntrinsicElements {
    [name: string]: any;
  }
}
