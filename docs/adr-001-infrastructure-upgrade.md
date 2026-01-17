# ADR-001: Infrastructure & Performance Overhaul

## Status
Proposed

## Context
The current application suffers from:
1.  **Critical Instability**: Persistent 403 Forbidden errors on video playback.
2.  **Performance Issues**: "Infinite" loading times due to fetching all channels sequentially on client-side.
3.  **Maintenance Debt**: Reliance on `inv-sig-helper` which is now **archived and unmaintained** (as of Sept 2025).

## Research Findings
Deep web analysis indicates:
*   YouTube's anti-bot measures (PoW, Signatures) have evolved. The old `inv-sig-helper` cannot keep up.
*   **Solution**: The community standard for 2025 is **Invidious Companion**. It uses `YouTube.js` to properly emulate a real client and generate valid tokens/signatures.
*   **Performance**: Frontend-only fetching of N channels is anti-pattern. We need a "Look-through Cache" or "Background Sync".

## Proposed Architecture (YouStream v2)

### 1. Infrastructure Upgrade (The "Robust" Fix)
*   **Remove**: `inv-sig-helper` (Dead).
*   **Add**: `invidious-companion` (Sidecar).
    *   Handles "Visitor Data" & "PO Token" rotation automatically.
    *   Proxies playback requests reliably.

### 2. Application Refactor (The "Easy & Fast" Fix)
To address "Loading is too long":
*   **Current**: `App.jsx` fetches Videos for Subscriber A -> Wait -> Subscriber B -> Wait...
*   **New**: **Parallel + Caching Strategy**.
    *   Implement `TanStack Query` (React Query) for smart caching.
    *   "Stale-While-Revalidate": Show cached videos *instantly*, fetch new ones in background.
    *   **Unified Feed API**: Ideally, move the aggregation logic to a small Node.js endpoint (in the YouStream container) so the frontend makes 1 call: `GET /api/feed`.

## Action Plan
1.  **Infra**: Modify `docker-compose.yml` to swap the helper for the companion.
2.  **Config**: Update `config.yml` to link with the companion.
3.  **Frontend**: Refactor `App.jsx` to implment strict "Last 7 Days" filter + Optimistic UI updates.

## Decision
Adopt **Invidious Companion** immediately to solve the 403 blocker.
Refactor Frontend to prioritize **Speed** (Cache first).
