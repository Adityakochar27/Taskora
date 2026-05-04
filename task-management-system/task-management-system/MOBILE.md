# Running TaskFlow as a phone app

There are **two ways** to get TaskFlow on your phone. Pick based on what you want:

| | Path A: PWA install | Path B: Native app |
|---|---|---|
| Time to working app | ~5 min after deploy | 1–2 hrs first time |
| Looks/feels native? | Yes (fullscreen, icon, push) | Yes |
| Distribute via Play Store / App Store? | No | Yes |
| Needs Android Studio / Xcode? | No | Yes |
| Push notifications? | Yes (FCM web push) | Yes (FCM/APNs native) |
| iOS support | Yes (16.4+ for push) | Yes |

**If you just want it on your own phone, do Path A.**
**If you want it in the Play Store or APK distributed to staff, do Path B.**

---

## Path A — PWA install (fastest)

### 1. Deploy somewhere with HTTPS
Phones won't install a PWA over `http://localhost`. You need a real domain.

The cheapest production-grade combo (all free tier):
- **Backend** → Render (use the included `render.yaml` blueprint)
- **Frontend** → Vercel (use the included `client/vercel.json`)
- **Database** → MongoDB Atlas M0

See the main `README.md` deployment section for click-by-click instructions. After deploying, set the frontend env var `VITE_API_BASE=https://<your-render-host>/api` and redeploy.

### 2. Install on your phone

**Android (Chrome / Edge / Samsung Browser):**
1. Open the deployed URL.
2. After ~10 seconds Chrome shows an "Install app" banner — tap it.
3. Or: tap the ⋮ menu → "Install app" / "Add to Home Screen".
4. Done. Launch from your home screen — it opens fullscreen, no browser chrome.

**iOS (Safari only — Chrome on iOS doesn't support PWA install):**
1. Open the deployed URL in Safari.
2. Tap the Share button → scroll → "Add to Home Screen".
3. Tap "Add". Launch from home screen.

### 3. Enable push notifications (optional)
Set up Firebase as described in the main README, fill in `VITE_FIREBASE_*` in your Vercel env, and redeploy. After your next visit the app will ask permission for notifications.

---

## Path B — Native app via Capacitor

This produces a real `.apk` / `.aab` / `.ipa` you can install or publish. Capacitor is already configured in `client/capacitor.config.ts`.

### Prerequisites

- Everything in Path A (you still need a deployed API for the app to talk to).
- **For Android**: install [Android Studio](https://developer.android.com/studio) and JDK 17.
- **For iOS**: a Mac with Xcode 15+. iOS-only — can't be done from Windows/Linux.

### One-time setup

```bash
cd client

# 1. Install all deps (capacitor packages are already in package.json)
npm install

# 2. Point the web build at your live API (NOT localhost — the phone can't reach your laptop)
echo "VITE_API_BASE=https://your-api.example.com/api" > .env.production

# 3. Build the web bundle that gets packaged into the app
npm run build

# 4. Add Android (and/or iOS) platform — creates client/android/ and client/ios/
npx cap add android
npx cap add ios          # macOS only

# 5. Copy the web build into the native projects
npx cap sync
```

### Build & install on Android

```bash
npm run cap:android       # rebuilds web, syncs, opens Android Studio
```

In Android Studio:
1. Wait for Gradle sync to finish (first time: 5–10 min).
2. Plug in your Android phone with USB debugging on, **OR** start an emulator.
3. Click ▶ "Run". The app installs and launches.

To get an installable APK:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
- Output lands in `client/android/app/build/outputs/apk/debug/app-debug.apk`.
- Sideload onto any Android phone (enable "Install from unknown sources").

For Play Store: **Build → Generate Signed Bundle / APK → Android App Bundle**, follow the signing wizard.

### Build & install on iOS

```bash
npm run cap:ios           # opens Xcode
```

In Xcode:
1. Select your team under Signing & Capabilities.
2. Connect an iPhone or pick a simulator.
3. Click ▶ Run.

For App Store: **Product → Archive**, then upload via the Organizer window.

### Push notifications on native

The client's `pushService.js` auto-detects native vs web and uses
`@capacitor/push-notifications` on Android/iOS. To make this work end-to-end:

**Android (FCM):**
1. In Firebase Console → Project Settings → Add App → Android.
2. Download `google-services.json` and drop it in `client/android/app/`.
3. Run `npx cap sync` again. That's it — your existing `FIREBASE_SERVICE_ACCOUNT` on the backend already sends to this app's tokens.

**iOS (APNs):**
1. In Apple Developer Portal: enable Push Notifications capability for your app ID.
2. Generate an APNs auth key.
3. In Firebase Console → Cloud Messaging → upload that key.
4. In Xcode: Signing & Capabilities → + Capability → Push Notifications.
5. Run `npx cap sync ios`.

### Live-reload during development

Instead of rebuilding the bundle every time, point Capacitor at your dev server:

```bash
# In one terminal
cd client && npm run dev          # Vite on :5173

# Find your laptop's LAN IP (e.g. 192.168.1.42)
# Edit client/capacitor.config.ts, add:
#   server: { url: 'http://192.168.1.42:5173', cleartext: true }
# (Set allowMixedContent: true under android: {} as well)
```

Then `npx cap run android` — the app loads from your Vite server, hot reload works on your phone. **Remove these settings before building for release.**

---

## Troubleshooting

- **PWA install banner doesn't show on Android.** The browser only prompts after some user engagement and only on HTTPS. Try ⋮ menu → Install app.
- **App can't reach the API on phone.** `localhost` from the phone means *the phone itself*, not your laptop. Use your LAN IP for dev or a deployed URL for release.
- **"Mixed content blocked" in Capacitor.** Your web bundle is HTTPS but the API is HTTP. Either use HTTPS for the API, or set `allowMixedContent: true` (dev only — never ship this).
- **Capacitor build fails on first `cap add android`.** Almost always missing JDK or `ANDROID_HOME`. Confirm `java -version` shows 17+ and that Android Studio's SDK Manager has installed the platform tools.
- **iOS Safari doesn't show "Add to Home Screen".** Must be Safari (not Chrome on iOS — they're forced to use the same engine but Chrome's UI hides the option).
