# TaskFlow API Reference

Base URL: `https://<host>/api`

All authenticated routes require:
```
Authorization: Bearer <jwt>
```

Responses share the shape:
```json
{ "success": true, ... }
```
On error:
```json
{ "success": false, "message": "..." }
```

---

## Roles & access

| Role | Can do |
|---|---|
| **Admin** | Everything across the org |
| **HOD** | Manage own department: tasks, teams, employees |
| **Employee** | View tasks they're involved in, update status, comment |

---

## Auth

### `POST /auth/signup`
Create the first Admin (gated by `ADMIN_SIGNUP_KEY`) or self-register an Employee. HOD signup is blocked — Admin must create HOD accounts.

Body:
```json
{
  "name": "Asha",
  "email": "asha@org.com",
  "password": "min8chars",
  "role": "Admin",
  "phone": "+919876543210",
  "adminKey": "<env ADMIN_SIGNUP_KEY>"
}
```
Returns `{ token, user }`.

### `POST /auth/login`
```json
{ "email": "asha@org.com", "password": "..." }
```
Returns `{ token, user }`.

### `GET /auth/me`
Returns the authenticated user (with department populated).

### `POST /auth/fcm-token`
Body: `{ "token": "<fcm token>" }`. Persists a device push token.

### `POST /auth/fcm-token/remove`
Body: `{ "token": "<fcm token>" }`. Removes a token (e.g. on logout).

---

## Users

### `GET /users`
Admin only org-wide. HOD scoped to own department.

Query: `role`, `department`, `q` (name/email search), `page`, `limit`.

### `POST /users` *(Admin)*
Create HOD or Employee. Body matches `User` model.

### `GET /users/:id`
Admin: any user. HOD: dept members. Employee: self only.

### `PUT /users/:id`
Admin: anything. HOD: limited dept fields. Employee: own `name`, `phone`, `password`.

### `DELETE /users/:id` *(Admin)*
Soft-delete (sets `isActive: false`).

---

## Departments

### `GET /departments`
List active departments.

### `POST /departments` *(Admin)*
```json
{ "name": "Engineering", "description": "...", "hod": "<userId>" }
```

### `GET /departments/:id`
Returns department + employees array.

### `PUT /departments/:id` *(Admin)*

### `DELETE /departments/:id` *(Admin)*
Soft-delete.

---

## Teams

### `GET /teams`
Scoped: HOD → own dept; Employee → teams they're in; Admin → all.

### `POST /teams` *(Admin / HOD)*
```json
{
  "name": "Frontend",
  "department": "<deptId>",
  "lead": "<userId>",
  "members": ["<userId>", "..."]
}
```

### `GET /teams/:id`

### `PUT /teams/:id` *(Admin / HOD)*

### `DELETE /teams/:id` *(Admin / HOD)*
Soft-delete + reconciles users' `teamIds`.

---

## Tasks

### `GET /tasks`
Visibility: Admin sees all; HOD sees dept + own; Employee sees tasks they
assigned, are assigned to, or are a team-member assignee of.

Query parameters:
- `status` — `Pending` | `In Progress` | `Completed`
- `priority` — `Low` | `Medium` | `High`
- `department`, `assignedToUser`, `assignedToTeam`
- `q` — text search on title/description
- `overdue=true` — only non-completed past-deadline tasks
- `page`, `limit`, `sort` (default `-createdAt`)

### `POST /tasks` *(Admin / HOD)*
Provide either `assignedToUser` OR `assignedToTeam` (not both).
```json
{
  "title": "Submit report",
  "description": "...",
  "assignedToUser": "<userId>",
  "priority": "High",
  "deadline": "2026-05-15T17:00:00Z"
}
```

### `GET /tasks/:id`
Populates assigner, assignee, department, and comment authors.

### `PUT /tasks/:id`
- Admin / assigner / HOD-of-dept can edit any field.
- Otherwise the assignee can update **status** only.

When status flips to `Completed`, `completedAt` is stamped automatically.

### `DELETE /tasks/:id`
Admin or original assigner.

### `POST /tasks/:id/comments`
```json
{ "text": "Working on this." }
```

### `POST /tasks/:id/attachments`
`multipart/form-data` with `file=<file>`. 10MB limit.

---

## Notifications

### `GET /notifications`
Query: `unreadOnly=true`, `page`, `limit`. Returns `{ data, unread, pagination }`.

### `PUT /notifications/:id/read`

### `PUT /notifications/read-all`

### `DELETE /notifications/:id`

---

## Dashboard

### `GET /dashboard/summary`
```json
{
  "summary": {
    "total": 142,
    "byStatus": { "Pending": 40, "In Progress": 60, "Completed": 42 },
    "byPriority": { "Low": 30, "Medium": 70, "High": 42 },
    "overdue": 8,
    "completionRate": 29.6,
    "perDepartment": [{ "_id": "...", "department": "Eng", "total": 60, "completed": 25, "overdue": 4 }]
  }
}
```
`perDepartment` is populated for Admin only.

### `GET /dashboard/productivity?days=30` *(Admin / HOD)*
Per-employee `total / completed / onTime / overdue / completionRate`.

### `GET /dashboard/activity?limit=50`
Audit trail. Admin sees org-wide; others see their own actions.

---

## WhatsApp

### `POST /whatsapp/inbound`
Twilio webhook. Receives `application/x-www-form-urlencoded` with `From`, `Body`. Replies with TwiML.

Supported message formats (sender must be a registered Admin/HOD by phone):
```
Assign task: Submit report by Friday to Rahul
Assign: Prepare quote by 2026-05-15 to priya@org.com priority high
New task: Inspect sample by tomorrow to +919999900000
```

Recognised deadlines: `today`, `tomorrow`, `eod`, weekday names, `YYYY-MM-DD`, `DD/MM/YYYY`, `in N days`.

### `POST /whatsapp/test/parse` *(Admin)*
```json
{ "message": "Assign task: ..." }
```
Returns the parser output without creating a task — useful for testing.

---

## Status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Validation / bad request |
| 401 | Not authenticated / token expired |
| 403 | Authenticated but not authorised |
| 404 | Not found |
| 409 | Duplicate (e.g. email already used) |
| 500 | Server error |

---

## cURL quick test

```bash
# Create the first admin
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@org.com","password":"admin1234","role":"Admin","adminKey":"change_me_only_used_for_first_admin"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@org.com","password":"admin1234"}' | jq -r .token)

# Create a department
curl -X POST http://localhost:5000/api/departments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Operations"}'

# Create a task
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Set up","assignedToUser":"<userId>","priority":"High"}'
```
