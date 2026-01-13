import React, { useState, useEffect } from 'react';
import './App.css';
import invidiousService from './services/invidiousService';
import subscriptionService from './services/subscriptionService';
import youtubeAuthService from './services/youtubeAuthService';
import VideoCard from './components/VideoCard';
import ChannelCard from './components/ChannelCard';
import GoogleLoginButton from './components/GoogleLoginButton';

function App() {
    const [videos, setVideos] = useState([]);
    const [channels, setChannels] = useState([]);
    const [subscriptions, setSubscriptions] = useState(subscriptionService.getSubscriptions());
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('new'); // 'new', 'subs', 'search', 'channel'
    const [currentVideo, setCurrentVideo] = useState(null);
    const [viewingChannel, setViewingChannel] = useState(null);
    const [cookie, setCookie] = useState('');
    const [isYoutubeConnected, setIsYoutubeConnected] = useState(youtubeAuthService.isLoggedIn());
    const [youtubeUser, setYoutubeUser] = useState(youtubeAuthService.getUserInfo());
    const [youtubeLoading, setYoutubeLoading] = useState(false);

    // Client ID YouTube - À configurer
    const YOUTUBE_CLIENT_ID = localStorage.getItem('youstream_yt_client_id') || '';

    useEffect(() => {
        if (activeTab === 'new') {
            loadNewVideos();
        }
    }, [activeTab]);

    // Détection automatique d'import via Bookmarklet (URL sync=...)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const syncData = urlParams.get('sync');
        if (syncData) {
            handleAutoImport(syncData);
        }
    }, []);

    const handleAutoImport = async (base64Data) => {
        setLoading(true);
        try {
            const newSubs = await subscriptionService.importFromBase64(base64Data);
            setSubscriptions([...newSubs]);
            // Nettoyage de l'URL pour éviter les ré-imports au refresh
            window.history.replaceState({}, document.title, "/");
            alert(`Synchronisation automatique réussie ! ${newSubs.length} abonnements ajoutés.`);
            setActiveTab('subs');
        } catch (error) {
            console.error('Erreur import auto:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadNewVideos = async () => {
        setLoading(true);
        try {
            // Pour le MVP, si pas d'abonnements, on montre des tendances ou une recherche par défaut
            const subs = subscriptionService.getSubscriptions();

            if (subs.length === 0) {
                // Fallback sur une recherche "trending" si pas d'abonnements
                const data = await invidiousService.search('trending', 'video');
                setVideos(data.filter(v => !subscriptionService.isWatched(v.videoId)));
            } else {
                // Récupérer les vidéos de chaque chaîne et fusionner/trier
                // Pour limiter les appels, on prend les 3 dernières de chaque chaîne pour le MVP
                let allVideos = [];
                for (const sub of subs) {
                    const channelVideos = await invidiousService.getChannelVideos(sub.authorId);
                    allVideos = [...allVideos, ...channelVideos];
                }
                // Trier par date (approximation via publishedText pour le moment ou metadata)
                // Et filtrer les déjà lues
                setVideos(allVideos.filter(v => !subscriptionService.isWatched(v.videoId)));
            }
        } catch (error) {
            console.error('Erreur chargement vidéos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            setLoading(true);
            setCurrentVideo(null);
            setViewingChannel(null);
            try {
                const videoResults = await invidiousService.search(searchQuery, 'video');
                const channelResults = await invidiousService.search(searchQuery, 'channel');

                setVideos(videoResults.filter(v => !subscriptionService.isWatched(v.videoId)));
                setChannels(channelResults);
                setActiveTab('search');
            } catch (error) {
                console.error('Erreur recherche:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSubscribe = (channel) => {
        const newSubs = subscriptionService.addSubscription(channel);
        setSubscriptions([...newSubs]);
    };

    const handleUnsubscribe = (channelId) => {
        const newSubs = subscriptionService.removeSubscription(channelId);
        setSubscriptions([...newSubs]);
    };

    const handleChannelClick = async (channel) => {
        setLoading(true);
        setCurrentVideo(null);
        setViewingChannel(channel);
        setActiveTab('channel');
        try {
            const channelVideos = await invidiousService.getChannelVideos(channel.authorId);
            setVideos(channelVideos.filter(v => !subscriptionService.isWatched(v.videoId)));
        } catch (error) {
            console.error('Erreur chargement vidéos chaîne:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleImportSubscriptions = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target.result;
                let newSubs;
                if (file.name.endsWith('.csv')) {
                    newSubs = await subscriptionService.importFromCSV(content);
                } else {
                    newSubs = await subscriptionService.importFromOPML(content);
                }
                setSubscriptions([...newSubs]);
                alert(`Import réussi ! ${newSubs.length} abonnements au total.`);
            } catch (error) {
                alert('Erreur lors de l\'import du fichier. Vérifiez le format (XML ou CSV).');
            }
        };
        reader.readAsText(file);
    };

    const handleJSONSync = async (jsonText) => {
        try {
            const newSubs = await subscriptionService.importFromJSON(jsonText);
            setSubscriptions([...newSubs]);
            alert(`Succès ! ${newSubs.length} abonnements synchronisés.`);
            setCookie(''); // On vide le champ après succès
        } catch (error) {
            alert('Format de données invalide. Utilisez le script fourni sur YouTube.');
        }
    };

    const handleCookieSync = () => {
        if (!cookie.trim()) return alert('Veuillez coller un cookie.');
        alert('Synchronisation via cookie en cours (Expérimental)...\nNote: Cette fonctionnalité nécessite une instance Invidious compatible ou un proxy.');
        console.log('Cookie utilisé:', cookie);
    };

    const handleYoutubeLogin = async () => {
        const clientId = localStorage.getItem('youstream_yt_client_id');
        if (!clientId) {
            alert('Veuillez d\'abord configurer votre Client ID YouTube dans les paramètres.');
            return;
        }

        setYoutubeLoading(true);
        try {
            youtubeAuthService.setClientId(clientId);
            const result = await youtubeAuthService.login();
            setIsYoutubeConnected(true);
            setYoutubeUser(result.user);

            // Récupérer et importer les abonnements
            const ytSubs = await youtubeAuthService.getSubscriptions();
            const merged = await subscriptionService.importFromJSON(ytSubs);
            setSubscriptions([...merged]);
            alert(`Connecté ! ${ytSubs.length} abonnements importés depuis YouTube.`);
        } catch (error) {
            console.error('Erreur connexion YouTube:', error);
            alert(`Erreur de connexion: ${error.message}`);
        } finally {
            setYoutubeLoading(false);
        }
    };

    const handleYoutubeLogout = () => {
        youtubeAuthService.logout();
        setIsYoutubeConnected(false);
        setYoutubeUser(null);
    };

    const handleSaveClientId = (clientId) => {
        localStorage.setItem('youstream_yt_client_id', clientId);
        youtubeAuthService.setClientId(clientId);
        alert('Client ID sauvegardé !');
    };

    const handleMarkAsRead = (videoId) => {
        subscriptionService.markAsWatched(videoId);
        setVideos(prev => prev.filter(v => v.videoId !== videoId));
    };

    const handlePlay = (video) => {
        setCurrentVideo(video);
    };

    return (
        <div className="app-container">
            <header className="main-header">
                <h1 onClick={() => setActiveTab('new')} style={{ cursor: 'pointer' }}>YouStream</h1>
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Rechercher une vidéo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                    />
                </div>
                <div className="user-profile">
                    {/* Simulation d'un profil ou paramètres */}
                    <div className="avatar">M</div>
                </div>
            </header>

            <main className="content">
                <aside className="sidebar">
                    <nav>
                        <ul className="nav-links">
                            <li
                                className={activeTab === 'new' ? 'active' : ''}
                                onClick={() => setActiveTab('new')}
                            >
                                <span className="icon">🔥</span> Nouveautés
                            </li>
                            <li
                                className={activeTab === 'subs' ? 'active' : ''}
                                onClick={() => setActiveTab('subs')}
                            >
                                <span className="icon">📺</span> Abonnements
                            </li>
                            <li
                                className={activeTab === 'favs' ? 'active' : ''}
                                onClick={() => setActiveTab('favs')}
                            >
                                <span className="icon">⭐</span> Favoris
                            </li>
                        </ul>
                        {subscriptions.length > 0 && (
                            <div className="sub-list">
                                <h4>Mes chaînes</h4>
                                <ul>
                                    {subscriptions.map(sub => (
                                        <li key={sub.authorId} onClick={() => handleChannelClick(sub)}>
                                            {sub.author}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="sidebar-footer">
                            <button className="settings-btn" onClick={() => setActiveTab('settings')}>
                                <span className="icon">⚙️</span> Paramètres
                            </button>
                            <label className="import-btn">
                                <span>📥</span> Importer abonnements
                                <input type="file" accept=".xml,.opml,.csv" onChange={handleImportSubscriptions} hidden />
                            </label>
                        </div>
                    </nav>
                </aside>

                <section className="video-feed">
                    {currentVideo ? (
                        <div className="video-player-overlay">
                            <div className="player-container">
                                <button className="close-player" onClick={() => setCurrentVideo(null)}>×</button>
                                <video
                                    controls
                                    autoPlay
                                    src={`https://yewtu.be/latest_version?id=${currentVideo.videoId}&itag=22`}
                                    className="main-video-player"
                                />
                                <div className="player-info">
                                    <h2>{currentVideo.title}</h2>
                                    <p>{currentVideo.author}</p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="feed-header">
                        {activeTab === 'search' ? (
                            <h2>Résultats pour "{searchQuery}"</h2>
                        ) : activeTab === 'channel' ? (
                            <div className="channel-header-view">
                                <img src={viewingChannel.authorThumbnails?.[viewingChannel.authorThumbnails.length - 1]?.url} alt="" />
                                <h2>{viewingChannel.author}</h2>
                                {subscriptions.find(s => s.authorId === viewingChannel.authorId) ? (
                                    <button onClick={() => handleUnsubscribe(viewingChannel.authorId)}>Désabonner</button>
                                ) : (
                                    <button onClick={() => handleSubscribe(viewingChannel)}>S'abonner</button>
                                )}
                            </div>
                        ) : (
                            <h2>Dernières nouveautés</h2>
                        )}
                    </div>

                    {loading ? (
                        <div className="loader-container">
                            <div className="loader"></div>
                            <p>Chargement...</p>
                        </div>
                    ) : activeTab === 'settings' ? (
                        <div className="settings-view">
                            <h2>Paramètres & Compte</h2>

                            <div className="settings-section youtube-section">
                                <h3>🔴 Connexion YouTube</h3>
                                <p>Connectez-vous pour importer automatiquement vos abonnements.</p>

                                <GoogleLoginButton
                                    isConnected={isYoutubeConnected}
                                    userInfo={youtubeUser}
                                    onLogin={handleYoutubeLogin}
                                    onLogout={handleYoutubeLogout}
                                    isLoading={youtubeLoading}
                                />

                                {!isYoutubeConnected && (
                                    <div className="client-id-config" style={{ marginTop: '20px' }}>
                                        <p style={{ fontSize: '12px', opacity: 0.7 }}>
                                            Configurez d'abord votre Client ID Google Cloud :
                                        </p>
                                        <input
                                            type="text"
                                            placeholder="Votre Client ID OAuth 2.0"
                                            defaultValue={YOUTUBE_CLIENT_ID}
                                            className="client-id-input"
                                            onBlur={(e) => handleSaveClientId(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                marginTop: '8px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: 'rgba(255,255,255,0.05)',
                                                color: 'inherit'
                                            }}
                                        />
                                        <a
                                            href="https://console.cloud.google.com/apis/credentials"
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ fontSize: '12px', color: '#4a9eff' }}
                                        >
                                            Créer un Client ID sur Google Cloud Console
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div className="settings-section">
                                <h3>Gestion de l'instance Invidious</h3>
                                <p>Instance actuelle : <code>https://yewtu.be</code></p>
                                <button className="secondary-btn">Changer d'instance</button>
                            </div>

                            <div className="settings-section magic-section">
                                <h3>✨ Magic Button (Synchronisation en 1 clic)</h3>
                                <p>Le moyen le plus simple : glissez ce bouton dans votre barre de favoris.</p>

                                <a
                                    className="bookmarklet-btn"
                                    href={`javascript:(function(){function g(){let d=window.ytInitialData,i=[];try{let c=d.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].gridRenderer.items;i=c.map(x=>({author:x.gridChannelRenderer.title.simpleText,authorId:x.gridChannelRenderer.channelId}))}catch(e){i=Array.from(document.querySelectorAll('ytd-channel-renderer,ytd-grid-channel-renderer')).map(e=>{let a=e.querySelector('a#main-link,a#channel-info,a');return{author:e.querySelector('#text,#channel-title,#title').innerText.trim(),authorId:a.href.split('/').pop()}})}return i.filter(x=>x.authorId)}const s=btoa(unescape(encodeURIComponent(JSON.stringify(g()))));window.location.href='http://localhost:3000/?sync='+s;})();`}
                                    onClick={(e) => e.preventDefault()}
                                >
                                    🚀 YouStream Sync
                                </a>

                                <ol className="help-list" style={{ marginTop: '20px' }}>
                                    <li>Glissez le bouton ci-dessus dans votre barre de favoris (Ctrl+Shift+B pour l'afficher).</li>
                                    <li>Allez sur votre page <a href="https://www.youtube.com/feed/channels" target="_blank" rel="noreferrer">Abonnements YouTube</a>.</li>
                                    <li>Cliquez sur le favori <strong>"YouStream Sync"</strong>.</li>
                                </ol>
                            </div>

                            <div className="settings-section">
                                <h3>⚙️ Import Manuel (Script)</h3>
                                <p>Si le bouton ne fonctionne pas, copiez ce script dans la console (F12) :</p>
                                <div className="code-block">
                                    <code>{`const s=JSON.stringify(Array.from(document.querySelectorAll('ytd-channel-renderer, ytd-grid-channel-renderer')).map(e=>{const a=e.querySelector('a#main-link, a#channel-info, a');return{author:e.querySelector('#text, #channel-title, #title').innerText.trim(),authorId:a.href.split('/').pop()}}).filter(c=>c.authorId));console.log(s);copy(s);alert('Copié !');`}</code>
                                </div>
                                <textarea
                                    placeholder="Collez le résultat ici..."
                                    className="cookie-input"
                                    value={cookie}
                                    onChange={(e) => setCookie(e.target.value)}
                                ></textarea>
                                <button className="accent-btn" onClick={() => handleJSONSync(cookie)}>Importer manuellement</button>
                            </div>

                            <div className="settings-section">
                                <h3>Données Locales</h3>
                                <p>Abonnements : {subscriptions.length}</p>
                                <button
                                    className="danger-btn"
                                    onClick={() => {
                                        if (window.confirm('Voulez-vous vraiment tout supprimer ?')) {
                                            localStorage.clear();
                                            window.location.reload();
                                        }
                                    }}
                                >
                                    Effacer toutes les données
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="content-scroll">
                            {activeTab === 'search' && channels.length > 0 && (
                                <div className="channels-results">
                                    <h3>Chaînes</h3>
                                    {channels.slice(0, 3).map(channel => (
                                        <ChannelCard
                                            key={channel.authorId}
                                            channel={channel}
                                            isSubscribed={subscriptions.find(s => s.authorId === channel.authorId)}
                                            onSubscribe={handleSubscribe}
                                            onUnsubscribe={handleUnsubscribe}
                                            onClick={handleChannelClick}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="video-grid">
                                {videos.length > 0 ? (
                                    videos.map(video => (
                                        <VideoCard
                                            key={video.videoId}
                                            video={video}
                                            onMarkAsRead={handleMarkAsRead}
                                            onPlay={handlePlay}
                                        />
                                    ))
                                ) : (
                                    <p className="placeholder-text">Aucunes vidéos à afficher.</p>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    )
}

export default App
