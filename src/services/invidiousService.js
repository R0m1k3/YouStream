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
        this.baseUrl = INSTANCES[1]; // Utilisation de yewtu.be par défaut
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
            const response = await fetch(`${this.baseUrl}/api/v1/channels/${channelId}/videos`);
            if (!response.ok) throw new Error('Erreur lors de la récupération des vidéos de la chaîne');
            return await response.json();
        } catch (error) {
            console.error('InvidiousService.getChannelVideos error:', error);
            throw error;
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
