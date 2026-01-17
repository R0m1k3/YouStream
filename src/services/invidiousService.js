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
            const response = await fetch(`${this.baseUrl}/api/v1/search?q=${encodeURIComponent(query)}&type=${type}&hl=fr`);
            if (!response.ok) throw new Error('Erreur lors de la recherche');
            const results = await response.json();

            // Normalisation des URLs des résultats de recherche
            return results.map(item => {
                if (item.videoThumbnails) {
                    item.videoThumbnails = item.videoThumbnails.map(t => ({ ...t, url: this.normalizeUrl(t.url) }));
                }
                if (item.authorThumbnails) {
                    item.authorThumbnails = item.authorThumbnails.map(t => ({ ...t, url: this.normalizeUrl(t.url) }));
                }
                return item;
            });
        } catch (error) {
            console.error('InvidiousService.search error:', error);
            throw error;
        }
    }

    /**
     * Récupérer les tendances (Populaire / Découverte)
     */
    async getTrending(type = 'Music') {
        try {
            // region est géré par la config serveur Invidious (fr-FR), mais on force hl=fr
            const response = await fetch(`${this.baseUrl}/api/v1/trending?type=${type}&hl=fr`);
            if (!response.ok) throw new Error('Erreur lors de la récupération des tendances');
            const results = await response.json();

            // Normalisation
            return results.map(item => {
                if (item.videoThumbnails) {
                    item.videoThumbnails = item.videoThumbnails.map(t => ({ ...t, url: this.normalizeUrl(t.url) }));
                }
                return item;
            });
        } catch (error) {
            console.error('InvidiousService.getTrending error:', error);
            // Fallback recherche si trending fail
            return this.search('trending');
        }
    }

    /**
     * Récupérer les vidéos d'une chaîne
     */
    async getChannelVideos(channelId) {
        try {
            channelId = decodeURIComponent(channelId);

            // Si c'est un handle (@user) ou un nom d'utilisateur (pas un ID UC...), on résout
            if (channelId.startsWith('@') || !channelId.startsWith('UC')) {
                console.log(`Résolution du handle/nom ${channelId}...`);
                const realId = await this.resolveHandle(channelId);
                if (realId) {
                    channelId = realId;
                } else {
                    console.warn(`Impossible de résoudre le handle ${channelId}`);
                    // On tente quand même avec l'ID d'origine au cas où
                }
            }



            const response = await fetch(`${this.baseUrl}/api/v1/channels/${channelId}/videos?hl=fr`);
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
                return videoList.filter(v => v.videoId && v.title).map(v => {
                    // Réécriture des URLs pour passer par le proxy local
                    if (v.videoThumbnails) {
                        v.videoThumbnails = v.videoThumbnails.map(t => ({
                            ...t,
                            url: this.normalizeUrl(t.url)
                        }));
                    }
                    if (v.authorThumbnails) {
                        v.authorThumbnails = v.authorThumbnails.map(t => ({
                            ...t,
                            url: this.normalizeUrl(t.url)
                        }));
                    }
                    return v;
                });
            }

            console.warn(`Format inattendu pour les vidéos de la chaîne ${channelId}:`, JSON.stringify(data));
            return [];
        } catch (error) {
            console.error(`InvidiousService.getChannelVideos error pour ${channelId}:`, error);
            return []; // Sécurité : toujours retourner un tableau
        }
    }

    normalizeUrl(url) {
        if (!url) return url;
        // Si c'est déjà une URL relative, on s'assure qu'elle est propre
        if (url.startsWith('/')) return url;

        // Si c'est une URL absolue Google/Youtube, on la transforme en relative pour le proxy
        try {
            const urlObj = new URL(url);
            if (urlObj.pathname.startsWith('/vi/')) {
                return urlObj.pathname; // /vi/videoId/mqdefault.jpg -> géré par Nginx
            }
            if (urlObj.pathname.startsWith('/ggpht/')) {
                return urlObj.pathname; // /ggpht/... -> géré par Nginx
            }
            if (urlObj.pathname.startsWith('/videoplayback')) {
                // On garde tout le path + les query params
                return urlObj.pathname + urlObj.search;
            }
        } catch (e) {
            // URL invalide, on laisse telle quelle
        }
        return url;
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
            const response = await fetch(`${this.baseUrl}/api/v1/videos/${videoId}?local=true&hl=fr`);
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
            const response = await fetch(`${this.baseUrl}/api/v1/channels/${channelId}?hl=fr`);
            if (!response.ok) throw new Error('Erreur lors de la récupération des infos de la chaîne');
            return await response.json();
        } catch (error) {
            console.error('InvidiousService.getChannelInfo error:', error);
            throw error;
        }
    }
    /**
     * Récupère la meilleure URL de flux vidéo (MP4 720p ou premier disponible)
     */
    getBestStreamUrl(videoDetails) {
        if (!videoDetails) return null;

        const formats = [
            ...(videoDetails.formatStreams || []),
            ...(videoDetails.adaptiveFormats || [])
        ];

        if (formats.length === 0) return null;

        // Prio: 22 (720p), 18 (360p) for Video+Audio. DASH (137..) is often video-only.
        const priorityItags = ['22', '18', '43', '137'];

        for (const itag of priorityItags) {
            const format = formats.find(s => s.itag === itag);
            if (format) return this.normalizeUrl(format.url);
        }

        // Fallback : premier MP4 trouvé
        const anyMp4 = formats.find(s => s.container === 'mp4');
        if (anyMp4) return this.normalizeUrl(anyMp4.url);

        // Dernier recours : le premier flux disponible
        return this.normalizeUrl(formats[0].url);
    }
}

export default new InvidiousService();
