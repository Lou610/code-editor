---
name: uncodixfy
description: Prevents generic AI/Codex UI patterns when generating frontend code. Use this skill whenever generating HTML, CSS, React, Vue, Svelte, or other frontend UI to enforce clean, functional interfaces similar to Linear, Raycast, Stripe, and GitHub.
---

# Uncodixfy

This skill prevents the default "AI dashboard aesthetic".

AI-generated interfaces tend to rely on the same shortcuts:
soft gradients, floating panels, oversized rounded corners, decorative copy, fake metrics, and overly dramatic shadows. These patterns create UI that immediately looks machine-generated.

Your goal is to **avoid those patterns and produce interfaces that feel intentionally designed, restrained, and functional.**

Think:

- Linear
- Raycast
- Stripe
- GitHub
- well-designed internal tools

These products prioritize **clarity, hierarchy, and function over decoration.**

---

# When To Use This Skill

Apply this skill when generating or modifying:

- React components
- HTML layouts
- dashboards
- admin tools
- CRUD interfaces
- settings pages
- forms
- data tables
- internal product UIs

Do NOT force these rules on:

- marketing landing pages
- promotional sites
- heavily animated experiences
- art-directed branding pages

Those have different design goals.

---

# Core Philosophy

When uncertain, prefer the **simpler and more conventional option**.

Avoid UI decisions made purely because they are easy for AI to generate.

Interfaces should:

- prioritize readability
- use predictable layouts
- avoid decorative filler
- use consistent spacing
- rely on hierarchy rather than visual effects

---

# UI Construction Rules

## Layout

- Use predictable grid or flex layouts
- Containers: `max-width 1200–1400px`
- Standard padding: `20–30px`
- No creative asymmetry unless explicitly required
- Avoid unnecessary wrappers

## Sidebars

- Fixed width: `240–260px`
- Solid background
- Simple `border-right`
- No floating shells
- No rounded outer container

## Headers

- Use simple page titles
- Avoid decorative hero sections in dashboards
- Avoid eyebrow labels and decorative subtitles

## Navigation

- Simple links
- Subtle hover states
- No transform animations
- Badges only when functional

## Cards

- Border radius: `8–12px`
- Subtle borders
- Minimal shadow
- No floating glass panels

## Buttons

- Solid fills or simple outlines
- Radius `8–10px`
- No gradient backgrounds
- No exaggerated pill shapes

## Forms

- Labels above inputs
- Clear validation states
- No floating label gimmicks

## Inputs

- Simple borders
- Standard focus ring
- No animated underline effects

## Tables

- Left-aligned text
- Clean row separation
- Subtle hover states
- Avoid excessive status badges

## Modals

- Centered overlay
- Simple backdrop
- Minimal animation

## Tabs

- Underline or simple border indicator
- No pill background tabs

---

# Typography

Prefer clarity over personality.

Rules:

- Use the project's existing typography if present
- Otherwise use a restrained sans-serif stack
- Avoid mixing serif and sans-serif purely for aesthetics
- Avoid uppercase decorative labels with wide letter spacing
- Body text: `14–16px`
- Maintain clear heading hierarchy

Avoid typography used purely to simulate "premium design".

---

# Spacing System

Use a consistent scale:
- 4px
- 8px
- 12px
- 16px
- 24px
- 32px


Avoid:

- inconsistent spacing
- oversized padding
- compressed layouts

Spacing should reinforce hierarchy.

---

# Borders

- `1px solid` borders
- subtle color contrast
- avoid decorative borders
- avoid gradient borders

---

# Shadows

Allowed shadow range:
- 0 2px 8px rgba(0,0,0,0.1)


Avoid:

- large dramatic shadows
- glow effects
- colored shadows
- heavy drop shadows

Hierarchy should come from structure, not effects.

---

# Transitions

Keep interactions subtle.
- 100–200ms ease


Allowed transitions:

- color change
- opacity
- background

Avoid:

- bounce animations
- transform-based motion
- exaggerated hover effects

---

# Explicitly Banned Patterns

Avoid the following default AI UI behaviors:

