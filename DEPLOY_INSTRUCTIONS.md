# Collier Falls RSVP — Deployment Guide
## Vercel + Airtable Setup

---

## OVERVIEW
Here's what you're building:
- **Airtable** = your database (free spreadsheet in the cloud where RSVPs land)
- **Vercel** = your web host (makes the site live at a public URL)
- **GitHub** = middle layer that connects your code to Vercel

Total time: ~25 minutes, no coding required.

---

## PART 1 — SET UP AIRTABLE (your database)

### Step 1 — Create a free Airtable account
1. Go to **airtable.com** and click **Sign up for free**
2. Sign up with your email or Google account

### Step 2 — Create a new base
1. Once logged in, you'll be on the Airtable homepage
2. Click the **+ Create** button
3. Select your workspace (or use the default one)
4. You'll see a few options — choose **"Start from scratch"**
   > Note: Airtable may offer "Build an app with AI" or other options — ignore those and pick "Start from scratch"
5. Name the base: `Collier Falls RSVPs`

### Step 3 — Set up the table columns
Your new base will have a default table. Rename it to `RSVPs` by double-clicking the tab name at the bottom of the screen.

Now set up the following fields. Click the **+** button to add each new field and choose the correct field type:

| Field Name            | Field Type           |
|-----------------------|----------------------|
| First Name            | Single line text     |
| Last Name             | Single line text     |
| Email                 | Email                |
| Phone                 | Phone number         |
| Plus Count            | Number               |
| Guest Names           | Long text            |
| Host Dietary          | Single line text     |
| Guest Dietary         | Long text            |
| Host Waiver Signed    | Checkbox             |
| Host Signature        | Single line text     |
| Host Waiver Timestamp | Single line text     |
| Guest Waivers         | Long text            |
| Total in Party        | Number               |
| Submitted At          | Single line text     |

> Tip: Delete any default columns Airtable pre-created (like Notes, Attachments, Status) by right-clicking them → Delete field.

### Step 4 — Get your Personal Access Token (API key)
1. Click your **profile avatar** (top-right corner of any Airtable page)
2. Select **"Builder hub"** from the dropdown menu
3. In the left sidebar, under the **"Developers"** section, click **"Personal access tokens"**
4. Click **"+ Create new token"**
5. Give it a name: `collier-falls-rsvp`
6. Under **Scopes**, click **"+ Add a scope"** and add both:
   - `data.records:read`
   - `data.records:write`
7. Under **Access**, click **"+ Add a base"** and select your `Collier Falls RSVPs` base
8. Click **"Create token"**
9. **Copy the token immediately and save it somewhere safe** — Airtable will only show it once!
   It will look like: `patXXXXXXXXXXXXXX.XXXXXXXX...`

### Step 5 — Get your Base ID
1. Go back to your `Collier Falls RSVPs` base
2. Look at the URL in your browser — it looks like:
   `https://airtable.com/appXXXXXXXXXXXXXX/tbl.../...`
3. Copy the segment that starts with **app** (e.g. `appABC123XYZ456`) — that's your **Base ID**

---

## PART 2 — SET UP YOUR CODE

### Step 6 — Install Node.js (one-time setup)
1. Go to **nodejs.org**
2. Download the **LTS** version (the left button)
3. Run the installer — click Next through all steps
4. Open **Terminal** (Mac) or **Command Prompt** (Windows)
5. Type `node --version` and press Enter — you should see `v20.x.x` ✓

### Step 7 — Set up the project
1. Download and unzip the `collier-falls-rsvp` folder
2. Move it to your Desktop
3. In Terminal, navigate to it:
   ```
   cd Desktop/collier-falls-rsvp
   ```
4. Install packages:
   ```
   npm install
   ```
   This takes about 1–2 minutes.

### Step 8 — Add your Airtable credentials
1. Inside the `collier-falls-rsvp` folder, create a new plain text file named exactly:
   `.env`
   (no other extension — just `.env`)

   **On Mac:** Open TextEdit → Format → Make Plain Text → Save As `.env`
   **On Windows:** Open Notepad → Save As → change "Save as type" to "All Files" → name it `.env`

