# Project Brief: YouStream

## 1. Vision
YouStream is a lightweight, privacy-focused YouTube frontend designed to run locally using Docker. It aims to provide a premium, ad-free viewing experience without tracking, relying on a self-hosted Invidious instance to ensure data sovereignty and reliability.

## 2. Core Value Proposition
*   **Privacy:** No Google account required, no tracking.
*   **Reliability:** Bypasses external Invidious instance rate limits and YouTube region blocks using local signatures.
*   **Performance:** Lightweight React frontend with optimized local proxying.
*   **User Experience:** "Premium" feel with dark mode, no ads, and seamless playback.

## 3. Architecture
*   **Frontend:** React (Vite), vanilla CSS for styling.
*   **Backend/Proxy:** Nginx (Reverse Proxy), Invidious (API & Scraping), Postgres (DB), inv-sig-helper (Signature Generation).
*   **Infrastructure:** Docker Compose (All-in-one deployment).

## 4. Current Status
*   **Phase:** Post-MVP / Hardening.
*   **Recent Focus:** ensuring 100% local traffic for stability (removing external dependencies on `yewtu.be` etc.).

## 5. Roadmap
*   [x] Local Invidious Instance
*   [x] Signature Verification (Fix 403)
*   [x] Local Image Proxying (Fix 404)
*   [ ] User Preferences Persistence (DB/LocalStore)
*   [ ] Playlist Management
*   [ ] Cast Support
