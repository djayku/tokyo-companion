# Tokyo Companion

Mobile-first travel companion for Jay's Tokyo trip (Oct 14–16, 2026).

## Features
- 3-day itinerary (Oct 14, 15, 16) with full ACC 2026 schedule baked in
- Map (Leaflet + OpenStreetMap, free, no API key) with all places pinned
- Curated Tokyo places with hours, area, price, Google Maps links
- Filter by category (sights, food, activity, shop) and "Now open" toggle
- Add your own places — saved to localStorage
- Light + dark mode
- PWA-ready (works offline once loaded)
- Mobile-first responsive, premium typography (Cormorant Garamond + Inter)

## Stack
- Plain HTML/CSS/JS (no build step)
- Leaflet for map
- Google Fonts (Cormorant Garamond, Inter, JetBrains Mono)
- localStorage for persistence
- Deployed via GitHub Pages

## Files
- `index.html` — markup
- `style.css` — design tokens + components
- `app.js` — logic, map, filters, modal
- `data.js` — curated Tokyo data + ACC 2026 schedule

## Run locally
```bash
cd tokyo-companion
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy
Pushed to `djayku/tokyo-companion` via GitHub Pages — see commit history.

## Credits
Built by Blastoise (Blastoiseoc) for Jason Ku · 2026-10-10
