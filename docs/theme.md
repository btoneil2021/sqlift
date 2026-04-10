# SQLift — Design Theme

## Concept

Dark, clean, and focused. The app is a college project for a fitness tracking database — the UI should look intentional without being over-engineered. Dark background, amber accent, sharp type.

**Design philosophy:** Simple and minimal throughout. Every page should look like it was put together in a week — functional, not polished. No decorative sections, no animations, no marketing fluff. Just the UI needed to make the feature work.

---

## Colors

| Role | Token | Value |
|---|---|---|
| Background | `--bg` | `#0f0f0f` |
| Surface (cards, modals) | `--surface` | `#181818` |
| Surface raised | `--surface-2` | `#222222` |
| Border | `--border` | `#2a2a2a` |
| Border (active) | `--border-bright` | `#3d3d3d` |
| Text | `--text` | `#e8e4dc` |
| Text muted | `--text-muted` | `#7a7570` |
| Headings | `--text-h` | `#f5f1e8` |
| Accent | `--accent` | `#f0a500` |
| Accent glow | `--accent-glow` | `rgba(240,165,0,0.12)` |
| Danger | `--danger` | `#e05252` |
| Success | `--success` | `#4caf78` |

Use amber only for primary actions and active states.

---

## Logo

`SQL` in JetBrains Mono — amber background (`--accent`), text color set to `--bg` so the letters appear knocked out. Small horizontal padding and 2px border-radius. `ift` in Barlow Condensed, white (`--text-h`), bold. The two parts sit on the same baseline with a 1px gap.

---

## Fonts

All loaded from Google Fonts in `frontend/index.html`.

- **Barlow Condensed** (700, 800) — headings and the logo
- **DM Sans** (400, 500) — body text, labels, inputs
- **JetBrains Mono** (400, 500) — numbers and data values

---

## Buttons

- **Primary:** amber fill, black text, 2px radius
- **Secondary:** transparent, amber border + text
- **Ghost:** no border, muted text

All buttons: uppercase, 13px DM Sans, 500 weight.

---

## Key Files

- `frontend/src/index.css` — CSS variables and base styles
- `frontend/src/App.css` — component styles
- `frontend/index.html` — Google Fonts import
