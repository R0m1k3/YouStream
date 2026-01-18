/**
 * SubscriptionService - G├¿re les abonnements et l'├®tat des vid├®os lues via localStorage
 */

const STORAGE_KEYS = {
    SUBSCRIPTIONS: 'youstream_subs',
    WATCHED_VIDEOS: 'youstream_watched'
};

class SubscriptionService {
    /**
     * R├®cup├¿re la liste des cha├«nes abonn├®es
     */
    getSubscriptions() {
        const subs = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
        return subs ? JSON.parse(subs) : [];
    }

    /**
     * Ajoute une cha├«ne aux abonnements
     */
    addSubscription(channel) {
        const subs = this.getSubscriptions();
        if (!subs.find(s => s.authorId === channel.authorId)) {
            subs.push({
                author: channel.author,
                authorId: channel.authorId,
                authorUrl: channel.authorUrl,
                authorThumbnails: channel.authorThumbnails
            });
            localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
        }
        return subs;
    }

    /**
     * Supprime une cha├«ne des abonnements
     */
    removeSubscription(channelId) {
        let subs = this.getSubscriptions();
        subs = subs.filter(s => s.authorId !== channelId);
        localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
        return subs;
    }

    /**
     * Met ├á jour l'ID d'une cha├«ne (ex: remplac├® handle @... par ID UC...)
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
     * R├®cup├¿re la liste des IDs de vid├®os lues
     */
    getWatchedVideos() {
        const watched = localStorage.getItem(STORAGE_KEYS.WATCHED_VIDEOS);
        return watched ? JSON.parse(watched) : [];
    }

    /**
     * Marque une vid├®o comme lue
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
     * V├®rifie si une vid├®o est lue
     */
    isWatched(videoId) {
        return this.getWatchedVideos().includes(videoId);
    }

    /**
     * Importe des abonnements depuis une cha├«ne Base64 (Bookmarklet)
     */
    async importFromBase64(base64String) {
        try {
            // Tentative 1: D├®codage standard UTF-8 (compatible avec btoa(unescape(encodeURIComponent(s))))
            const jsonString = decodeURIComponent(escape(atob(base64String)));
            return this.importFromJSON(jsonString);
        } catch (error) {
            console.warn('Echec d├®codage standard, tentative fallback...', error);
            try {
                // Tentative 2: D├®codage brut (si pas d'encodage URI pr├®alable, ou caract├¿res simples)
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
                        // Pour les URLs /user/, /c/, /@, on ne peut pas d├®duire l'ID facilement sans API
                        // On stocke l'URL comme ID temporaire pour Invidious qui sait souvent g├®rer les handles
                        // Mais l'id├®al est d'avoir l'ID UC...
                        // Pour l'instant on tente de parser ce qu'on peut
                        const parts = href.split('/');
                        authorId = parts[parts.length - 1] || parts[parts.length - 2];
                    }

                    if (authorId) {
                        newSubs.push({
                            author: link.textContent.trim(),
                            authorId: authorId, // Attention: peut ├¬tre un handle
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
     * R├®cup├¿re la liste des cha├«nes abonn├®es (LocalStorage + API Sync)
     */
    async fetchSubscriptions() {
        let localSubs = this.getSubscriptions();
        try {
            const res = await fetch('/api/backend/subscriptions');
            if (res.ok) {
                const remoteSubs = await res.json();

                // CAS MIGRATION : Le backend est vide (nouveau) mais le client a des donn├®es
                if (remoteSubs.length === 0 && localSubs.length > 0) {
                    console.log('Migration des donn├®es locales vers le nouveau backend...');
                    // On envoie tout au backend
                    await this.syncWithBackend(localSubs);
                    // On retourne les donn├®es locales (le backend traitera les thumbnails en arri├¿re-plan)
                    return localSubs;
                }

                // CAS NORMAL : Le backend a des donn├®es (ou les deux sont vides)
                // Le backend est la source de v├®rit├®
                localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(remoteSubs));
                return remoteSubs;
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

    _mergeAndSave(newSubs) {
        if (newSubs.length > 0) {
            const currentSubs = this.getSubscriptions();
            const mergedSubs = [...currentSubs];
            const addedSubs = [];

            newSubs.forEach(newSub => {
                if (!mergedSubs.find(s => s.authorId === newSub.authorId)) {
                    const subToAdd = {
                        author: newSub.author,
                        authorId: newSub.authorId,
                        authorUrl: newSub.authorUrl || `/channel/${newSub.authorId}`,
                        authorThumbnails: newSub.authorThumbnails || []
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
