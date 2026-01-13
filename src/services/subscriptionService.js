/**
 * SubscriptionService - Gère les abonnements et l'état des vidéos lues via localStorage
 */

const STORAGE_KEYS = {
    SUBSCRIPTIONS: 'youstream_subs',
    WATCHED_VIDEOS: 'youstream_watched'
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
     * Supprime une chaîne des abonnements
     */
    removeSubscription(channelId) {
        let subs = this.getSubscriptions();
        subs = subs.filter(s => s.authorId !== channelId);
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
     * Importe des abonnements depuis une chaîne Base64 (Bookmarklet)
     */
    async importFromBase64(base64String) {
        try {
            const jsonString = decodeURIComponent(escape(atob(base64String)));
            return this.importFromJSON(jsonString);
        } catch (error) {
            console.error('Erreur import Base64:', error);
            throw error;
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

    _mergeAndSave(newSubs) {
        if (newSubs.length > 0) {
            const currentSubs = this.getSubscriptions();
            const mergedSubs = [...currentSubs];
            newSubs.forEach(newSub => {
                if (!mergedSubs.find(s => s.authorId === newSub.authorId)) {
                    mergedSubs.push({
                        author: newSub.author,
                        authorId: newSub.authorId,
                        authorUrl: newSub.authorUrl || `/channel/${newSub.authorId}`,
                        authorThumbnails: newSub.authorThumbnails || []
                    });
                }
            });
            localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(mergedSubs));
            return mergedSubs;
        }
        return this.getSubscriptions();
    }
}

export default new SubscriptionService();
