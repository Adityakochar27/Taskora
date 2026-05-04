# TaskFlow — Organizational Task Management Platform

A production-ready, role-based task management SaaS for organizations. Built with the **MERN** stack, JWT + RBAC, Firebase Cloud Messaging push notifications, and a Twilio-backed WhatsApp integration that can both *send* reminders and *parse* incoming messages into tasks.

## Highlights

- **Roles**: Admin (MD/HR), HOD, Employee — with granular RBAC middleware.
- **Departments + Teams**: HOD assignment, employee-to-department mapping, multi-employee teams.
- **Tasks**: assign to user OR team, priority, deadline, status, comments, attachments, activity log.
- **Notifications**: in-app, FCM push, WhatsApp.
- **WhatsApp NLP**: incoming messages like *"Assign task: Submit report by Friday to Rahul"* are parsed and converted into DB tasks via webhook.
- **Mobile-first PWA**: installable, offline shell, responsive Tailwind UI.
- **Dashboards**: org-wide and per-department analytics, overdue tracking, productivity.

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18 (Vite) + Tailwind CSS + React Router + Axios + Context API |
| Backend | Node.js 20 + Express 4 |
| Database | MongoDB + Mongoose |
| Auth | JWT (access tokens) + bcrypt |
| Push | Firebase Cloud Messaging |
| WhatsApp | Twilio API (with vendor-agnostic abstraction layer) |
| Deployment | Render (API), Vercel (web), MongoDB Atlas |

## Folder Structure

```
task-management-system/
├── client/                       React PWA frontend
│   ├── public/                   Static assets, manifest.json, service worker
│   └── src/
│       ├── components/           Reusable UI components
│       ├── pages/                Route pages (Login, Dashboard, Tasks, ...)
│       ├── hooks/                Custom hooks (useAuth, useFetch)
│       ├── services/             API clients (axios)
│       └── context/              Auth + Notification context providers
├── server/                       Express API
│   ├── config/                   DB + Firebase + Twilio config
│   ├── controllers/              Route handlers
│   ├── models/                   Mongoose schemas
│   ├── routes/                   Express routers
│   ├── middlewares/              Auth, RBAC, error handling
│   ├── services/                 WhatsApp, FCM, NLP parser
│   └── utils/                    JWT, async wrapper, logger
└── docs/
    └── API.md                    Full REST API reference
```

## Quick Start (local)

### Prerequisites
- Node.js 20+
- MongoDB running locally or a MongoDB Atlas connection string
- (Optional for full feature parity) Firebase project, Twilio account

### Option A — Docker compose (simplest)
```bash
docker compose up                       # boots Mongo + API on :5000
docker compose run --rm api npm run seed  # populate demo data
cd client && cp .env.example .env && npm install && npm run dev
```

### Option B — Run everything locally
```bash
# Backend
cd server
cp .env.example .env          # then fill in values
npm install
npm run seed                  # optional — creates demo org with 7 users + 5 tasks
npm run dev                   # nodemon on :5000

# Frontend (in a second terminal)
cd client
cp .env.example .env
npm install
npm run dev                   # Vite on :5173
```

The frontend proxies `/api/*` to `http://localhost:5000` during development.

### Demo credentials (after seeding)
| Role | Email | Password |
|---|---|---|
| Admin | `admin@taskflow.dev` | `admin1234` |
| HOD (Eng) | `priya@taskflow.dev` | `priya1234` |
| HOD (Ops) | `rahul@taskflow.dev` | `rahul1234` |
| Employee | `asha@taskflow.dev` | `asha1234` |
| Employee | `karan@taskflow.dev` | `karan1234` |

### First admin without seeding
With the API running:
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@org.com","password":"admin1234","role":"Admin","adminKey":"<value of ADMIN_SIGNUP_KEY>"}'
```

> Self-signup as Admin is gated by the `ADMIN_SIGNUP_KEY` env var. Once one Admin exists, further admin/HOD accounts must be created via the Admin panel.

### Tests
```bash
cd server && npm test    # parser + utility tests via node:test
```

## Deployment

The included blueprint deploys both the API and the web frontend on Render in one click. **Full step-by-step walkthrough**: [`DEPLOY-RENDER.md`](DEPLOY-RENDER.md).

### Quick version

1. Push the repo to GitHub.
2. Create a free [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster — copy the connection string.
3. On [Render](https://render.com): **New → Blueprint** → connect the repo. The [`render.yaml`](render.yaml) provisions:
   - `taskflow-api` (Node web service, root `server/`)
   - `taskflow-web` (static site, root `client/`)
4. When prompted, paste in `MONGO_URI`, set `CLIENT_ORIGIN` to your web URL (`https://taskflow-web.onrender.com`), and `VITE_API_BASE` to your API URL + `/api`.
5. Deploy. Manual-redeploy the static site if you change `VITE_API_BASE` (Vite bakes env vars in at build time).
6. Sign up the first admin via the web UI using the auto-generated `ADMIN_SIGNUP_KEY` from the API's env vars, OR run `npm run seed` from the API service's Shell tab.

### Optional integrations

- **Push notifications via Firebase** — see [`DEPLOY-RENDER.md` § 7](DEPLOY-RENDER.md#7-optional-push-notifications-via-firebase).
- **WhatsApp via Twilio** — see [`DEPLOY-RENDER.md` § 8](DEPLOY-RENDER.md#8-optional-whatsapp-via-twilio).
- **Native phone app** — see [`MOBILE.md`](MOBILE.md) for both PWA install (5 minutes) and Capacitor wrap for the Play Store.

## Documentation

- **API Reference** → [`docs/API.md`](docs/API.md)
- **Environment Variables** → [`server/.env.example`](server/.env.example), [`client/.env.example`](client/.env.example)

## License
MIT
