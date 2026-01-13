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
}

export default new SubscriptionService();
