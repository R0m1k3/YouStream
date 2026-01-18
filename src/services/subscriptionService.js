import invidiousService from './invidiousService';

const STORAGE_KEYS = {
    SUBSCRIPTIONS: 'youstream_subs',
    WATCHED_VIDEOS: 'youstream_watched',
    FAVORITES: 'youstream_favorites',
    INTERESTS: 'youstream_interests',
    DISCOVERY_CATEGORY: 'youstream_discovery_cat',
    LAST_SYNC: 'youstream_last_sync'
};

class SubscriptionService {
    /**
     * Récupère la liste des chaînes abonnées
     */
    getSubscriptions() {
        const subs = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
        return subs ? JSON.parse(subs) : [];
    }

    /**
     * Ajoute une chaîne aux abonnements
     */
    addSubscription(channel) {
        const subs = this.getSubscriptions();
        if (!subs.find(s => s.authorId === channel.authorId)) {
            let thumbs = channel.authorThumbnails || [];
            if (thumbs.length > 0) {
                thumbs = thumbs.map(t => ({
                    ...t,
                    url: invidiousService.normalizeUrl(t.url)
                }));
            }

            subs.push({
                author: channel.author,
                authorId: channel.authorId,
                authorUrl: channel.authorUrl,
                authorThumbnails: thumbs
            });
            localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
        }
        return subs;
    }

    /**
     * Supprime une chaîne des abonnements
     */
    removeSubscription(channelId) {
        let subs = this.getSubscriptions();
        subs = subs.filter(s => s.authorId !== channelId);
        localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
        return subs;
    }

    /**
     * Met à jour l'ID d'une chaîne (ex: remplacé handle @... par ID UC...)
     */
    updateSubscriptionId(oldId, newId) {
        let subs = this.getSubscriptions();
        subs = subs.map(s => {
            if (s.authorId === oldId) {
                return { ...s, authorId: newId };
            }
            return s;
        });
        localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
        return subs;
    }

    /**
     * Récupère la liste des IDs de vidéos lues
     */
    getWatchedVideos() {
        const watched = localStorage.getItem(STORAGE_KEYS.WATCHED_VIDEOS);
        return watched ? JSON.parse(watched) : [];
    }

    /**
     * Marque une vidéo comme lue
     */
    markAsWatched(videoId) {
        const watched = this.getWatchedVideos();
        if (!watched.includes(videoId)) {
            watched.push(videoId);
            localStorage.setItem(STORAGE_KEYS.WATCHED_VIDEOS, JSON.stringify(watched));
        }
        return watched;
    }

    /**
     * Vérifie si une vidéo est lue
     */
    isWatched(videoId) {
        return this.getWatchedVideos().includes(videoId);
    }

    /**
     * Favorites Logic
     */
    getFavorites() {
        const favs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
        return favs ? JSON.parse(favs) : [];
    }

    isFavorite(videoId) {
        return this.getFavorites().some(f => f.videoId === videoId);
    }

    addFavorite(video) {
        const favs = this.getFavorites();
        if (!favs.find(f => f.videoId === video.videoId)) {
            favs.push(video);
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
        }
        return favs;
    }

    removeFavorite(videoId) {
        let favs = this.getFavorites();
        favs = favs.filter(f => f.videoId !== videoId);
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
        return favs;
    }

    /**
     * Importe des abonnements depuis une chaîne Base64 (Bookmarklet)
     */
    async importFromBase64(base64String) {
        try {
            // Tentative 1: Décodage standard UTF-8 (compatible avec btoa(unescape(encodeURIComponent(s))))
            const jsonString = decodeURIComponent(escape(atob(base64String)));
            return this.importFromJSON(jsonString);
        } catch (error) {
            console.warn('Echec décodage standard, tentative fallback...', error);
            try {
                // Tentative 2: Décodage brut (si pas d'encodage URI préalable, ou caractères simples)
                const jsonString = atob(base64String);
                return this.importFromJSON(jsonString);
            } catch (error2) {
                console.error('Erreur import Base64 fatale:', error2);
                throw error2;
            }
        }
    }

