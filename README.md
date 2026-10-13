# Divyansh Srivastava · Portfolio + AI assistant

A one-page portfolio with:

- **AI assistant** that answers questions about your work from `profile.json`.
- **Routing to you.** Questions it shouldn't answer (salary, notice period, availability, anything not in your profile) and hiring or contact requests open a short form. The message, plus the chat transcript, arrives in your **email** and/or **Telegram**.
- **"Work with me" form** that changes its fields based on why someone is reaching out (hiring, project help, collaboration, other).
- **Safe fallbacks.** With no AI key, the assistant still answers common questions from `profile.json`. With no delivery channel set up, visitors get a pre-filled WhatsApp message and your email to copy.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole website (design, chat widget, forms) |
| `profile.json` | **Edit this** to change what the assistant knows, your contact details and suggested questions |
| `resume.pdf` | Linked from the "Resume" menu item. Replace with a newer version anytime |
| `api/chat.js` | Sends visitor questions to the AI |
| `api/contact.js` | Delivers messages to your email / Telegram |
| `api/health.js` | Tells the page which features are switched on |
| `admin.html` | Your private visitor dashboard |
| `api/track.js`, `api/stats.js` | Record anonymous visits/chats and serve the dashboard |
| `.env.example` | List of the settings (keys) you can add |

## Deploy on Vercel (free, about 15 minutes)

### 1. Get your keys

**AI (pick one; Gemini is free):**
1. Go to https://aistudio.google.com/apikey, sign in with Google, click **Create API key**.
2. Copy it. This is `GEMINI_API_KEY`.

**Email delivery (free):**
1. Sign up at https://resend.com **with the email where you want to receive messages** (for example divyanshsrivastava6528@gmail.com).
2. Go to **API Keys → Create API key**. This is `RESEND_API_KEY`.
3. `CONTACT_TO_EMAIL` = that same email. (To send to a different address you'd first verify your own domain in Resend.)

**Instant phone alerts on Telegram (optional, free):**
1. In Telegram, message **@BotFather**, send `/newbot`, follow the steps. It gives you a token: `TELEGRAM_BOT_TOKEN`.
2. Send any message to your new bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser. Find `"chat":{"id":123456789` — that number is `TELEGRAM_CHAT_ID`.

### 2. Put the site online

**Option A: GitHub + Vercel (recommended, auto-updates when you edit)**
1. Create a new repository on https://github.com/new (e.g. `portfolio`) and upload all files from this folder (keep the `api` folder structure).
2. Go to https://vercel.com/new, sign in with GitHub, and **Import** the repository. Framework preset: **Other**. No build command needed.
3. Before clicking **Deploy**, open **Environment Variables** and add the keys from step 1 (`GEMINI_API_KEY`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and optionally `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
4. Click **Deploy**. Your site is live at `https://<project>.vercel.app`.

**Option B: from your computer with the Vercel CLI** (needs Node.js 18+)
```bash
cd divyansh-portfolio
npx vercel            # log in, accept the defaults
npx vercel env add GEMINI_API_KEY      # repeat for each key
npx vercel --prod
```

### 3. Check it works
- Open `https://<your-site>/api/health`. You should see `"chat":true,"contact":true`.
- On the site, ask the assistant "What is his expected CTC?". It should offer to pass the question on. Fill in the form and check your inbox / Telegram.

### 4. Custom domain (optional)
In Vercel: **Project → Settings → Domains** and add a domain such as `divyansh.in`.

## Visitor dashboard

Open `https://<your-site>/admin.html` to see:
- visitors per day and how many of them chatted with the assistant
- where visitors came from (LinkedIn, Naukri, Google, your own tracking links)
- a visit → opened chat → asked → messaged you funnel
- recent visits (time, source, city, device, whether they chatted, opened your resume or messaged you)
- every question people asked the assistant, marked "Answered" or "Routed to you"

**Set it up once (free):**
1. In Vercel, open your project → **Storage** → **Create Database** → choose **Upstash for Redis** (free plan) → connect it to the project. This adds the database keys automatically.
2. In **Settings → Environment Variables**, add `ADMIN_KEY` with a long password only you know.
3. **Redeploy** (Deployments → ⋯ → Redeploy). Then open `/admin.html` and enter the password.

**Know which link people clicked:** the dashboard lists tracking links like `https://<your-site>/?src=naukri`. Put a different one on LinkedIn, Naukri, your resume and your email signature, and the "Where visitors came from" panel will show which one brings people.

Visitors stay anonymous: no names or emails are collected unless someone sends you a message. Bots and link previews are filtered out.

## Try it on your computer first
```bash
cp .env.example .env     # fill in your keys
npm run dev              # open http://localhost:3000
```

## Customising
- **What the assistant knows:** edit `facts` in `profile.json`. It will only state what's there.
- **What it always sends to you:** edit `handoffTopics`.
- **Offline answers** (used when AI is off or busy): edit `intents`.
- **Hide your phone number:** remove the phone row in `index.html` (search for `vPhone`) and clear `phone` in `profile.json`. WhatsApp uses the `whatsapp` field.
- **Other AI providers:** set `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` with `OPENAI_BASE_URL` for any OpenAI-compatible service such as Groq. See `.env.example`.

## Safety built in
- Assistant is limited to facts in `profile.json` and told not to invent salaries, dates or projects.
- Visitor messages are capped in length; basic per-visitor rate limits on chat (30 / 10 min) and contact (6 / 10 min).
- API keys stay on the server and are never sent to the browser.
