# Glance Retheme — Light Mode

## Goal
Ship a complete Light theme alongside the existing Dark one, with a user-selectable preference (Dark / Light / System) persisted in `config.json`. Theme-aware xterm.js terminal.

## Architecture

### 1. Token foundation (CSS variables)
Move all visual color decisions into CSS variables. Tailwind utilities resolve via `var(...)`. One source of truth, two palettes toggled by a `data-theme` attribute on `<html>`.

**Why:** every other change is painful without this. Fixes hardcoded hexes in 8+ files in one shot.

**Where:**
- `frontend/src/style.css` — define `:root` (light defaults), `[data-theme="dark"]` overrides, semantic tokens (`--surface`, `--on-surface`, `--primary`, `--outline`, etc.)
- `frontend/tailwind.config.js` — replace literal hexes in `theme.extend.colors` with `var(--token)` references. Keep the same Tailwind class names so component code barely changes.

**Light palette sketch:**
- `surface` / `background`: `#F5F5F7` (macOS light window chrome)
- `surface-container*`: warm greys `#ECECEE → #D1D1D6`
- `on-surface`: `#1C1C1E`
- `on-surface-variant`: `#6E6E73`
- `primary`: `#007AFF` (macOS systemBlue)
- `error` / `warning` / `tertiary`: keep Apple semantic hues, slightly brighter for contrast on white
- `outline`: `#D1D1D6`, `outline-variant`: `#E5E5E7`

### 2. Config plumbing
Extend the existing `Config` struct in both languages.

**Go** — `app.go:63`
```go
type Config struct {
    // ...
    Theme string `json:"theme"` // "dark" | "light" | "system" (default "system")
}
```

**TS** — `frontend/src/types/index.ts:12`
```ts
export type ThemeMode = 'dark' | 'light' | 'system';
export interface Config {
  // ...
  theme: ThemeMode;
}
```

**Where defaults flow:**
- `frontend/src/app/App.tsx:19` — add `theme: 'system'` to `useConfig` initial.
- `frontend/src/hooks/useConfig.ts` — no signature change; the new field is just another string key in `cfg`.

**Migration safety:** missing `theme` in old `config.json` is harmless — Go reads `""`, frontend normalizes to `"system"`.

### 3. Theme controller hook
**New file** `frontend/src/hooks/useTheme.ts`
- Reads `cfg.theme`
- Resolves `"system"` against `window.matchMedia('(prefers-color-scheme: dark)')` and subscribes to changes
- Sets `document.documentElement.dataset.theme` to `"dark"` or `"light"`
- Exposes `setTheme(mode)` which updates cfg and saves (delegates to existing `saveConfig`)

Wired in `App.tsx` near the existing `useEffect`s; no new fetch.

### 4. Native macOS integration
`main.go:33-44` currently forces `mac.NSAppearanceNameDarkAqua`. This must be dynamic for native chrome (titlebar, dialogs, scrollbars) to follow.

- Drop `Appearance: mac.NSAppearanceNameDarkAqua`.
- Add a Go method `SetAppTheme(mode string)` bound via Wails.
  - Use `runtime.WindowSetDarkTheme(ctx)` / `runtime.WindowSetLightTheme(ctx)` from `wails/runtime`.
- Frontend calls it from `useTheme` whenever the resolved mode changes.
- `BackgroundColour`: keep `rgba(0,0,0,0)` — vibrancy is mode-aware on macOS automatically.

### 5. Glass effects in light mode
`style.css:63` defines `.glass-panel` and `.apple-sidebar` with dark `rgba(30,30,30,0.8)`. These need light equivalents. Scope the rules under `[data-theme="dark"]` / `[data-theme="light"]` blocks:

```css
[data-theme="dark"] .glass-panel  { background: rgba(30,30,30,0.8);  }
[data-theme="light"] .glass-panel { background: rgba(255,255,255,0.72); }
```

Same treatment for `.apple-sidebar`, `.login-glow-1/2`, and any `bg-black/*` utility replacements.

### 6. Component audit (hardcoded hex sweep)
Replace inline `style={{ color: '#...' }}` and arbitrary `bg-white/5` / `bg-black/40` utilities with tokens.