    /**
     * Importe des abonnements depuis un format JSON (Script Magic)
     */
    async importFromJSON(jsonString) {
        try {
            const newSubs = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
            if (!Array.isArray(newSubs)) throw new Error('Format JSON invalide');
            return this._mergeAndSave(newSubs);
        } catch (error) {
            console.error('Erreur import JSON:', error);
            throw error;
        }
    }

    /**
     * Importe des abonnements depuis un fichier OPML (String XML)
     */
    async importFromOPML(xmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");
            const outlines = xmlDoc.getElementsByTagName("outline");

            const newSubs = [];
            for (let i = 0; i < outlines.length; i++) {
                const title = outlines[i].getAttribute("title") || outlines[i].getAttribute("text");
                const xmlUrl = outlines[i].getAttribute("xmlUrl");

                if (xmlUrl && xmlUrl.includes("channel_id=")) {
                    const authorId = xmlUrl.split("channel_id=")[1];
                    newSubs.push({
                        author: title,
                        authorId: authorId,
                        authorUrl: `/channel/${authorId}`,
                        authorThumbnails: []
                    });
                }
            }
            return this._mergeAndSave(newSubs);
        } catch (error) {
            console.error('Erreur parsing OPML:', error);
            throw error;
        }
    }

    /**
     * Importe des abonnements depuis un fichier CSV (Google Takeout)
     */
    async importFromCSV(csvString) {
        try {
            const lines = csvString.split('\n');
            const newSubs = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const [authorId, authorUrl, author] = line.split(',');
                if (authorId && authorId.startsWith('UC')) {
                    newSubs.push({
                        author: author.replace(/"/g, '').trim(),
                        authorId: authorId,
                        authorUrl: authorUrl,
                        authorThumbnails: []
                    });
                }
            }
            return this._mergeAndSave(newSubs);
        } catch (error) {
            console.error('Erreur parsing CSV:', error);
            throw error;
        }
    }

    /**
     * Importe des abonnements depuis un fichier Netscape Bookmark Format (HTML)
     * Compatible avec l'export de favoris des navigateurs
     */
    async importFromNetscapeHTML(htmlString) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');
            const links = doc.querySelectorAll('a');
            const newSubs = [];

            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && (href.includes('youtube.com/channel/') || href.includes('youtube.com/user/') || href.includes('youtube.com/c/') || href.includes('youtube.com/@'))) {
                    let authorId = null;
                    if (href.includes('/channel/')) {
                        authorId = href.split('/channel/')[1].split('?')[0].split('/')[0];
                    } else {
                        // Pour les URLs /user/, /c/, /@, on ne peut pas déduire l'ID facilement sans API
                        // On stocke l'URL comme ID temporaire pour Invidious qui sait souvent gérer les handles
                        // Mais l'idéal est d'avoir l'ID UC...
                        // Pour l'instant on tente de parser ce qu'on peut
                        const parts = href.split('/');
                        authorId = parts[parts.length - 1] || parts[parts.length - 2];
                    }

                    if (authorId) {
                        newSubs.push({
                            author: link.textContent.trim(),
                            authorId: authorId, // Attention: peut être un handle
                            authorUrl: href,
                            authorThumbnails: []
                        });
                    }
                }
            });

            return this._mergeAndSave(newSubs);
        } catch (error) {
            console.error('Erreur parsing Netscape HTML:', error);
            throw error;
        }
    }

    /**
     * Récupère la liste des chaînes abonnées (LocalStorage + API Sync)
     */
    async fetchSubscriptions() {
        let localSubs = this.getSubscriptions();

        // Cache management: 10 minutes
        const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
        const now = Date.now();
        if (lastSync && (now - parseInt(lastSync) < 1000 * 60 * 10)) {
            console.log('Subscriptions cache fresh (< 10 min), skipping backend fetch');
            return localSubs;
        }

        try {
            const res = await fetch('/api/backend/subscriptions');
            if (res.ok) {
                const remoteSubs = await res.json();
                localStorage.setItem(STORAGE_KEYS.LAST_SYNC, now.toString());

                // MERGE LOGIC: Backend is source of truth for membership, 
                // but LocalStorage can have fresher thumbnails/metadata
                const merged = remoteSubs.map(remote => {
                    const local = localSubs.find(l => l.authorId === remote.authorId);

                    // Normalize remote thumbnails
                    if (remote.authorThumbnails) {
                        remote.authorThumbnails = remote.authorThumbnails.map(t => ({
                            ...t,
                            url: invidiousService.normalizeUrl(t.url)
                        }));
                    }

                    if (local && (!remote.authorThumbnails || remote.authorThumbnails.length === 0) && (local.authorThumbnails && local.authorThumbnails.length > 0)) {
                        return { ...remote, authorThumbnails: local.authorThumbnails };
                    }
                    return remote;
                });

                // CAS MIGRATION : Le backend est vide (nouveau) mais le client a des données
                if (merged.length === 0 && localSubs.length > 0) {
                    console.log('Migration des données locales vers le nouveau backend...');
                    // On envoie tout au backend
                    await this.syncWithBackend(localSubs);
                    // On retourne les données locales (le backend traitera les thumbnails en arrière-plan)
                    return localSubs;
                }

                // CAS NORMAL : Le backend a des données (ou les deux sont vides)
                localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(merged));
                return merged;
            }
        } catch (e) {
            console.warn('Backend unavailable, using local storage:', e);
        }
        return localSubs;
    }

    async syncWithBackend(newSubs) {
        try {
            await fetch('/api/backend/subscriptions/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptions: newSubs })
            });
        } catch (e) {
            console.error('Failed to sync with backend:', e);
        }
    }

    /**
     * Discovery Interests Logic
     */
    getInterests() {
        const interests = localStorage.getItem(STORAGE_KEYS.INTERESTS);
        return interests ? JSON.parse(interests) : [];
    }

    addInterest(keyword) {
        if (!keyword) return;
        const interests = this.getInterests();
        if (!interests.includes(keyword)) {
            interests.push(keyword);
            localStorage.setItem(STORAGE_KEYS.INTERESTS, JSON.stringify(interests));
        }
        return interests;
    }

    removeInterest(keyword) {
        const interests = this.getInterests().filter(k => k !== keyword);
        localStorage.setItem(STORAGE_KEYS.INTERESTS, JSON.stringify(interests));
        return interests;
    }

    getDiscoveryCategory() {
        return localStorage.getItem(STORAGE_KEYS.DISCOVERY_CATEGORY) || 'Trending';
    }

    setDiscoveryCategory(category) {
        localStorage.setItem(STORAGE_KEYS.DISCOVERY_CATEGORY, category);
        return category;
    }

    _mergeAndSave(newSubs) {
        if (newSubs.length > 0) {
            const currentSubs = this.getSubscriptions();
            const mergedSubs = [...currentSubs];
            const addedSubs = [];

            newSubs.forEach(newSub => {
                if (!mergedSubs.find(s => s.authorId === newSub.authorId)) {
                    // Normalize thumbnails for new subscriptions
                    let thumbs = newSub.authorThumbnails || [];
                    if (thumbs.length > 0) {
                        thumbs = thumbs.map(t => ({
                            ...t,
                            url: invidiousService.normalizeUrl(t.url)
                        }));
                    }

                    const subToAdd = {
                        author: newSub.author,
                        authorId: newSub.authorId,
                        authorUrl: newSub.authorUrl || `/channel/${newSub.authorId}`,
                        authorThumbnails: thumbs
                    };
                    mergedSubs.push(subToAdd);
                    addedSubs.push(subToAdd);
                }
            });
            localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(mergedSubs));

            // Sync with Backend in background
            if (addedSubs.length > 0) {
                this.syncWithBackend(addedSubs);
            }

            return mergedSubs;
        }
        return this.getSubscriptions();
    }
}

export default new SubscriptionService();
