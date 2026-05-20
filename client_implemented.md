# Client — Implemented

Stack: **Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Zustand · Axios · Lucide React**

---

## Project Setup

| File | What it does |
|------|-------------|
| `package.json` | deps + scripts: `dev`, `build`, `start`, `lint` |
| `tsconfig.json` | strict TS, path alias `@/*` |
| `postcss.config.mjs` | Tailwind CSS v4 via `@tailwindcss/postcss` |
| `next.config.ts` | Next.js config (minimal) |
| `eslint.config.mjs` | ESLint with `eslint-config-next` |
| `.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3001` |

---

## App Router Pages

| Route | File | What it does |
|-------|------|--------------|
| `/` | `app/page.tsx` | Redirects to `/dashboard` |
| `/login` | `app/(auth)/login/page.tsx` | Login page — renders `<LoginForm>` |
| `/register` | `app/(auth)/register/page.tsx` | Register page — renders `<RegisterForm>` |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Welcome message with user's name |
| `/inventory/product-groups` | `app/(dashboard)/inventory/product-groups/page.tsx` | Full CRUD list page (table + grid view, create modal, delete, search, type filter, skeleton loading states) |
| `/inventory/product-groups/[id]` | `app/(dashboard)/inventory/product-groups/[id]/page.tsx` | Product group detail view |
| `/inventory/product-groups/[id]/edit` | `app/(dashboard)/inventory/product-groups/[id]/edit/page.tsx` | Product group edit form |
| `/settings/organization` | `app/(dashboard)/settings/organization/page.tsx` | Full org management: branches CRUD, system users CRUD, branch member assignment |

## Layouts

| File | What it sets up |
|------|----------------|
| `app/layout.tsx` | Root layout — Geist Sans + Geist Mono fonts, `ThemeProvider`, metadata |
| `app/globals.css` | Tailwind base + CSS custom properties for theming (light/dark) |
| `app/(auth)/layout.tsx` | Centered card layout for auth pages |
| `app/(dashboard)/layout.tsx` | Renders `<DashboardShell>` which guards auth and provides sidebar + topbar |

---

## State Management (Zustand)

| Store | File | What it manages |
|-------|------|----------------|
| `authStore` | `store/authStore.ts` | `token`, `refreshToken`, `user` — persisted to `localStorage` via `zustand/middleware/persist` |
| `themeStore` | `store/themeStore.ts` | `theme` (light / dark) toggle |
| `viewStore` | `store/viewStore.ts` | Per-page view preference (`list` / `grid`) keyed by page slug |

---

## API Client

| File | What it does |
|------|-------------|
| `lib/api.ts` | Axios instance with: request interceptor (attaches `Bearer <token>`), response interceptor (auto-refresh on 401 with request queue to prevent race conditions, redirects to `/login` on refresh failure) |

---

## API Modules

| File | Functions |
|------|-----------|
| `api/auth.ts` | `login(payload)`, `register(payload)` |
| `api/users.ts` | `getUsers()`, `getUserById(id)`, `createUser(payload)`, `updateUser(id, payload)`, `deleteUser(id)` |
| `api/subCompanies.ts` | `getSubCompanies()`, `getSubCompany(id)`, `createSubCompany(payload)`, `updateSubCompany(id, payload)`, `deleteSubCompany(id)`, `getSubCompanyMembers(id)`, `addSubCompanyMember(id, payload)`, `updateSubCompanyMember(id, userId, isPrimary)`, `removeSubCompanyMember(id, userId)` |
| `api/productGroups.ts` | `getProductGroups()`, `getProductGroup(id)`, `createProductGroup(payload)`, `updateProductGroup(id, payload)`, `deleteProductGroup(id)` |

---

## Types

| File | Types exported |
|------|---------------|
| `types/auth.ts` | `User`, `UserRole`, `AuthResponse`, `LoginPayload`, `RegisterPayload` |
| `types/subCompany.ts` | `SubCompany`, `SubCompanyMember`, `AddMemberPayload` |
| `types/productGroup.ts` | `ProductGroup`, `ProductGroupType`, `MaterialType`, `CreateProductGroupPayload`, `UpdateProductGroupPayload`, `PRODUCT_GROUP_TYPE_LABELS`, `MATERIAL_TYPE_LABELS` |

---

## Components

| File | What it renders |
|------|----------------|
| `components/auth/LoginForm.tsx` | Login form — email or phone + password, calls `login()`, stores tokens in `authStore`, redirects to `/dashboard` |
| `components/auth/RegisterForm.tsx` | Register form — name, email, phone, password, calls `register()`, auto-logs in |
| `components/layout/DashboardShell.tsx` | Auth guard (checks token expiry, redirects to `/login`), wraps pages in `<Topbar>` + `<Sidebar>` |
| `components/layout/Sidebar.tsx` | Navigation sidebar — role-aware links, minimize/expand, mobile overlay |
| `components/layout/Topbar.tsx` | Top navigation bar — hamburger menu trigger, theme toggle, user avatar/logout |
| `components/ui/Modal.tsx` | Reusable modal with title, close button, configurable max-width |
| `components/providers/ThemeProvider.tsx` | Applies `data-theme` attribute to `<html>` from `themeStore` |

---

## Utilities

| File | What it does |
|------|-------------|
| `utils/token.ts` | `isTokenExpired(token)` — decodes JWT and checks `exp` against current time |
