/**
 * InvidiousService - Gère les appels à l'API Invidious
 */

const INSTANCES = [
    'https://invidious.snopyta.org',
    'https://yewtu.be',
    'https://invidious.kavin.rocks',
    'https://vid.konst.fish',
    'https://inv.tux.pizza'
];

class InvidiousService {
    constructor() {
        // En développement (localhost), on utilise le proxy Vite (/api/invidious)
        // En production, on devra aussi avoir un proxy Nginx ou utiliser une instance avec CORS autorisé
        this.baseUrl = '/api/invidious';
    }

    /**
     * Recherche de vidéos
     */
    async search(query, type = 'video') {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/search?q=${encodeURIComponent(query)}&type=${type}`);
            if (!response.ok) throw new Error('Erreur lors de la recherche');
            return await response.json();
        } catch (error) {
            console.error('InvidiousService.search error:', error);
            throw error;
        }
    }

    /**
     * Récupérer les vidéos d'une chaîne
     */
    async getChannelVideos(channelId) {
        try {
            // Si c'est un handle (@user), on doit d'abord trouver l'ID réel (UC...)
            if (channelId.startsWith('@')) {
                console.log(`Résolution du handle ${channelId}...`);
                const realId = await this.resolveHandle(channelId);
                if (realId) {
                    channelId = realId;
                } else {
                    console.warn(`Impossible de résoudre le handle ${channelId}`);
                    return []; // Retourne un tableau vide au lieu de undefined/null
                }
            }

            const response = await fetch(`${this.baseUrl}/api/v1/channels/${channelId}/videos`);
            if (!response.ok) throw new Error(`Erreur HTTP ${response.status} lors de la récupération des vidéos`);

            const data = await response.json();

            // Support du format direct Array ou Object { videos: [...] }
            let videoList = [];
            if (Array.isArray(data)) {
                videoList = data;
            } else if (data && Array.isArray(data.videos)) {
                videoList = data.videos;
            }

            if (videoList.length > 0) {
                // Filtrer les vidéos invalides (sans ID ou titre) pour éviter les crashs UI
                return videoList.filter(v => v.videoId && v.title);
            }

            console.warn(`Format inattendu pour les vidéos de la chaîne ${channelId}:`, data);
            return [];
        } catch (error) {
            console.error(`InvidiousService.getChannelVideos error pour ${channelId}:`, error);
            return []; // Sécurité : toujours retourner un tableau
        }
    }

    /**
     * Résout un handle (@user) en channelId (UC...) via la recherche
     */
    async resolveHandle(handle) {
        try {
            // Recherche du handle comme chaîne
            const results = await this.search(handle, 'channel');
            // On espère que le premier résultat est le bon
            if (results && results.length > 0) {
                return results[0].authorId;
            }
            return null;
        } catch (error) {
            console.error('Erreur résolution handle:', error);
            return null;
        }
    }

    /**
     * Récupérer les détails d'une vidéo (incluant les flux)
     */
    async getVideoDetails(videoId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/videos/${videoId}`);
            if (!response.ok) throw new Error('Erreur lors de la récupération des détails de la vidéo');
            return await response.json();
        } catch (error) {
            console.error('InvidiousService.getVideoDetails error:', error);
            throw error;
        }
    }

    /**
     * Récupérer les informations d'une chaîne (pour s'abonner par exemple)
     */
    async getChannelInfo(channelId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/channels/${channelId}`);
            if (!response.ok) throw new Error('Erreur lors de la récupération des infos de la chaîne');
            return await response.json();
        } catch (error) {
            console.error('InvidiousService.getChannelInfo error:', error);
            throw error;
        }
    }
}

export default new InvidiousService();
