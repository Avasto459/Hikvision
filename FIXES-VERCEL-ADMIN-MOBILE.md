# HASI.TJ — Vercel admin/auth and mobile fixes

## Admin bootstrap
- The first database initialization now provisions `najmiddinovavasto5@gmail.com` and the configured/default admin address (`admin@hasi.tj` when no admin email env var is set).
- Existing rows are restored to `ADMIN`, unblocked, email-verified, and their password hash is refreshed to the configured admin password or `admin123` by default.
- Login invokes database initialization before looking up credentials, so the Turso schema and admin seed are initialized on the first login/API access that touches the database.

Default credentials when no admin password environment variable is set:
- Email: `najmiddinovavasto5@gmail.com`
- Password: `admin123`

For production, change the password immediately after signing in and preferably set `HASI_ADMIN_PASSWORD` to a strong secret in Vercel Environment Variables.

## Stale sessions
- `/api/profile` and `GET /api/auth/login` return a `401` with `redirectTo: /login` and `clearToken: true` for stale/missing users and clear the `hasi-session` cookie.
- The admin page clears its stale browser token before redirecting to login.
- A primary admin token whose database ID changed can be recovered by the canonical admin email after seeding.

## Admin product search
- Product management now filters instantly by product name, SKU/article number, slug, or brand and shows the number of matches.

## Mobile layout
- Reduced small-screen horizontal padding and vertical spacing on the home/catalog/admin pages.
- Headings scale down and wrap safely; product grids use tighter mobile gaps.

## Verification
- Changed TypeScript/TSX files passed syntax transpilation.
- Run `npm ci` then `npm run build` locally before deploying; production build was not run as part of this patch.
