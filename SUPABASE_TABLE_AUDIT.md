# WorkspaceScreen Recolor — Structural Blue/Red to Gray

Recolors `WorkspaceScreen.tsx`/`CondoFloorPlan.tsx`'s structural UI chrome from blue/red to the neutral gray scale already in `src/components/tokens/colors.ts`. The three severity hues (comfortable/tight/needs-attention — green/amber/red) were explicitly out of scope and are confirmed unchanged.

## Task 1 — Audit

Grepped both files exhaustively for `t.accent`, `t.brand`, `attentionFg`/`attentionBg`, and every raw hex literal, then classified each hit. `WorkspaceScreen.tsx` had zero remaining `t.accent`/`t.brand` — an earlier round already converted its brand-blue chrome to neutral tokens. `CondoFloorPlan.tsx` was never touched by that pass, so its blue was all still live.

### Structural blue — `CondoFloorPlan.tsx` (`t.accent` = `#2563EB`, `t.accentFill` = `#DCE8FF`)

| Line | Element | Code |
|---|---|---|
| 344 | Room border — highlighted/drop-target room | `stroke={isDropTarget ? t.accent : isHighlighted ? t.accent : t.roomStroke}` |
| 434, 447 | Alignment-guide dashed lines (shown while dragging) | `stroke={t.accent}` |
| 476–477 | Selected item's fill/stroke on the plan | `fill = t.accentFill; stroke = t.accent;` |
| 507 | Drag ghost outline (non-colliding case) | `stroke={isColliding ? t.attentionFg : t.accent}` |
| 630 | Minimap — currently focused room | `fill={focusedRoomId === room.id ? t.accent : '#E2E8F0'}` |

All "active/selected state" indicators — not severity findings.

### Severity-finding color usage — confirmed to match the 3 protected hues exactly

Cross-checked against `colors.ts`'s three severity pairs: `attentionFg`/`attentionBg` (`#DC2626`/`#FEECEC`), `tightFg`/`tightBg` (`#B45309`/`#FBF1E4`), `comfortFg`/`comfortBg` (`#047857`/`#E7F4EF`). Every one of these usages is driven by `analysis.violations`, `itemStatuses`, or `walkwayStatuses` — real classification output, not decoration:

- `WorkspaceScreen.tsx`: pill row (Issues/Warnings/Walkways Blocked/Clear counts), furniture list row badges + border (`statusMeta`), all of the Recommendations tab (violation cards, badges, borders), Walkway Access list, Room Checklist, Rules tab (worst-band badge/border), the "Every clearance rule passes" success message
- `CondoFloorPlan.tsx`: furniture item fill/stroke by `itemStatuses` (non-selected, non-colliding case), the live gap-readout badges during drag (color keyed to measured cm vs. the 60/91cm thresholds)

**None of these were touched.**

### Ambiguous cases — flagged, then resolved with the user before any code changed

**A. The interactive accent-blue itself (table above).** `colors.ts`'s own top comment calls this out as deliberately separate from severity: *"a distinct blue — separate from the red/amber/green states so 'you can move this' never reads as a warning."* Not one of the three protected hues, but real-time interaction feedback, not passive chrome. → **Resolved: recolor to gray.**

**B. Live drag-collision red** — reuses `t.attentionFg`/`t.attentionBg` but isn't a clearance-engine finding:

| Location | Code |
|---|---|
| `CondoFloorPlan.tsx:472–474` | Colliding item's fill/stroke during drag |
| `CondoFloorPlan.tsx:507` | Drag ghost outline, colliding branch |
| `WorkspaceScreen.tsx:580` | Caption text: `"Overlapping — release to snap back"` |
| `WorkspaceScreen.tsx:1094` | `toastBanner` background — used for **every** toast message, not just warnings (e.g. "Sofa moved to Living Room" got the same red treatment as "would overlap another piece") |

→ **Resolved: recolor to gray.**

**Not blue/red, no action needed either way:** `roomStroke` (`#AEB8C7`), `itemStroke` (`#97A2B4`), `itemFill` (`#EDF1F7`) are already desaturated neutral-family tones. The minimap's hardcoded slate hexes (`#CBD5E1`, `#94A3B8`, `#E2E8F0`, `#F1F5F9`, `#475569`) are already gray, just not token-sourced — a separate hygiene issue, out of scope.

## Task 2 — Recolor

**7 call sites across 2 files changed:**
- `CondoFloorPlan.tsx`: room highlight/drop-target border, alignment guides, selected-item fill/stroke, drag ghost outline, minimap focused-room fill — all → `t.ink` (with `t.line`/`t.inkMute`/`t.inkSoft` used for lighter/fill roles where needed)
- `WorkspaceScreen.tsx`: the "Overlapping" caption → `t.ink`; the toast banner background → `t.ink` (plus its shadow's RGBA recalculated to match, since it was hardcoded to the old red's RGB)

**Maintaining contrast:** rather than mapping everything to one flat gray, this uses the neutral scale's actual value range — colliding items get the darker `t.inkMute` fill + `t.ink` stroke, plain-selected items get the lighter `t.line` fill + `t.ink` stroke, and the drag ghost outline uses `t.ink` (colliding) vs. `t.inkSoft` (not colliding). This keeps "you can't drop here" visually distinct from "this is just selected" by weight/darkness instead of hue. No new token was needed — the existing `ink`/`inkSoft`/`inkMute`/`line` range was sufficient.

**Before/after, verified with real screenshots** (seeded two furniture items, selected one, dragged it into a collision, released it):
- Colliding items and alignment guides: blue/red → gray
- Toast banner: red → ink-navy
- "Needs Attention" / "4 Issues" / "-2 Clear" badges and pills: **identical red/green in both**, unaffected

**Severity colors confirmed unchanged:** `git diff --stat src/components/tokens/colors.ts` — empty. Byte-for-byte identical.

**Room fill colors in `condoLayout.ts`:** untouched — nothing there was flagged as structural in Task 1, confirmed via `git diff` (no changes to that file at all).

## Final report

- **Clean build:** `tsc -b --force` clean, `eslint .` clean, `vite build` succeeds.
- **No engine files touched:** `git diff --stat src/engine/clearance.ts src/components/floorPlanDrag.ts src/components/floorPlanGeometry.ts` — empty.
- **No severity-token changes:** confirmed via direct diff, not just by avoiding them.

---

*Implemented: 2026-08-18.*
