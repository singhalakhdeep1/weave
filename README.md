# Weave

A real-time collaborative documents workspace. Write together in the same page, keep a history, comment, share, and work offline.

React + Tiptap + Yjs on the client; Express, Prisma/PostgreSQL and Hocuspocus (Yjs over WebSocket) on the server.

## Features

- **Live co-editing**: everyone in a page sees edits, cursors and presence instantly (CRDT, so concurrent edits merge without conflicts).
- **Offline-first**: a copy of every opened page is kept in the browser (IndexedDB). You can open and edit pages with no connection; changes sync when you are back online. The header shows *Live* or *Offline*.
- **Rich text**: headings, bold / italic / underline / strike / highlight / inline code, links, bullet / numbered / to-do lists, quotes, code blocks, dividers. Toolbar plus a `/` command menu.
- **Workspaces and roles**: owners manage members and settings, editors change pages, viewers read and comment. Add people by the email of an existing account.
- **Page tree**: nested pages, drag a page onto another to move it, icons, breadcrumbs, templates (meeting notes, project plan, weekly to-do).
- **Comments**: threaded, quote the selected text, resolve and reopen.
- **Version history**: automatic snapshots (every 10 minutes of activity), named snapshots, preview, and one-click restore that updates everyone's open editor live. Restoring saves the current content first, so it can be undone.
- **Sharing**: a public read-only link per page that you can switch off at any time. Export to Markdown or HTML, or print / save as PDF.
- **Search** (Ctrl/Cmd + K) over titles and page content. **Trash** with restore and permanent delete.
- **Accounts**: sign up / sign in with short-lived access tokens and rotating, revocable refresh cookies; change password, delete account. Dark mode, responsive layout.

Not included: email invitations and password reset by email (members are added by the email of an existing account), image uploads, per-page permissions.

## Run locally

Prerequisites: Node 20+, PostgreSQL (UTF-8).

```bash
# backend
cd backend
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npx prisma migrate deploy
npm run prisma:seed           # optional demo team (alice@weave.dev / bob@weave.dev, password Password123)
npm run dev                   # http://localhost:5001

# frontend (second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

In development Vite proxies `/api` and `/collab` to the backend, so no extra configuration is needed. Open the page in two browsers (or one normal and one private window, signed in as different users) to see live cursors.

### Docker

```bash
cp backend/.env.example backend/.env    # fill in the two JWT secrets
docker compose up --build
# open http://localhost:8080
```

nginx serves the app and proxies the API and the collaboration socket, so everything is same-origin.

## How it works

- Each page is a Yjs document. Clients connect to `ws://host/collab`; the server (Hocuspocus) authenticates the token in the first message, checks workspace membership and grants **read-only connections to viewers**.
- The document is persisted as Yjs binary (`documents.ydoc`) after edits settle, together with extracted plain text for search. Version snapshots are stored the same way.
- HTML / Markdown for export, previews and public pages is generated on the server from the same editor schema the client uses, and links with unsafe schemes are neutralised.
- The access token lives only in memory; the refresh token is an httpOnly cookie stored hashed on the server and rotated on every use (reusing a spent token signs that user out everywhere). The WebSocket requests a fresh token on every reconnect.

```
backend/
  prisma/             schema, migration, seed
  src/
    collab.ts         Hocuspocus server (auth, roles, persistence, auto-versions)
    lib/              editor schema + conversions, access checks, tokens
    routes/           auth, workspaces, documents, comments, public
frontend/
  src/
    components/       Editor (Tiptap + Yjs), Sidebar, panels
    pages/            home, document, trash, settings, shared page
    lib/              API client with token refresh, auth context
```

## Scripts

Root: `npm run typecheck`, `npm run build`. Backend: `npm run dev`, `npm run prisma:migrate`, `npm run prisma:seed`. Frontend: `npm run dev`, `npm run typecheck`.

## Security notes

Passwords are bcrypt-hashed; credential endpoints are rate limited; all input is validated with Zod; workspace membership is checked on every REST call and on every WebSocket connection; non-members get 404 rather than 403 so workspace ids cannot be probed.

## License

Proprietary. All rights reserved.
