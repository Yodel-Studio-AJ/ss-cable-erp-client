# Client — To Be Implemented

Update this file as pages/components get built. Move finished items to `client_implemented.md`.

---

## Dashboard

- [ ] `/dashboard` — real stats overview (sales, stock, staff count across sub-companies)
- [ ] `/dashboard/compare` — side-by-side comparison of sub-companies

## Dedicated Management Pages

The Organization settings page covers basic CRUD, but these dedicated pages are still needed:

- [ ] `/users` — full user list page with search/filter
- [ ] `/users/:id` — user detail / edit page
- [ ] `/sub-companies` — dedicated sub-company list page
- [ ] `/sub-companies/:id` — sub-company detail page with stats

## Profile

- [ ] `/profile` — view and edit own profile (name, email, phone)
- [ ] `/profile/change-password` — change password form (calls `PATCH /api/auth/me/password`)

## Infrastructure

- [ ] Toast / notification system — replace current inline `setError` pattern with a global toast for API errors and successes
- [ ] Pagination for list views (product groups, users, sub-companies)
- [ ] Role-based UI guards — hide/show actions based on `user.role` (e.g. delete buttons for owner only)

## Domain Pages (future, depends on server domain tables)

- [ ] `/inventory` — inventory overview
- [ ] Purchase orders
- [ ] Sales / transactions
- [ ] Supplier management
- [ ] Reports
