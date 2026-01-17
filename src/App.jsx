import React, { useState, useEffect } from 'react';
import './App.css';
import invidiousService from './services/invidiousService';
import subscriptionService from './services/subscriptionService';
import youtubeAuthService from './services/youtubeAuthService';
import VideoCard from './components/VideoCard';
import ChannelCard from './components/ChannelCard';
import GoogleLoginButton from './components/GoogleLoginButton';
import { useFeed } from './hooks/useFeed';

function App() {
    const [videos, setVideos] = useState([]);
    const [channels, setChannels] = useState([]);
    const [subscriptions, setSubscriptions] = useState(subscriptionService.getSubscriptions());
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('new'); // 'new', 'subs', 'search', 'channel', 'player'
    const [previousTab, setPreviousTab] = useState('new');
    const [currentVideo, setCurrentVideo] = useState(null);
    const [viewingChannel, setViewingChannel] = useState(null);
    const [cookie, setCookie] = useState('');
    const [isYoutubeConnected, setIsYoutubeConnected] = useState(youtubeAuthService.isLoggedIn());
    const [youtubeUser, setYoutubeUser] = useState(youtubeAuthService.getUserInfo());
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    const [channelFilter, setChannelFilter] = useState('');

    const YOUTUBE_CLIENT_ID = localStorage.getItem('youstream_yt_client_id') || '';

    // React Query Feed
    const { videos: feedVideos, isLoading: feedLoading } = useFeed(subscriptions);

    useEffect(() => {
        if (activeTab === 'new') {
            if (subscriptions.length > 0) {
                setVideos(feedVideos);
            } else {
                loadTrendingFallback();
            }
        }
    }, [activeTab, subscriptions, feedVideos]);

    // Détection automatique d'import via Bookmarklet (URL sync=...)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const syncData = urlParams.get('sync');
        if (syncData) {
            handleAutoImport(syncData);
        }
    }, []);

    // Effect : Charger les thumbnails manquantes pour les abonnements
    useEffect(() => {
        const fetchMissingThumbnails = async () => {
            if (activeTab === 'subs') {
                const missingSubs = subscriptions.filter(s => !s.authorThumbnails || s.authorThumbnails.length === 0);
                if (missingSubs.length === 0) return;

                // On ne charge pas tout d'un coup pour éviter de spammer l'API
                // On prend les 5 premiers manquants
                const batch = missingSubs.slice(0, 5);

                for (const sub of batch) {
                    try {
                        const info = await invidiousService.getChannelInfo(sub.authorId);
                        if (info && info.authorThumbnails) {
                            const updatedSub = { ...sub, authorThumbnails: info.authorThumbnails };
                            subscriptionService.addSubscription(updatedSub);
                            setSubscriptions(prev => prev.map(s => s.authorId === sub.authorId ? updatedSub : s));
                        }
                    } catch (e) {
                        console.warn('Failed to fetch thumbnail for', sub.author);
                    }
                }
            }
        };

        if (activeTab === 'subs') {
            fetchMissingThumbnails();
        }
    }, [activeTab, subscriptions]);

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

    const loadTrendingFallback = async () => {
        setLoading(true);
        try {
            const data = await invidiousService.search('trending', 'video');
            setVideos(data.filter(v => !subscriptionService.isWatched(v.videoId)));
        } catch (error) {
            console.error('Erreur loading trending:', error);
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
        setPreviousTab(activeTab);
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

                // Détection format Netscape Cookie vs Favoris
                if (content.includes('# Netscape HTTP Cookie File')) {
                    alert("⚠️ Attention : Vous avez uploadé un fichier de Cookie et non de Favoris.\n\nPour des raisons de sécurité, nous ne pouvons pas utiliser vos cookies directement ici.\n\n✅ SOLUTION FACILE :\nUtilisez le 'Magic Button' (dans les paramètres) pour synchroniser vos abonnements en 1 clic !");
                    return;
                }

                if (file.name.endsWith('.csv')) {
                    newSubs = await subscriptionService.importFromCSV(content);
                } else if (file.name.endsWith('.html') || content.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>')) {
                    newSubs = await subscriptionService.importFromNetscapeHTML(content);
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

    const handlePlay = async (video) => {
        setLoading(true);
        try {
            // On récupère les détails complets pour avoir l'URL du flux
            const details = await invidiousService.getVideoDetails(video.videoId);
            const streamUrl = invidiousService.getBestStreamUrl(details);

            if (streamUrl) {
                // Marquer comme vue
                subscriptionService.markAsWatched(video.videoId);
                // Sauvegarder l'onglet précédent et passer en mode player
                setPreviousTab(activeTab);
                setCurrentVideo({ ...video, ...details, streamUrl });
                setActiveTab('player');
            } else {
                alert("Aucun flux vidéo compatible trouvé.");
            }
        } catch (error) {
            console.error('Erreur lecture vidéo:', error);
            alert("Impossible de charger la vidéo.");
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setCurrentVideo(null);
        setActiveTab(previousTab);
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
                                <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17.09 4.56c-.7-1.03-1.5-1.99-2.4-2.85-.35-.34-.94-.02-.84.46.19.94.39 2.18.39 3.29 0 2.06-1.35 3.73-3.41 3.73-1.54 0-2.8-.93-3.35-2.26-.1-.2-.14-.32-.2-.48-.11-.3-.5-.41-.73-.15-1.71 1.89-2.67 4.39-2.67 6.97 0 4.7 3.95 8.77 9.12 8.77s9.12-4.04 9.12-8.77c0-3.19-1.86-6.15-5.03-8.71zm-5.97 13.87c-1.45 0-2.63-1.18-2.63-2.63 0-1.19.72-2.14 1.91-2.53 1.19-.39 2.55-.04 3.34 1.01.65.86.61 2.03-.08 2.86-.62.72-1.55 1.29-2.54 1.29z" /></svg>
                                Nouveautés
                            </li>
                            <li
                                className={activeTab === 'subs' ? 'active' : ''}
                                onClick={() => setActiveTab('subs')}
                            >
                                <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" /></svg>
                                Abonnements
                            </li>
                            <li
                                className={activeTab === 'favs' ? 'active' : ''}
                                onClick={() => setActiveTab('favs')}
                            >
                                <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                Favoris
                            </li>
                        </ul>
                        <div className="sidebar-footer">
                            <button className="settings-btn" onClick={() => setActiveTab('settings')}>
                                <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
                                Paramètres
                            </button>
                        </div>
                    </nav>
                </aside>

                <section className="video-feed">
                    <div className="feed-header">
                        {activeTab === 'player' && currentVideo ? (
                            <div className="player-header">
                                <button className="back-btn" onClick={handleBack}>
                                    <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                                    Retour
                                </button>
                            </div>
                        ) : activeTab === 'search' ? (
                            <h2>Résultats pour "{searchQuery}"</h2>
                        ) : activeTab === 'subs' ? (
                            <div className="subs-header">
                                <h2>Mes Abonnements ({subscriptions.length})</h2>
                                <input
                                    type="text"
                                    placeholder="Filtrer les chaînes..."
                                    value={channelFilter}
                                    onChange={(e) => setChannelFilter(e.target.value)}
                                    className="channel-filter-input"
                                />
                            </div>
                        ) : activeTab === 'channel' ? (
                            <div className="channel-header-view">
                                <button className="back-btn" onClick={handleBack}>
                                    <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                                </button>
                                <img src={viewingChannel.authorThumbnails?.[viewingChannel.authorThumbnails.length - 1]?.url} alt="" />
                                <h2>{viewingChannel.author}</h2>
                                {subscriptions.find(s => s.authorId === viewingChannel.authorId) ? (
                                    <button className="unsub-btn-header" onClick={() => handleUnsubscribe(viewingChannel.authorId)}>Désabonner</button>
                                ) : (
                                    <button className="sub-btn-header" onClick={() => handleSubscribe(viewingChannel)}>S'abonner</button>
                                )}
                            </div>
                        ) : (
                            <h2>Dernières nouveautés</h2>
                        )}
                    </div>

                    {loading || (activeTab === 'new' && feedLoading) ? (
                        <div className="loader-container">
                            <div className="loader"></div>
                            <p>Chargement...</p>
                        </div>
                    ) : activeTab === 'settings' ? (
                        <div className="settings-view">
                            <h2>Paramètres & Compte</h2>

                            <div className="settings-section magic-section">
                                <h3>
                                    <svg className="section-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" /></svg>
                                    Synchroniser vos abonnements YouTube
                                </h3>
                                <p>Glissez ce bouton dans votre barre de favoris pour synchroniser vos abonnements en 1 clic.</p>

                                <a
                                    className="bookmarklet-btn"
                                    href={`javascript:(function(){function g(){let d=window.ytInitialData,i=[];try{let c=d.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].gridRenderer.items;i=c.map(x=>({author:x.gridChannelRenderer.title.simpleText,authorId:x.gridChannelRenderer.channelId}))}catch(e){i=Array.from(document.querySelectorAll('ytd-channel-renderer,ytd-grid-channel-renderer')).map(e=>{let a=e.querySelector('a#main-link,a#channel-info,a');return{author:e.querySelector('#text,#channel-title,#title').innerText.trim(),authorId:a.href.split('/').pop()}})}return i.filter(x=>x.authorId)}const s=btoa(unescape(encodeURIComponent(JSON.stringify(g()))));window.location.href='http://localhost:3000/?sync='+s;})();`}
                                    onClick={(e) => e.preventDefault()}
                                >
                                    <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" /></svg>
                                    YouStream Sync
                                </a>

                                <ol className="help-list" style={{ marginTop: '20px' }}>
                                    <li>Glissez le bouton ci-dessus dans votre barre de favoris (Ctrl+Shift+B pour l'afficher).</li>
                                    <li>Allez sur votre page <a href="https://www.youtube.com/feed/channels" target="_blank" rel="noreferrer">Abonnements YouTube</a>.</li>
                                    <li>Cliquez sur le favori <strong>"YouStream Sync"</strong>.</li>
                                </ol>
                            </div>

                            <div className="settings-section">
                                <h3>
                                    <svg className="section-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" /></svg>
                                    Mes Abonnements ({subscriptions.length})
                                </h3>
                                {subscriptions.length > 0 ? (
                                    <div className="subscription-manager">
                                        {subscriptions.map(sub => (
                                            <div key={sub.authorId} className="subscription-item">
                                                <span className="sub-name" onClick={() => handleChannelClick(sub)}>
                                                    {sub.author}
                                                </span>
                                                <button
                                                    className="unsub-btn"
                                                    onClick={() => handleUnsubscribe(sub.authorId)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ opacity: 0.6 }}>Aucun abonnement. Utilisez le Magic Button ou la recherche.</p>
                                )}
                            </div>

                            <div className="settings-section">
                                <h3>
                                    <svg className="section-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
                                    Données Locales
                                </h3>
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
                    ) : activeTab === 'player' && currentVideo ? (
                        <div className="player-view">
                            <video
                                controls
                                autoPlay
                                referrerPolicy="no-referrer"
                                src={currentVideo.streamUrl}
                                className="main-video-player"
                            />
                            <div className="video-details">
                                <h2 className="video-title">{currentVideo.title}</h2>
                                <div className="video-meta">
                                    <span className="video-author" onClick={() => handleChannelClick({ author: currentVideo.author, authorId: currentVideo.authorId })}>
                                        {currentVideo.author}
                                    </span>
                                    {currentVideo.viewCount && (
                                        <span className="video-views">{currentVideo.viewCount.toLocaleString()} vues</span>
                                    )}
                                    {currentVideo.publishedText && (
                                        <span className="video-date">{currentVideo.publishedText}</span>
                                    )}
                                </div>
                                {currentVideo.descriptionHtml && (
                                    <div className="video-description" dangerouslySetInnerHTML={{ __html: currentVideo.descriptionHtml }} />
                                )}
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

                            {activeTab === 'subs' && (
                                <div className="channels-grid">
                                    {subscriptions
                                        .filter(sub =>
                                            channelFilter === '' ||
                                            sub.author.toLowerCase().includes(channelFilter.toLowerCase())
                                        )
                                        .map(sub => (
                                            <div
                                                key={sub.authorId}
                                                className="channel-card-mini"
                                                onClick={() => handleChannelClick(sub)}
                                            >
                                                {sub.authorThumbnails?.[0]?.url ? (
                                                    <img
                                                        className="channel-avatar-img"
                                                        src={sub.authorThumbnails[0].url}
                                                        alt={sub.author}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div
                                                    className="channel-avatar"
                                                    style={{ display: sub.authorThumbnails?.[0]?.url ? 'none' : 'flex' }}
                                                >
                                                    {sub.author?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <span className="channel-name">{sub.author}</span>
                                            </div>
                                        ))
                                    }
                                    {subscriptions.length === 0 && (
                                        <p className="placeholder-text">Aucun abonnement. Recherchez des chaînes pour vous abonner.</p>
                                    )}
                                </div>
                            )}

                            {activeTab !== 'subs' && (
                                <div className="video-grid">
                                    {videos.length > 0 ? (
                                        videos.map(video => (
                                            <VideoCard
                                                key={video.videoId}
                                                video={video}
                                                onMarkAsRead={handleMarkAsRead}
                                                onPlay={handlePlay}
                                                onChannelClick={handleChannelClick}
                                                isWatched={subscriptionService.isWatched(video.videoId)}
                                            />
                                        ))
                                    ) : (
                                        <p className="placeholder-text">Aucunes vidéos à afficher.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </main>
        </div>
    )
}

export default App
