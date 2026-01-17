# PRD-001: Local Proxy & Playback Stability

## 1. Problem Statement
Users were experiencing consistent playback failures ("Error" thumbnails, 404s, 403 Forbidden) because the application relied on unstable external public Invidious instances or direct connections to Google servers which blocked the requests.

## 2. Objective
Ensure that **100%** of network traffic (Video metadata, Thumbnails, Avatars, Video Streams) passes through the self-hosted local Invidious container. This guarantees:
1.  Bypassing of domain-based blocking (CORS/Adblock lists).
2.  Generation of valid playback signatures to avoid YouTube 403 Forbidden errors.
3.  Consistent availability even if public instances are down.

## 3. Technical Specifications

### 3.1. Infrastructure
*   **Service:** `invidious` (Target: `quay.io/invidious/invidious:latest`)
*   **Helper:** `inv-sig-helper` (Target: `quay.io/invidious/inv-sig-helper:latest`)
    *   **Config:** `signature_server_enabled: true` in `config.yml`.
    *   **Function:** Generates `&sig=` and `&lsig=` parameters for playback URLs.

### 3.2. Network & Proxy (Nginx)
The local Nginx server acts as the gateway to avoid CORS issues and expose internal Docker ports.
*   `GET /api/invidious/` -> `http://invidious:3000/api/v1/`
*   `GET /vi/` -> `http://invidious:3000/vi/` (Thumbnails)
*   `GET /ggpht/` -> `http://invidious:3000/ggpht/` (Avatars)
*   `GET /videoplayback` -> `http://invidious:3000/videoplayback` (Video Streams)

### 3.3. Frontend Logic (`invidiousService.js`)
*   **URL Normalization:** 
    *   All absolute URLs received from API (e.g., `https://lh3.googleusercontent.com/...`) are rewritten to relative proxy paths (e.g., `/ggpht/...`).
*   **Stream Selection:**
    *   Request `?local=true` from Invidious API to get proxy-ready URLs.
    *   Algorithm preferentially selects `mp4` format (itag 22/18) for maximum browser compatibility.

### 3.4. Feed Optimization
*   **"Nouveautés" (News) Tab**:
    *   Iterate through subscriptions.
    *   Filter videos: `published date` < 7 days.
    *   Aggregation: Sort all by date (newest first).
    *   Limit: Display maximum **50** videos total.
    *   Lazy Loading: Only fetch channel videos when explicitly visiting the "Channel" page? (The user said "tu charges les vidéos... lorsque l on va sur la page"). For "News", we *must* fetch recent ones, but maybe we can optimize the query or response size.
    *   For now, we will apply the filtering logic client-side after strict fetching.

## 4. Verification Criteria
*   [x] No console errors (404/403) on load.
*   [ ] "Nouveautés" shows only recent videos (< 1 week).
*   [ ] "Nouveautés" list is capped at 50 items.
*   [ ] Video plays immediately upon click (Stream URL must be reachable).

