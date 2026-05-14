# Client — To Be Implemented

Update this file as pages/components get built. Move finished items to `client_implemented.md`.

---

## Auth Pages

- [ ] `/login` — login form (email or phone + password), stores JWT in `localStorage` / cookie
- [ ] Redirect unauthenticated users to `/login`
- [ ] Auth context / provider — exposes current user + token to the app
- [ ] API client utility (`lib/api.ts`) — attaches Bearer token to all requests

## Owner Dashboard

- [ ] `/dashboard` — overview across all sub-companies (sales, stock, staff count)
- [ ] `/dashboard/compare` — side-by-side comparison of sub-companies

## Sub-Company Pages (admin / floor_manager / member see only their own)

- [ ] `/sub-companies` — list all sub-companies (owner)
- [ ] `/sub-companies/:id` — detail page for a single sub-company
- [ ] `/sub-companies/:id/users` — manage users in this sub-company

## User Management

- [ ] `/users` — list users (owner sees all, admin sees own sub-company)
- [ ] `/users/:id` — user detail / edit
- [ ] `/users/new` — create user form

## Profile

- [ ] `/profile` — view and edit own profile
- [ ] `/profile/change-password` — change password form

## Infrastructure

- [ ] Role-based route guards (middleware or `layout.tsx` checks)
- [ ] Toast / notification system for API errors and successes
- [ ] Loading skeletons for data-fetching pages
- [ ] Shared navigation sidebar with role-aware links
