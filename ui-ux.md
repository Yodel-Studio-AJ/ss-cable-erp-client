# UI/UX Layout Documentation

## ItemRateEnquiryCard

A vertically stacked card component used to display a single item-rate enquiry in a list. The card is itself interactive (acts as a toggle-select target) while containing isolated action buttons that prevent event bubbling.

---

### Overall Container

```
┌─────────────────────────────────────────┐
│  HEADER                                 │
├─────────────────────────────────────────┤
│  BODY                                   │
├─────────────────────────────────────────┤
│  FOOTER ACTIONS                    ░ ░  │
└─────────────────────────────────────────┘
```

- `flex flex-col` — three stacked regions
- `rounded-md border bg-white` — card shell
- Border color switches between `border-secondary` (selected) and `border-gray-200` (idle) to signal selection state
- The entire card is a `role="button"` div; keyboard users can toggle selection with `Enter` or `Space`

---

### Region 1 — Header

```
┌─────────────────────────────────────────┐
│ ENQ-001 · open                    [ ✓ ] │
│ Item Name                               │
│ Unit · pcs                              │
└─────────────────────────────────────────┘
```

Layout: `flex items-start justify-between gap-3`

**Left column** (`min-w-0` to allow truncation):
- Row 1 — `flex items-center gap-2`: monospace enquiry number + dot separator + coloured status badge
  - Status colour is driven by `STATUS_TEXT` map (indigo → open, amber → bidding, purple → quoted, green → accepted, gray → closed)
- Row 2 — item name, `truncate text-sm font-semibold`
- Row 3 — optional unit line at `text-[11px] text-gray-500`

**Right column** (`shrink-0 pt-0.5`):
- A checkbox wrapped in a `stopPropagation` div so clicking it does not trigger the card's toggle handler
- Reflects the same `isSelected` state as the card border

Divider: `border-b border-gray-100` separates header from body

---

### Region 2 — Body (Bid Info)

Three mutually exclusive states rendered based on data:

#### State A — Accepted bid exists
```
Accepted bid
Supplier Name
₹1,20,000  ·  12 May 25
```
- Label: `text-[10px] uppercase tracking-wider text-gray-500`
- Supplier name: `text-sm font-medium text-gray-900`
- Amount: `text-sm font-semibold` — visually dominant
- Date: secondary `text-xs text-gray-600`

#### State B — Bid sent but none accepted
```
Last bid sent
12 May 25
```
- Same label style, date at `text-sm text-gray-800`

#### State C — No bids at all
```
No bid sent yet
```
- `text-xs text-gray-400`

#### Optional Remarks (appended to any state)
```
│ Remark text truncated to two lines…
```
- `border-l-2 border-gray-200 pl-2` — left-border quote style
- `line-clamp-2` — prevents overflow

---

### Region 3 — Footer Actions

```
┌─────────────────────────────────────────┐
│                         [ 👁 View ] [🗑] │
└─────────────────────────────────────────┘
```

Layout: `flex items-center justify-end gap-1` — all controls pushed to the right

- Entire footer wrapped in `stopPropagation` so clicks here never toggle card selection
- **View button** — text + icon, `hover:bg-gray-100`, opens the detail drawer/page
- **Delete button** — icon-only, `hover:bg-red-50 hover:text-red-500`, destructive colour on hover only (not at rest, to avoid alarm on non-destructive scanning)

---

### Sidebar — User Footer (Sidebar.tsx:178)

At the bottom of the dark sidebar (`bg-[#1e1e1e]`), separated by `border-t border-gray-700`:

```
┌──────────────────────────┐
│  [JB]  John Baidya       │  ← collapsed trigger
│        john@example.com  │
└──────────────────────────┘
         ↑ popup opens above (bottom-full, mb-2)
```

- User avatar is a `w-10 h-10 rounded-lg bg-gray-600` block showing initials
- Popup is `absolute bottom-full` — anchors above the footer trigger, inside a `relative` wrapper, with `z-50` to clear all sidebar content
- Popup itself mirrors the card style: dark surface, `border border-gray-700 rounded-xl shadow-2xl`

---

---

## Demand Enquiries — List Page

A full-page list view for browsing, filtering, and acting on demand enquiries. Follows a classic master-list pattern: toolbar on top, data table below.

---

### Page-Level Structure

