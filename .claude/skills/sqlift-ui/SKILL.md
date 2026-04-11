---
name: sqlift-ui
description: Guide for building UI components and pages in the SQLift frontend. Use this when adding pages, components, or styles to the React frontend.
---

# SQLift UI Conventions

SQLift uses a dark, brutalist aesthetic — functional and sharp, not decorative. Every page should look like it was built in a week: clean, intentional, no fluff.

Read `docs/theme.md` for the full design reference. This skill covers the practical implementation rules.

---

## Design principles

- **Dark and minimal.** Background `#0f0f0f`, surfaces `#181818` / `#222222`.
- **Amber accent only for primary actions and active states.** Never decorate with it.
- **No animations, no gradients, no shadows beyond the card offset.**
- **Typography is load-bearing.** Headings in Barlow Condensed, body in DM Sans, all numbers/data in JetBrains Mono.
- **Brutalist card grid.** Cards use a 6px hard offset shadow (`box-shadow: 6px 6px 0px 0px var(--border)`), 2px solid borders, 2px border-radius.

---

## CSS variables (from `frontend/src/index.css`)

```css
--bg:            #0f0f0f
--surface:       #181818
--surface-2:     #222222
--border:        #2a2a2a
--border-bright: #3d3d3d
--text:          #e8e4dc
--text-muted:    #7a7570
--text-h:        #f5f1e8
--accent:        #f0a500
--accent-glow:   rgba(240,165,0,0.12)
--danger:        #e05252
--success:       #4caf78

--font-display:  'Barlow Condensed', sans-serif   /* headings */
--font-body:     'DM Sans', sans-serif             /* body, labels, inputs */
--font-mono:     'JetBrains Mono', monospace       /* numbers, data, tags */
```

---

## Page structure

All internal pages use `<Layout title="PAGE TITLE">`. The layout provides the nav bar, logo, and `page-content` wrapper.

```jsx
import Layout from '../components/Layout'

export default function MyPage() {
  return (
    <Layout title="MY PAGE">
      {/* content here */}
    </Layout>
  )
}
```

Register new pages in `frontend/src/App.jsx` and link from `frontend/src/components/Layout.jsx` if they belong in the nav.

---

## Core CSS classes

### Layout
- `.page-layout` — full-height flex column
- `.page-content` — centred, max-width 1100px, padding 32px 24px
- `.page-header` — bold underline title block (`<h1>` inside)

### Cards
- `.dashboard-card` — surface card with hard-offset shadow
- `.dashboard-card.full-width` — spans full grid width (use `grid-column: 1 / -1`)
- `.panel-title` — mono uppercase label inside a card, with bottom border
- `.flex-header` — space-between row for panel-title + action button

### Stats
- `.stats-grid` — 2-col grid of stat items
- `.stat-item` — dark inset cell (`var(--bg)` background, 1px border)
- `.stat-label` — 11px mono muted label
- `.stat-value` — 32px display-font number

### Lists
- `.workout-list` / `.workout-row` — standard list row with hover border
- `.dummy-list` — large display-font list (placeholder/mock data)

### Buttons
```
.btn.btn--accent    amber fill, black text  — primary action
.btn.btn--outline   transparent, border     — secondary
.btn.btn--ghost     no border, muted text   — tertiary / destructive hint
.btn.btn--danger    red fill               — destructive
.btn.btn--massive   large display-font button with arrow
```
All buttons: uppercase, 13px DM Sans 500, 2px border-radius.

### Tags / badges
```
.tag.border-amber    amber outline           — active state
.tag.border-success  green outline           — completed / ok
.tag.border-danger   red outline             — error / warning
.tag.border-slate    muted outline           — neutral label
```
Tags: 10px mono, 2px 6px padding, 2px border-radius.

### Inputs
```
.profile-edit-input   dark background input/select, accent border on focus
```

### Utilities
```
.text-muted   .text-accent   .text-success
.data-monospace   — 12px mono
.mt-auto
```

---

## Common patterns

### Grid of cards
```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
  <div className="dashboard-card">
    <div className="panel-title">SECTION LABEL</div>
    {/* content */}
  </div>
  <div className="dashboard-card">...</div>
</div>
```

### Card with header action
```jsx
<div className="dashboard-card">
  <div className="flex-header">
    <span className="panel-title">LABEL</span>
    <button className="btn btn--accent" style={{ fontSize: 11, padding: '4px 12px' }}>ACTION</button>
  </div>
  {/* content */}
</div>
```

### Stat cell
```jsx
<div className="stat-item">
  <span className="stat-label">WEIGHT (kg)</span>
  <span className="stat-value">83.4</span>
</div>
```

### Scrollable list inside a card
```jsx
<ul style={{
  listStyle: 'none', padding: 0, margin: 0,
  display: 'flex', flexDirection: 'column', gap: 8,
  maxHeight: 260, overflowY: 'auto',
}}>
  {items.map(item => (
    <li key={item.id} style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* row content */}
    </li>
  ))}
</ul>
```

### Inline error message
```jsx
{error && (
  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>
    {error}
  </p>
)}
```

---

## What not to do

- No `box-shadow` blur — only the hard 6px offset on cards.
- No colour outside the palette. No random hex values.
- No `Inter`, `Roboto`, or system fonts.
- Don't put `font-family` inline unless overriding to mono for a data value — let the CSS variables do the work.
- Don't add loading spinners — show a simple mono text like `Loading…` or `…`.
- Don't add empty states with illustrations — a single muted mono line is enough.