| File | Issue |
|---|---|
| `ServerList.tsx:50` | inline `#FF9500` / `#0A84FF` for latency color → `text-warning` / `text-primary` |
| `ServerMetricsPanel.tsx:70,78,86,93` | `color="#0A84FF"`, `"#30D158"`, `"#FF9500"`, `"#BF5AF2"` passed to `MetricCard` → extend `MetricCard` to accept a Tailwind color name OR route through CSS vars |
| `TerminalPanel.tsx:29-51` | xterm theme object — see step 7 |
| `OverviewView.tsx` (login glows) | uses `.login-glow-1/2` — give those vars per-theme |
| `SignInPage.tsx:62,77` | `border-white/30`, `bg-primary/50` text — Tailwind already tokenized; verify alpha reads OK on white |
| `DockerContainers.tsx` | mostly already tokenized; confirm `bg-black/50`, `bg-black/60` for log expansion have light replacements |
| `LogConsole.tsx:35`, `LogsView.tsx:33` | `bg-black/40` log backgrounds → light variant needed |
| `MetricCard.tsx:14,17` | `color` prop is a hex string; refactor to accept a token key |

### 7. xterm.js theme sync
**New file** `frontend/src/utils/terminalTheme.ts`
```ts
export function getTerminalTheme(mode: 'dark' | 'light'): ITerminalOptions['theme']
```
Reads the same CSS variables (via `getComputedStyle`) or returns a paired object literal (simpler, no perf cost — terminal is mounted once). Two paired palettes — one for dark, one for light.

**Update** `TerminalPanel.tsx:25-53` — replace hardcoded theme with the helper, called with the resolved mode from `useTheme`. Re-apply theme on mode switch via `term.options.theme = ...` (live theme update, no scrollback loss).

### 8. UI control
Add a segmented control to `GithubSettingsView.tsx` (matches existing "Advanced" disclosure style and lives next to `client_id` which is also a UI pref):

```
Theme:  [ Dark ]  [ Light ]  [ System ]
```

Three buttons, active state styled like the existing auth-method toggle in `ServerForm.tsx:98-112` (which `bg-primary text-on-primary` for selected, ghost otherwise). Persists via existing `onSave` flow.

Alternative placement: header dropdown. Settings view is cleaner — fewer header additions, lives with other persisted prefs.

## Implementation order

| # | Phase | Files touched | Verify |
|---|---|---|---|
| 1 | Define CSS tokens (light + dark) | `style.css` | both palettes render in DevTools |
| 2 | Rewire `tailwind.config.js` to vars | `tailwind.config.js` | grep for leftover literal colors |
| 3 | Extend Config (Go + TS) | `app.go`, `types/index.ts`, `App.tsx` | `wails dev` builds |
| 4 | Build `useTheme` hook + wire | new `hooks/useTheme.ts`, `App.tsx` | toggle in DevTools flips `data-theme` |
| 5 | Native theme via Wails | `main.go` (new method), `useTheme` | native titlebar follows mode |
| 6 | Audit + fix hardcoded hexes | 6+ components | grep `#[0-9A-F]{6}` returns ~0 hits in `frontend/src` |
| 7 | xterm theme helper | new `utils/terminalTheme.ts`, `TerminalPanel.tsx` | open SSH terminal in both modes |
| 8 | Settings UI segmented control | `GithubSettingsView.tsx` | click cycles modes, persists across restart |
| 9 | Light-mode polish pass | glass tints, alpha values, borders | visual review in both modes |
| 10 | Build verification | `wails build -platform darwin/universal` | clean build, app launches in both modes |

## Risks & mitigations

- **macOS vibrancy tint mismatch**: `WindowIsTranslucent` + light mode may yield a milky look. Mitigation: allow the user to disable vibrancy via a future "Reduce transparency" toggle; out of scope for this iteration.
- **Opacity-suffix utilities** (`text-on-surface-variant/60`, `bg-primary/10`): Tailwind's `/{opacity}` works on `color-mix()` in v3.4+ — verify the installed version supports it (`package.json` shows `^3.4.3`, OK). If it breaks in light mode, fall back to dedicated tokens (`text-on-surface-variant-muted`).
- **`useTheme` save loop**: saving on every system-appearance change spams `config.json`. Mitigation: debounce 300ms; only persist explicit user picks (Dark / Light), not resolved `"system"` flips.
- **xterm re-theme cost**: re-creating the terminal on theme change clears the scrollback. Mitigation: only swap the theme via `term.options.theme = ...` (xterm supports live theme updates since 5.x).

## Out of scope
- Accent color picker (Royal Blue is fixed)
- Custom user-defined palettes
- Per-module theme overrides