```
┌──────────────────────────────────────────────────────────────┐
│  PAGE HEADER                        [ Refresh ] [+ New Enquiry] │
├──────────────────────────────────────────────────────────────┤
│  FILTER BAR            [Search…] [All sources ▾] [Date·Newest ▾]  ░░ │
├──────────────────────────────────────────────────────────────┤
│  STATUS TABS   [● All]  [Draft]  [Open]  [Closed]            │
├──────────────────────────────────────────────────────────────┤
│  DATA TABLE                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ▪ ID   CUSTOMER   SOURCE   ITEMS   GRAND TOTAL  STATUS  ACTIONS │
│  ├──────────────────────────────────────────────────────┤    │
│  │ □  DE-0019  Tata Steel…  Email   5/5 matched  ₹19,236  Draft  View 🗑 │
│  │ □  DE-0018  Tata Steel…  Email   5/5 matched  ₹19,236  Open   View 🗑 │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

### Region 1 — Page Header

```
Demand Enquiries                    [ ↻ Refresh ]  [+ New Enquiry]
19 enquiries
```

Layout: `flex items-start justify-between`

**Left** — title hierarchy:
- `h1` bold, large — page name
- Subtitle line `text-sm text-gray-500` — live count of records

**Right** — two action buttons:
- **Refresh** — ghost/outlined button with a circular-arrow icon; secondary action, low visual weight
- **+ New Enquiry** — filled black button (`bg-black text-white`); primary CTA, highest visual weight on the page

---

### Region 2 — Filter Bar

```
[ 🔍 Search customer… ]  [ All sources ▾ ]  [ Date · Newest ▾ ]       [ ≡ ] [ ⊞ ]
```

Layout: `flex items-center gap-3` with the view-toggle pushed to the far right via `ml-auto`

- **Search input** — left-anchored, leading search icon inside the field, placeholder `Search customer`; wider than the dropdowns to emphasise it as the primary filter
- **Source dropdown** (`All sources`) — contextual filter; arrow indicates interactivity
- **Sort dropdown** (`Date · Newest`) — compound label: field name + direction, separated by `·`; lets the user parse current sort at a glance without opening the menu
- **View toggle** (far right) — two icon buttons: list view (`≡`) and grid view (`⊞`); active view uses a filled/dark background, inactive is ghost

---

### Region 3 — Status Tabs

```
[● All]  [Draft]  [Open]  [Closed]
```

- Pill/tab row, inline `flex gap-2`
- Active tab: `bg-black text-white font-semibold rounded-full px-4 py-1`
- Inactive tabs: outlined or ghost, same pill shape — no underline pattern, preserves horizontal alignment
- Tabs act as a quick filter on top of the search/sort/source filters

---

### Region 4 — Data Table

#### Table Header Row

- Full-width dark bar (`bg-black text-white`)
- Columns (left → right): master checkbox · ID · CUSTOMER · SOURCE · ITEMS · GRAND TOTAL · STATUS · ACTIONS
- All labels `text-xs font-semibold uppercase tracking-wider`
- **GRAND TOTAL** and **ACTIONS** are right-aligned; all others left-aligned
- Master checkbox in the header selects/deselects all visible rows

#### Table Body Rows

Each row: `flex` or `grid` matching header columns, `border-b border-gray-100`, white background, subtle hover state

| Column | Content & Style |
|---|---|
| Checkbox | `h-4 w-4 rounded border-gray-300`; isolated from row-click to avoid conflicts |
| ID | Monospaced `DE-XXXX` — visually distinct identifier |
| Customer | Two-line cell: bold customer name on top, `text-sm text-gray-400` date below |
| Source | Pill badge with icon — **Email** uses amber/yellow outlined style (`border border-amber-400 text-amber-700 bg-amber-50`), rounded, with envelope icon |
| Items | `bold count / total text-gray-400 "matched"` — e.g. **5**/5 matched; bold vs muted split communicates matched vs expected |
| Grand Total | Right-aligned, `font-semibold`, `₹` prefix formatted with `en-IN` locale |
| Status | Pill badge, colour-coded: **Draft** = amber outlined, **Open** = green outlined/filled; no icon, text only |
| Actions | Right-aligned: `View` (eye icon + label, ghost button) + delete (trash icon only, appears on hover or always dimmed) |

#### Badge Colour System (consistent across table and cards)

| Status | Badge Style |
|---|---|
| Draft | Amber border + amber text + amber-50 bg |
| Open | Green border + green text + green-50 bg |
| Closed | Gray, muted |

---

### Interaction Model

- **Row click** — navigates to or opens the enquiry detail (same as View action)
- **Checkbox** — multi-select for bulk operations; isolated from row click via `stopPropagation`
- **Master checkbox** — header-level select-all
- **Delete** — icon-only, destructive colour on hover only; never red at rest to reduce cognitive alarm during scanning
- **Tabs + Search + Dropdowns** — all additive filters, applied simultaneously

---

### Design Tokens in Use

| Token | Usage |
|---|---|
| `border-secondary` | Selected card border accent |
| `accent-secondary` | Checkbox fill colour |
| `text-indigo-700` / `amber` / `purple` / `green` / `gray` | Status badge colours |
| `text-[11px]` / `text-[10px]` | Sub-label micro text |
| `font-mono` | Enquiry number to visually distinguish it as an ID |
