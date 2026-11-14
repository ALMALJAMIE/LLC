# LLC — Language Leap Center

> Your leap to fluent English

Learning-management platform for Language Leap Center with four portals: **Student**, **Instructor**, **Agent** and **Admin**. Layout and workflow follow the reference platform supplied by the center; identity (logo, colours) is LLC's.

## Stack

| Library | Role |
|---|---|
| React 19 + Vite + TypeScript | App (single-page, static hosting) |
| Tailwind CSS 4 | Styling — `indigo` is mapped to LLC blue, `orange` to LLC gold (`src/index.css`) |
| React Router | Routing (`src/routes.gen.tsx`) |
| Zustand | Session state |
| Supabase | Database + authentication (next phase) |
| lucide-react | Icons |

## Structure

- `src/pages/student|instructor|agent|admin/` — one file per screen (100 screens)
- `src/components/layout/` — sidebar + top bar shared by all portals
- `src/lib/nav.ts` — sidebar menus for each role
- `src/components/media.tsx` — LLC logo, illustrations, avatars, course covers

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Demo sign-in: open `/login` and pick a portal.

## Deploy

Every push to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).
One-time setting: **Settings → Pages → Source: GitHub Actions**.
