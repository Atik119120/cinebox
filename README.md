# CineBox - Stream Movies & TV Shows

CineBox is a modern, responsive streaming web application with a lightweight backend and rich frontend UI.

## Features
- Browse trending and top-rated movies & TV series
- Search catalog with instant suggestions
- Watchlist management
- Admin settings and custom pages support
- Responsive, modern cinematic dark mode UI

## Local Development (Windows)
Double-click `run.bat` or run:
```bash
python server.py
```

Open your browser and navigate to:
```
http://localhost:5000
```

## Deploy to Netlify

### Option 1: Via GitHub (Recommended)
1. Go to [Netlify](https://app.netlify.com/) and click **"Add new site" -> "Import an existing project"**.
2. Select **GitHub** and choose your repository: `Atik119120/cinebox`.
3. Netlify will automatically detect `netlify.toml`:
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
4. Click **Deploy CineBox**.

### Option 2: Netlify Drop (Manual)
1. Go to [Netlify Drop](https://app.netlify.com/drop).
2. Drag and drop this folder directly into the browser.
