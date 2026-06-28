---
name: Pro Desktop Interface
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1c'
  surface-container: '#202020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c0c6d6'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#303030'
  outline: '#8b91a0'
  outline-variant: '#414754'
  surface-tint: '#aac7ff'
  primary: '#aac7ff'
  on-primary: '#003064'
  primary-container: '#3e90ff'
  on-primary-container: '#002957'
  inverse-primary: '#005db8'
  secondary: '#c8c6c8'
  on-secondary: '#303032'
  secondary-container: '#474649'
  on-secondary-container: '#b6b4b7'
  tertiary: '#ffb874'
  on-tertiary: '#4b2800'
  tertiary-container: '#d47b00'
  on-tertiary-container: '#412200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aac7ff'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#00468d'
  secondary-fixed: '#e4e2e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#ffdcbf'
  tertiary-fixed-dim: '#ffb874'
  on-tertiary-fixed: '#2d1600'
  on-tertiary-fixed-variant: '#6a3b00'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 41px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 25px
  title-sm:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 13px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-desktop: 24px
  margin-mobile: 16px
  container-max: 1200px
---

## Brand & Style
The design system is engineered to evoke the precision and premium feel of a native macOS application. It targets power users who value clarity, professional-grade reliability, and an "expensive" aesthetic. 

The style is a synthesis of **Modern Corporate** and **Glassmorphism**. It utilizes semi-transparent materials to create "vibrancy," allowing background colors to bleed through UI layers subtly. This creates a sense of depth and spatial awareness typical of desktop operating systems. Every element is high-fidelity, favoring subtle gradients and crisp, single-pixel strokes over flat, heavy-handed visuals.

## Colors
The palette is rooted in the "Space Gray" ecosystem. The primary background uses a deep #1E1E1E with 70% opacity to support the macOS vibrancy effect against system wallpapers. 

- **Primary Accent:** macOS Royal Blue (#0A84FF) is used exclusively for active states, primary actions, and progress indicators.
- **Surface Tiers:** Cards and secondary containers use Deep Charcoal (#2C2C2E) to lift them from the base background.
- **Status & Critical:** Sunset Amber (#FF9500) replaces traditional red or yellow for latency, stopped items, or warnings, providing a sophisticated alternative to standard error colors.
- **Elimination of Green:** All success or active "on" states that typically use green are mapped to Royal Blue or Snow White to maintain a strict, professional tone.
- **Borders:** All structural divisions are defined by a surgical 1px line in #3A3A3C.

## Typography
This design system utilizes **Inter** (as the closest high-quality equivalent to SF Pro) to maintain the systematic, utilitarian feel of a desktop environment. 

Typography is used to reinforce hierarchy through weight rather than just size. Headlines use tighter letter-spacing to mimic the "Display" variants of San Francisco, while body text (set at a precise 13px desktop standard) optimizes for legibility in dense data environments. Use `label-caps` for metadata and category headers to provide a structural anchor to layouts.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy within a fluid container. On desktop, content is structured within a 12-column grid with 16px gutters, maximizing information density without feeling cluttered.

Spacing follows a strict 4px baseline shift. Most internal component padding should utilize 8px (2 units) or 12px (3 units) to maintain a compact, native-app feel. Larger sections should be separated by 24px or 32px to provide breathing room between distinct functional areas.

## Elevation & Depth
Depth is achieved through **Tonal Layering** and **Backdrop Blurs**. Shadows are used sparingly; instead, hierarchy is established by brightness:
1. **Level 0 (Base):** Space Gray (#1E1E1E) with 70% opacity.
2. **Level 1 (Cards/Panels):** Deep Charcoal (#2C2C2E) with a 1px border (#3A3A3C).
3. **Level 2 (Popovers/Menus):** Slightly lighter charcoal with a 20px backdrop blur and a more prominent 1px border to simulate light catching the edge of a glass pane.

Avoid heavy drop shadows. If a shadow is necessary for a floating modal, use a very large, 25% opacity black blur with 0px offset.

## Shapes
The design system uses a consistent "Rounded" language. Main containers and cards use a 10px - 12px radius, while smaller elements like buttons and input fields use a 6px radius. This mimics the modern macOS "Squircle" aesthetic where corners are soft but the overall structure remains professional and architectural.

## Components
- **Buttons:** Primary buttons use Royal Blue (#0A84FF) with white text. Secondary buttons use a subtle gray fill or a simple 1px border.
- **Cards:** Defined by the #2C2C2E background and #3A3A3C border. No shadows are applied to cards unless they are draggable.
- **Input Fields:** Backgrounds should be slightly darker than the card surface to create an "inset" look, using a 1px border that glows Royal Blue on focus.
- **Chips/Status:** Use Royal Blue for "Active" or "Online" and Sunset Amber for "Warning" or "Standby." Text inside chips should be white or high-contrast silver.
- **Lists:** Use subtle hover states (#FFFFFF at 5% opacity) and 1px dividers.
- **Segmented Controls:** These should look like physical toggles within a recessed track, a staple of macOS utility design.