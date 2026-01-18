/**
 * InvidiousService - Gère les appels à l'API Invidious
 * Version stable (v1.3 - Ultra-Low-Latency)
 */

class InvidiousService {
    constructor() {
        this.baseUrl = window.location.origin;
        this.queue = [];
        this.activeCount = 0;
        this.maxConcurrency = 3; // Balanced: faster sync without overloading
        this.running = 0;
    }

    getLocaleParams() {
        // Force French for metadata consistency as requested by user
        const hl = 'fr';
        const region = 'FR';
        return `hl=${hl}&region=${region}`;
    }

    async enqueue(fn) {
        return new Promise((resolve, reject) => {
            const task = async () => {
                this.activeCount++;
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.activeCount--;
                    this.next();
                }
            };

            if (this.activeCount < this.maxConcurrency) {
                task();
            } else {
                this.queue.push(task);
            }
        });
    }

    next() {
        while (this.queue.length > 0 && this.activeCount < this.maxConcurrency) {
            const task = this.queue.shift();
            task();
        }
    }

    async fetchWithTimeout(url, options = {}, timeout = 10000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }

    async search(query, type = 'video', recentOnly = false) {
        try {
            const locale = this.getLocaleParams();
            // Add date filter for recent videos (last month) and sort by upload date
            const dateFilter = recentOnly ? '&date=month&sort=upload_date' : '';
            const response = await this.enqueue(() => this.fetchWithTimeout(`${this.baseUrl}/api/v1/search?q=${encodeURIComponent(query)}&type=${type}&${locale}${dateFilter}`));
            if (!response.ok) return [];
            const results = await response.json();
            return results.map(item => {
                if (item.videoThumbnails) item.videoThumbnails = item.videoThumbnails.map(t => ({ ...t, url: this.normalizeUrl(t.url) }));
                if (item.authorThumbnails) item.authorThumbnails = item.authorThumbnails.map(t => ({ ...t, url: this.normalizeUrl(t.url) }));
                return item;
            });
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    async getTrending(type = 'Music') {
        try {
            const locale = this.getLocaleParams();
            // Trending is a heavy endpoint, we give it more time (20s)
            const response = await this.enqueue(() => this.fetchWithTimeout(`${this.baseUrl}/api/v1/trending?type=${type}&${locale}`, {}, 20000));

            if (!response.ok) {
                console.warn(`Trending API returned ${response.status}`);
                return this.search('trending'); // Fallback to search
            }

            const results = await response.json();
            if (!Array.isArray(results)) return this.search('trending');

            return results.map(item => {
                if (item.videoThumbnails) item.videoThumbnails = item.videoThumbnails.map(t => ({ ...t, url: this.normalizeUrl(t.url) }));
                return item;
            });
        } catch (error) {
            if (error.name === 'AbortError') return await this.search('trending');
            console.error('Trending error:', error);
            try {
                return await this.search('trending');
            } catch (fallbackError) {
                return []; // Ultimate fallback
            }
        }
    }

    async getChannelVideos(channelId) {
        try {
            channelId = decodeURIComponent(channelId);
            // Handle Handle resolution if needed
            if (channelId.startsWith('@') || !channelId.startsWith('UC')) {
                const realId = await this.resolveHandle(channelId);
                if (realId) channelId = realId;
            }

            const locale = this.getLocaleParams();
            // Channel video listing can be slow, 20s timeout
            const response = await this.enqueue(() => this.fetchWithTimeout(`${this.baseUrl}/api/v1/channels/${channelId}/videos?${locale}`, {}, 20000));
            if (!response.ok) {
                console.warn(`HTTP ${response.status} for channel ${channelId}`);
                return [];
            }

            const data = await response.json();
            let videoList = Array.isArray(data) ? data : (data?.videos || []);

            return videoList.filter(v => v.videoId && v.title).map(v => {
                if (v.videoThumbnails) v.videoThumbnails = v.videoThumbnails.map(t => ({ ...t, url: this.normalizeUrl(t.url) }));
                if (v.authorThumbnails) v.authorThumbnails = v.authorThumbnails.map(t => ({ ...t, url: this.normalizeUrl(t.url) }));
                return v;
            });
        } catch (error) {
            if (error.name === 'AbortError') return []; // Silent handling for timeouts/unmounts
            console.error('ChannelVideos error:', error);
            return [];
        }
    }

    normalizeUrl(url) {
        if (!url || url.startsWith('/')) return url;
        try {
            const urlObj = new URL(url);
            // Proxy logic to bypass CORS and tracking
            if (urlObj.pathname.startsWith('/vi/') ||
                urlObj.pathname.startsWith('/ggpht/') ||
                urlObj.pathname.startsWith('/videoplayback') ||
                urlObj.pathname.includes('/manifest/')) {
                return urlObj.pathname + urlObj.search;
            }
        } catch (e) { }
        return url;
    }

    async resolveHandle(handle) {
        try {
            // Ensure handle is decoded first to avoid double encoding if it comes from a URL
            const cleanHandle = decodeURIComponent(handle);
            let results = await this.search(cleanHandle, 'channel');

            // Fallback: If search with @ fails or returns nothing, try without it
            if ((!results || results.length === 0) && cleanHandle.startsWith('@')) {
                results = await this.search(cleanHandle.substring(1), 'channel');
            }

            return (results && results.length > 0) ? results[0].authorId : null;
        } catch (error) {
            console.warn('Handle resolution failed:', handle);
            return null;
        }
    }

    async getVideoDetails(videoId) {
        try {
            const locale = this.getLocaleParams();
            const response = await this.enqueue(() => this.fetchWithTimeout(`${this.baseUrl}/api/v1/videos/${videoId}?${locale}`));
            if (!response.ok) return null;
            const video = await response.json();
            return video;
        } catch (error) {
            console.error('VideoDetails error:', error);
            throw error;
        }
    }

    async getChannelInfo(channelId) {
        try {
            const locale = this.getLocaleParams();
            const response = await this.enqueue(() => this.fetchWithTimeout(`${this.baseUrl}/api/v1/channels/${channelId}?${locale}`));
            if (!response.ok) throw new Error('ChannelInfo error');
            return await response.json();
        } catch (error) {
            console.error('ChannelInfo error:', error);
            throw error;
        }
    }

    getBestStreamUrl(videoDetails) {
        if (!videoDetails) return null;

        // 1. Priorité aux flux HLS si disponibles (souvent plus stables face aux 403 de Google)
        if (videoDetails.hlsUrl) return this.normalizeUrl(videoDetails.hlsUrl);

        // 2. Recherche par itags prioritaires (720p, 360p stable)
        const formats = [...(videoDetails.formatStreams || []), ...(videoDetails.adaptiveFormats || [])];
        const priorityItags = ['22', '18', '137', '136', '135', '134'];

        for (const itag of priorityItags) {
            const format = formats.find(s => s.itag === itag);
            if (format && format.url) return this.normalizeUrl(format.url);
        }

        // 3. Fallback DASH
        if (videoDetails.dashUrl) return this.normalizeUrl(videoDetails.dashUrl);

        // 4. Fallback vers n'importe quel MP4 direct
        const anyMp4 = formats.find(s => s.container === 'mp4' && s.url);
        if (anyMp4) return this.normalizeUrl(anyMp4.url);

        return formats.length > 0 ? this.normalizeUrl(formats[0].url) : null;
    }
}

export default new InvidiousService();
