# Deploying TaskFlow on Render (frontend + backend)

End-to-end recipe for: GitHub → Render Blueprint → working app on the internet. About **30 minutes** the first time.

You'll end up with three things running:
- **taskflow-api** — your Express API (Render web service)
- **taskflow-web** — your React PWA (Render static site)
- **MongoDB Atlas M0** — your database (free tier, hosted by MongoDB)

---

## 0. Prerequisites
- A GitHub account
- A [Render](https://render.com) account (free signup, no card required for free services)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (free signup)
- Git installed locally

---

## 1. Push the code to a new GitHub repo

```bash
# From inside the unzipped task-management-system folder
git init
git add .
git commit -m "Initial commit: TaskFlow MVP"

# Create the empty repo on GitHub first (no README, no .gitignore — they're already in the zip)
# Then:
git branch -M main
git remote add origin https://github.com/<your-username>/taskflow.git
git push -u origin main
```

> If you don't want to type your GitHub password every time, set up [SSH keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) or a [Personal Access Token](https://github.com/settings/tokens) and use it as the password.

---

## 2. Create a MongoDB Atlas cluster

1. Sign in to [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Create → Deployment → M0 (Free)**. Pick a region close to your Render region (Singapore if you're in India).
3. **Database Access** → Add Database User → username `taskflow` and a strong auto-generated password. **Copy this password somewhere safe.**
4. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`). For production later you'd restrict this; for now Render's egress IPs are dynamic so wide-open is the practical choice.
5. **Database** → Connect → Drivers → copy the connection string. It looks like:
   ```
   mongodb+srv://taskflow:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with the password you saved, and add `taskflow` as the database name before the `?`:
   ```
   mongodb+srv://taskflow:realpassword@cluster0.xxxxx.mongodb.net/taskflow?retryWrites=true&w=majority
   ```
   **Save this — it's your `MONGO_URI`.**

---

## 3. Deploy on Render via Blueprint

1. Sign in to [dashboard.render.com](https://dashboard.render.com).
2. **New → Blueprint** in the top right.
3. Connect your GitHub account if you haven't already, then pick your `taskflow` repo.
4. Render reads `render.yaml` and shows you both services that will be created — `taskflow-api` and `taskflow-web`.
5. It also asks for the values of the env vars marked `sync: false`. Fill these in:

   **For `taskflow-api`:**
   | Variable | Value |
   |---|---|
   | `MONGO_URI` | The full Atlas string from step 2 |
   | `CLIENT_ORIGIN` | `https://taskflow-web.onrender.com` (best guess — we'll verify in step 4) |
   | `FIREBASE_SERVICE_ACCOUNT` | Leave blank for now, fill in later when you set up push |
   | `TWILIO_*` | Leave blank for now |

   **For `taskflow-web`:**
   | Variable | Value |
   |---|---|
   | `VITE_API_BASE` | `https://taskflow-api.onrender.com/api` (best guess — we'll verify) |
   | `VITE_FIREBASE_*` | Leave blank for now |

6. Click **Apply**. Render starts provisioning.
7. Watch the logs. The API takes ~3 minutes to build and boot. The static site takes ~2 minutes.

---

## 4. Verify the URLs and fix env vars if needed

After both services finish deploying:

1. Open `taskflow-api` in the Render dashboard. Look at the URL near the top — it'll be something like `https://taskflow-api.onrender.com` (or `https://taskflow-api-abcd.onrender.com` if the simple name was already taken globally).
2. Open `taskflow-web` and note its URL.
3. **If either URL doesn't match what you guessed in step 3**, update the env vars:
   - On `taskflow-api`: set `CLIENT_ORIGIN` to the actual `taskflow-web` URL.
   - On `taskflow-web`: set `VITE_API_BASE` to `<actual-api-url>/api` and click **Manual Deploy → Deploy latest commit** (Vite needs a rebuild — it bakes env vars in at build time).
4. Test the API: open `<api-url>/api/health` in your browser — you should see `{"status":"ok",...}`.
5. Test the web: open the `taskflow-web` URL — you should see the login screen.

---

## 5. Create your first admin

The login screen needs an account. Two options:

**Option A: Web signup (easiest)**
1. On the login page, click "Create an account".
2. Fill in name/email/password, **change Role to `Admin`**.
3. In the "Admin signup key" field, paste the value of `ADMIN_SIGNUP_KEY` from your Render dashboard (it's auto-generated and visible under taskflow-api → Environment).
4. Submit. You're in.

**Option B: Run the seed script (gets you sample data)**
1. In Render, open `taskflow-api` → **Shell** tab.
2. Run: `npm run seed`
3. You'll see seven demo accounts created — log in with `admin@taskflow.dev` / `admin1234`.

> The seed script is idempotent — safe to run multiple times.

---

## 6. (Optional) Custom domains

In each service: **Settings → Custom Domains → Add**. Render gives you a CNAME / ALIAS target. Add it at your registrar, wait for DNS propagation, done. SSL is automatic via Let's Encrypt.

If you add custom domains, **update `CLIENT_ORIGIN` on the API and `VITE_API_BASE` on the web**, then redeploy the web service.

---

## 7. (Optional) Push notifications via Firebase

Only do this once the basic app is working.

1. [Firebase Console](https://console.firebase.google.com) → Add Project → name it (e.g. `taskflow`).
2. **Project Settings → General → Your apps → Add app → Web**. Copy the config object — you'll need each value for the `VITE_FIREBASE_*` env vars on `taskflow-web`.
3. **Project Settings → Cloud Messaging → Web Push certificates → Generate key pair**. Copy the value into `VITE_FIREBASE_VAPID_KEY` on `taskflow-web`.
4. **Project Settings → Service Accounts → Generate new private key**. Open the downloaded JSON, copy its full contents (one line), paste into `FIREBASE_SERVICE_ACCOUNT` on `taskflow-api`.
5. Manual deploy both services. Visit the web app on your phone — it should ask permission for notifications.

---

## 8. (Optional) WhatsApp via Twilio

1. [Twilio Console](https://console.twilio.com) → grab your `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`. Set those on `taskflow-api`.
2. Activate the WhatsApp sandbox: **Messaging → Try it out → Send a WhatsApp message**. Copy the sandbox number into `TWILIO_WHATSAPP_FROM` (format: `whatsapp:+14155238886`).
3. In the sandbox config, set the inbound webhook to: `https://<api-url>/api/whatsapp/inbound` (POST).
4. Manual deploy the API.
5. Send "hi" from your registered WhatsApp to the sandbox number. The bot replies with usage instructions.

---

## Free tier gotchas

Render's free tier sleeps your web service after ~15 minutes of inactivity. The first request after a sleep takes ~30 seconds while it spins back up. Two ways to handle this:

- **Accept it.** It's fine for an internal tool used a few times a day.
- **Upgrade to Starter ($7/month).** Always-on, no cold starts. The blueprint already specifies `plan: starter` for the API since cold-starting an API mid-request is uglier than a slow-loading web page. Change to `plan: free` in `render.yaml` if you'd rather save the $7.

Static sites (the frontend) are free forever and don't sleep.

MongoDB Atlas M0 has a 512MB storage cap — plenty for thousands of tasks, but worth knowing.

---

## Common issues

**"CORS error" in browser console.** `CLIENT_ORIGIN` on the API doesn't match the web URL exactly. Must be `https://...` with no trailing slash.

**Login works but tasks page shows nothing.** `VITE_API_BASE` on the web is probably wrong or wasn't picked up. Check the browser Network tab — what URL is it hitting? Update env var, **manually redeploy** the static site (env vars are baked in at build time).

**500 errors on every API call.** Check the API logs in Render. Almost always: `MONGO_URI` typo or Atlas IP whitelist issue. Verify by clicking "Connect" in Atlas and checking the IP that shows up.

**Seeding fails with "duplicate key".** You've already seeded; the script is idempotent for users but skips creating sample tasks if any exist. Drop the `tasks` collection in Atlas if you want fresh sample data.

**Render keeps redeploying on every push.** That's by design (auto-deploy on git push to main). Disable in **Settings → Build & Deploy → Auto-Deploy** if you want manual control.