- oversized rounded corners (20–32px)
- pill-shaped components everywhere
- floating glassmorphism panels
- gradient-heavy "SaaS dashboard" designs
- decorative hero sections inside application UI
- fake analytics charts
- KPI metric card grids as the default dashboard layout
- glow effects used for hierarchy
- sidebar brand blocks with decorative gradients
- status badges on every table cell
- "premium dark mode" with blue gradients and neon accents
- decorative copy such as product slogans inside application interfaces
- fake activity feeds
- placeholder statistics

These patterns signal automatically generated UI.

---

# Color Selection Rules

Color decisions should follow this priority:

### 1. Project Colors (Highest Priority)

If the project defines:

- design tokens
- CSS variables
- Tailwind theme
- theme files

Use those.

### 2. Palette Inspiration

If the project does not define colors, draw inspiration from a palette.

Do not randomly invent color schemes.

### 3. Color Behavior

- keep colors calm and restrained
- avoid overly saturated accent colors
- avoid gradient-heavy surfaces
- use accent colors sparingly

Color should support hierarchy, not compete for attention.

---

# Dark Color Palettes

| Palette | Background | Surface | Primary | Secondary | Accent | Text |
|--------|-----------|--------|--------|----------|--------|------|
| Midnight Canvas | `#0a0e27` | `#151b3d` | `#6c8eff` | `#a78bfa` | `#f472b6` | `#e2e8f0` |
| Obsidian Depth | `#0f0f0f` | `#1a1a1a` | `#00d4aa` | `#00a3cc` | `#ff6b9d` | `#f5f5f5` |
| Slate Noir | `#0f172a` | `#1e293b` | `#38bdf8` | `#818cf8` | `#fb923c` | `#f1f5f9` |
| Carbon Elegance | `#121212` | `#1e1e1e` | `#bb86fc` | `#03dac6` | `#cf6679` | `#e1e1e1` |
| Deep Ocean | `#001e3c` | `#0a2744` | `#4fc3f7` | `#29b6f6` | `#ffa726` | `#eceff1` |

---

# Light Color Palettes

| Palette | Background | Surface | Primary | Secondary | Accent | Text |
|--------|-----------|--------|--------|----------|--------|------|
| Cloud Canvas | `#fafafa` | `#ffffff` | `#2563eb` | `#7c3aed` | `#dc2626` | `#0f172a` |
| Pearl Minimal | `#f8f9fa` | `#ffffff` | `#0066cc` | `#6610f2` | `#ff6b35` | `#212529` |
| Ivory Studio | `#f5f5f4` | `#fafaf9` | `#0891b2` | `#06b6d4` | `#f59e0b` | `#1c1917` |
| Porcelain Clean | `#f9fafb` | `#ffffff` | `#4f46e5` | `#8b5cf6` | `#ec4899` | `#111827` |
| Arctic Breeze | `#f0f9ff` | `#f8fafc` | `#0284c7` | `#0ea5e9` | `#f43f5e` | `#0c4a6e` |

---

# Toast Notifications

| Palette | Background | Surface | Primary | Secondary | Accent | Text |
|--------|-----------|--------|--------|----------|--------|------|
| Cloud Canvas | `#fafafa` | `#ffffff` | `#2563eb` | `#7c3aed` | `#dc2626` | `#0f172a` |
| Pearl Minimal | `#f8f9fa` | `#ffffff` | `#0066cc` | `#6610f2` | `#ff6b35` | `#212529` |
| Ivory Studio | `#f5f5f4` | `#fafaf9` | `#0891b2` | `#06b6d4` | `#f59e0b` | `#1c1917` |
| Porcelain Clean | `#f9fafb` | `#ffffff` | `#4f46e5` | `#8b5cf6` | `#ec4899` | `#111827` |
| Arctic Breeze | `#f0f9ff` | `#f8fafc` | `#0284c7` | `#0ea5e9` | `#f43f5e` | `#0c4a6e` |

---

# Output Behavior

When generating UI code:

- reuse existing components whenever possible
- prefer editing components instead of replacing entire layouts
- keep markup simple and readable
- avoid filler UI elements
- avoid fake data
- prioritize structure and usability over decoration

If a design choice feels like a **typical AI UI shortcut**, reject it and choose the more restrained alternative.

---

**Goal:** produce UI that looks intentionally designed by humans, not automatically generated by AI.