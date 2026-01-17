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
*   **Helper:** `invidious-companion` (Target: `quay.io/invidious/invidious-companion:latest`)
    *   **Config:** Configured via `INVIDIOUS_CONFIG` JSON env var to ensure `token_private_key` synchronization.
    *   **Function:** Handles request signing and token generation to prevent 403 Forbidden errors.

### 3.2. Network & Proxy (Nginx)
The local Nginx server acts as the gateway to avoid CORS issues and expose internal Docker ports.
*   `GET /api/invidious/` -> `http://invidious:3000/api/v1/`
*   `GET /vi/` -> `http://invidious:3000/vi/` (Thumbnails)
*   `GET /ggpht/` -> `http://invidious:3000/ggpht/` (Avatars)
*   `GET /videoplayback` -> `http://invidious:3000/videoplayback` (Video Streams)

### 3.3. Frontend Logic (`invidiousService.js`)
*   **URL Normalization:** 
    *   All absolute URLs received from API (e.g., `https://lh3.googleusercontent.com/...`) are rewritten to relative proxy paths (e.g., `/ggpht/...`).
*   **Robust Channel Handling:**
    *   Automatic resolution of Channel Handles (`@user`) and Usernames (`MécaniqueSportive`) to Channel IDs (`UC...`) before API calls.
*   **Caching & State:**
    *   Using `@tanstack/react-query` to cache responses and handle loading/error states gracefully.

### 3.4. Feed Optimization
*   **"Nouveautés" (News) Tab**:
    *   Iterate through subscriptions.
    *   Filter videos: `published date` < 7 days.
    *   Aggregation: Sort all by date (newest first).
    *   Limit: Display maximum **50** videos total.
    *   Lazy Loading: Only fetch channel videos when explicitly visiting the "Channel" page? (The user said "tu charges les vidéos... lorsque l on va sur la page"). For "News", we *must* fetch recent ones, but maybe we can optimize the query or response size.
    *   For now, we will apply the filtering logic client-side after strict fetching.

## 4. Resolved Issues (2026-01-17)
1.  **403 Forbidden on Playback**: Fixed by migrating to `invidious-companion` and ensuring secure key synchronization via JSON environment variables.
2.  **500 Internal Server Error**: Fixed by implementing frontend resolution logic for channel names.
3.  **502 Bad Gateway**: Fixed by implementing Docker healthchecks to enforce dependency startup order.
4.  **Frontend Crash**: Fixed missing `ReactDOM` import.

## 5. Verification Criteria
*   [x] No console errors (404/403) on load.
*   [x] "Nouveautés" shows only recent videos (< 1 week).
*   [x] "Nouveautés" list is capped at 50 items.
*   [x] Video plays immediately upon click (Stream URL must be reachable).
