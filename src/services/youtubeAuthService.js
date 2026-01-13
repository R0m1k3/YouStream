/**
 * YouTubeAuthService - Gère l'authentification OAuth 2.0 avec Google et l'API YouTube
 */

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'youstream_yt_token',
    USER_INFO: 'youstream_yt_user',
    TOKEN_EXPIRY: 'youstream_yt_expiry'
};

// Configuration - À remplacer par vos propres credentials
const CONFIG = {
    CLIENT_ID: '', // Sera défini via setClientId()
    SCOPES: 'https://www.googleapis.com/auth/youtube.readonly',
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'
};

class YouTubeAuthService {
    constructor() {
        this.tokenClient = null;
        this.accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || null;
        this.userInfo = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_INFO) || 'null');
        this.isInitialized = false;
    }

    /**
     * Définit le Client ID OAuth (doit être appelé avant init)
     */
    setClientId(clientId) {
        CONFIG.CLIENT_ID = clientId;
    }

    /**
     * Initialise le client Google Identity Services
     */
    async init() {
        if (this.isInitialized) return;
        if (!CONFIG.CLIENT_ID) {
            console.warn('YouTubeAuthService: CLIENT_ID non défini');
            return;
        }

        return new Promise((resolve) => {
            // Attendre que le script Google soit chargé
            const checkGoogle = () => {
                if (window.google?.accounts?.oauth2) {
                    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: CONFIG.CLIENT_ID,
                        scope: CONFIG.SCOPES,
                        callback: (response) => {
                            if (response.access_token) {
                                this._handleTokenResponse(response);
                            }
                        }
                    });
                    this.isInitialized = true;
                    resolve(true);
                } else {
                    setTimeout(checkGoogle, 100);
                }
            };
            checkGoogle();
        });
    }

    /**
     * Gère la réponse du token OAuth
     */
    _handleTokenResponse(response) {
        this.accessToken = response.access_token;
        const expiryTime = Date.now() + (response.expires_in * 1000);
        
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, this.accessToken);
        localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
    }

    /**
     * Vérifie si l'utilisateur est connecté
     */
    isLoggedIn() {
        if (!this.accessToken) return false;
        
        const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
        if (expiry && Date.now() > parseInt(expiry)) {
            this.logout();
            return false;
        }
        return true;
    }

    /**
     * Déclenche le flow de connexion OAuth
     */
    async login() {
        await this.init();
        
        if (!this.tokenClient) {
            throw new Error('Client OAuth non initialisé. Vérifiez le CLIENT_ID.');
        }

        return new Promise((resolve, reject) => {
            // Override le callback pour cette requête
            this.tokenClient.callback = async (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                
                this._handleTokenResponse(response);
                
                // Récupérer les infos utilisateur
                try {
                    const userInfo = await this._fetchUserInfo();
                    this.userInfo = userInfo;
                    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
                    resolve({ token: this.accessToken, user: userInfo });
                } catch (error) {
                    resolve({ token: this.accessToken, user: null });
                }
            };
            
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    /**
     * Récupère les informations de l'utilisateur connecté
     */
    async _fetchUserInfo() {
        const response = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
            {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            }
        );
        
        if (!response.ok) throw new Error('Erreur récupération infos utilisateur');
        
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            const channel = data.items[0].snippet;
            return {
                name: channel.title,
                thumbnail: channel.thumbnails?.default?.url || null
            };
        }
        return null;
    }

    /**
     * Récupère les abonnements de l'utilisateur connecté
     */
    async getSubscriptions() {
        if (!this.isLoggedIn()) {
            throw new Error('Non connecté');
        }

        const subscriptions = [];
        let pageToken = '';

        do {
            const url = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Erreur récupération abonnements');
            }

            const data = await response.json();
            
            if (data.items) {
                for (const item of data.items) {
                    const snippet = item.snippet;
                    subscriptions.push({
                        author: snippet.title,
                        authorId: snippet.resourceId.channelId,
                        authorUrl: `/channel/${snippet.resourceId.channelId}`,
                        authorThumbnails: snippet.thumbnails ? [
                            { url: snippet.thumbnails.default?.url, width: 88, height: 88 },
                            { url: snippet.thumbnails.medium?.url, width: 240, height: 240 },
                            { url: snippet.thumbnails.high?.url, width: 800, height: 800 }
                        ].filter(t => t.url) : []
                    });
                }
            }

            pageToken = data.nextPageToken || '';
        } while (pageToken);

        return subscriptions;
    }

    /**
     * Déconnecte l'utilisateur
     */
    logout() {
        if (this.accessToken && window.google?.accounts?.oauth2) {
            window.google.accounts.oauth2.revoke(this.accessToken);
        }
        
        this.accessToken = null;
        this.userInfo = null;
        
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_INFO);
        localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    }

    /**
     * Retourne les infos de l'utilisateur connecté
     */
    getUserInfo() {
        return this.userInfo;
    }
}

export default new YouTubeAuthService();