2. Paste this into the file, replacing the placeholders with your real values from Steps 4 & 5:
   ```
   REACT_APP_AIRTABLE_API_KEY=patXXXXXXXXXXXX.XXXXXXX
   REACT_APP_AIRTABLE_BASE_ID=appXXXXXXXXXXXX
   ```
3. Save the file.

### Step 9 — Test it locally
In Terminal (inside the project folder):
```
npm start
```
Your browser will open at `http://localhost:3000`.
Fill out a test RSVP and submit — then check your Airtable base.
The row should appear within seconds! ✓

Press **Ctrl+C** in Terminal to stop when done.

---

## PART 3 — PUBLISH TO GITHUB

### Step 10 — Create a GitHub repo
1. Go to **github.com** → Sign up for free (or log in)
2. Click **+** (top right) → **New repository**
3. Name it: `collier-falls-rsvp` | Set to **Public** | Click **Create repository**

### Step 11 — Push your code to GitHub
In Terminal (inside the project folder):
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/collier-falls-rsvp.git
git push -u origin main
```
Replace `YOUR-USERNAME` with your actual GitHub username.

---

## PART 4 — GO LIVE ON VERCEL

### Step 12 — Deploy
1. Go to **vercel.com** → **Sign up** → **Continue with GitHub**
2. Click **Add New → Project**
3. Find `collier-falls-rsvp` in the list → click **Import**
4. ⚠️ **Before clicking Deploy**, scroll down to **Environment Variables** and add both:

   | Name | Value |
   |---|---|
   | `REACT_APP_AIRTABLE_API_KEY` | your token from Step 4 |
   | `REACT_APP_AIRTABLE_BASE_ID` | your base ID from Step 5 |

5. Click **Deploy** and wait ~60 seconds

🎉 Your site is live! Vercel gives you a URL like:
`https://collier-falls-rsvp.vercel.app`

### Step 13 — Verify end-to-end
1. Open your Vercel URL and submit a test RSVP
2. Check Airtable — the row should appear within seconds ✓
3. Open `yoursite.vercel.app/?admin` to confirm the admin panel works

---

## SHARING WITH GUESTS

Send guests your Vercel URL:
```
https://collier-falls-rsvp.vercel.app
```

Admin panel (keep this URL private):
```
https://collier-falls-rsvp.vercel.app/?admin
```
**Admin password:** `releaseParty2026`

---

## MANAGING RSVPS IN AIRTABLE

Every submission appears in Airtable in real time — accessible from any device.

- **Sort by date:** Click the "Submitted At" column header → Sort
- **Export to CSV/Excel:**
  1. Click the **...** menu at the top-right of the table
  2. Click **Download CSV**
  3. Open in Excel or Google Sheets

---

## OPTIONAL: Custom Domain

Want `rsvp.collierfalls.com` instead of the Vercel URL?
1. Vercel → your project → **Settings → Domains**
2. Type your domain → **Add**
3. Vercel provides DNS records to enter at your domain registrar (GoDaddy, Namecheap, etc.)
4. Usually goes live within 30 minutes.

---

## CHANGING THE ADMIN PASSWORD

Open `src/App.jsx` and find this line (appears twice):
```
passInput === "releaseParty2026"
```
Replace `releaseParty2026` with your new password, then redeploy:
```
git add .
git commit -m "Update admin password"
git push
```
Vercel auto-deploys in ~30 seconds. ✓

---

## TROUBLESHOOTING

**RSVPs not appearing in Airtable?**
- Check your `.env` file — no spaces around the `=` signs
- Confirm the token has both `data.records:read` and `data.records:write` scopes
- Confirm the token has access to the `Collier Falls RSVPs` base specifically

**Vercel build fails?**
- Make sure you added the Environment Variables in Vercel before deploying
- Try: Vercel dashboard → your project → **Redeploy**

**Can't find "Builder hub" in Airtable?**
- Click your profile avatar (top-right) → it should be in that dropdown
- Alternatively go directly to: airtable.com/create/tokens

Need help? Copy the error message and share it — happy to troubleshoot!
