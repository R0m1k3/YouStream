import React, { useState, useEffect } from 'react';
import './App.css';
import invidiousService from './services/invidiousService';
import subscriptionService from './services/subscriptionService';
import youtubeAuthService from './services/youtubeAuthService';
import VideoCard from './components/VideoCard';
import ChannelCard from './components/ChannelCard';
import GoogleLoginButton from './components/GoogleLoginButton';
import { useFeed } from './hooks/useFeed';

const PREDEFINED_INTERESTS = [
    'Intelligence Artificielle', 'Espace & Science', 'High-Tech',
    'Cuisine & Gastronomie', 'ASMR / Relaxation', 'Musique Lo-Fi',
    'Documentaires', 'Jeux Vidéo', 'Nature & Écologie', 'Actualités',
    'DIY & Bricolage', 'Cinéma & Séries', 'Sport & Fitness', 'Histoire & Culture',
    'Programmation', 'Voyages & Aventure', 'Finance & Économie', 'Design & Art',
    'Automobile', 'Développement Personnel', 'Humour', 'Astronomie'
];

function App() {
    const [videos, setVideos] = useState([]);
    const [channels, setChannels] = useState([]);
    const [subscriptions, setSubscriptions] = useState(subscriptionService.getSubscriptions());
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false); // For playing videos without hiding the feed
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('new'); // 'new', 'subs', 'search', 'channel', 'player', 'settings', 'favs', 'discovery'
    const [previousTab, setPreviousTab] = useState('new');
    const [currentVideo, setCurrentVideo] = useState(null);
    const [discoveryCategory, setDiscoveryCategory] = useState(subscriptionService.getDiscoveryCategory());
    const [interests, setInterests] = useState(subscriptionService.getInterests());
    const [selectedInterest, setSelectedInterest] = useState(null);
    const [interestInput, setInterestInput] = useState('');
    const [viewingChannel, setViewingChannel] = useState(null);
    const [cookie, setCookie] = useState('');
    const [isYoutubeConnected, setIsYoutubeConnected] = useState(youtubeAuthService.isLoggedIn());
    const [youtubeUser, setYoutubeUser] = useState(youtubeAuthService.getUserInfo());
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    const [channelFilter, setChannelFilter] = useState('');
    const [favoriteIds, setFavoriteIds] = useState(subscriptionService.getFavorites().map(f => f.videoId));

    const YOUTUBE_CLIENT_ID = localStorage.getItem('youstream_yt_client_id') || '';

    // React Query Feed
    const { videos: feedVideos, isLoading: feedLoading, isFetching: feedFetching } = useFeed(subscriptions);

    // Debug: Log loading state
    console.log('[App] State:', { loading, feedLoading, feedFetching, feedVideosCount: feedVideos.length, subscriptionsCount: subscriptions.length, activeTab });

    useEffect(() => {
        // Initial fallback if no subscriptions
        if (activeTab === 'new' && subscriptions.length === 0) {
            loadTrendingFallback();
        } else if (activeTab === 'discovery') {
            loadTrendingFallback();
        } else if (activeTab === 'favs') {
            setVideos(subscriptionService.getFavorites());
        }
    }, [activeTab, subscriptions.length]); // Dropped feedVideos dependency to break the loop

    // Effect : Charger les abonnements depuis le backend (sync) et URL params
    useEffect(() => {
        // Sync avec le backend
        subscriptionService.fetchSubscriptions().then(setSubscriptions);

        const urlParams = new URLSearchParams(window.location.search);
        const syncData = urlParams.get('sync');
        if (syncData) {
            handleAutoImport(syncData);
        }
    }, []);

    // Effect : Charger les thumbnails manquantes pour les abonnements
    useEffect(() => {
        let intervalId;
        let isMounted = true;

        const fetchMissingThumbnails = async () => {
            if (activeTab !== 'subs' || !isMounted) return;

            const missingSubs = subscriptions.filter(s => !s.authorThumbnails || s.authorThumbnails.length === 0);
            if (missingSubs.length === 0) {
                if (intervalId) clearInterval(intervalId);
                return;
            }

            // Fetch in parallel (batch of 10)
            const batch = missingSubs.slice(0, 10);

            const results = await Promise.allSettled(
                batch.map(sub => invidiousService.getChannelInfo(sub.authorId))
            );

            if (!isMounted) return;

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value?.authorThumbnails) {
                    const sub = batch[index];
                    const updatedSub = { ...sub, authorThumbnails: result.value.authorThumbnails };
                    subscriptionService.addSubscription(updatedSub);
                    setSubscriptions(prev => prev.map(s => s.authorId === sub.authorId ? updatedSub : s));
                }
            });
        };

        if (activeTab === 'subs') {
            fetchMissingThumbnails();
            // Continue loading every 2 seconds until all thumbnails are fetched
            intervalId = setInterval(fetchMissingThumbnails, 2000);
        }

        return () => {
            isMounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [activeTab, subscriptions.length]);

    const handleAutoImport = async (base64Data) => {
        setLoading(true);
        try {
            const newSubs = await subscriptionService.importFromBase64(base64Data);
            setSubscriptions([...newSubs]);
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
        if (loading) return;
        setLoading(true);
        try {
            let mainVideos = [];

            if (selectedInterest) {
                // If a specific interest pill is selected, only show that
                mainVideos = await invidiousService.search(selectedInterest, 'video');
            } else {
                // 1. Fetch from selected category (trending)
                mainVideos = await invidiousService.getTrending(discoveryCategory);

                // 2. Blend with ALL Interests (prioritize interests)
                if (interests.length > 0) {
                    // Pick 2 random interests for variety
                    const shuffled = [...interests].sort(() => 0.5 - Math.random());
                    const selectedInterests = shuffled.slice(0, 2);

                    // Add French context to searches for better localization
                    const lang = navigator.language?.split('-')[0] || 'fr';
                    const langPrefix = lang === 'fr' ? 'français ' : (lang === 'en' ? '' : `${lang} `);

                    let interestVideos = [];
                    for (const interest of selectedInterests) {
                        const localizedQuery = `${langPrefix}${interest}`;
                        // Use recentOnly=true for last month's videos sorted by upload date
                        const results = await invidiousService.search(localizedQuery, 'video', true);
                        interestVideos.push(...results.slice(0, 10));
                    }

                    // Interests Only: no trending videos mixed in
                    mainVideos = interestVideos.slice(0, 30);
                }
            }

            const filtered = mainVideos.filter(v => !subscriptionService.isWatched(v.videoId));
            setVideos(prev => {
                if (prev.length === filtered.length && prev[0]?.videoId === filtered[0]?.videoId) return prev;
                return filtered;
            });
        } catch (error) {
            console.error('Erreur loading trending:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryChange = (cat) => {
        subscriptionService.setDiscoveryCategory(cat);
        setDiscoveryCategory(cat);
        setSelectedInterest(null);
        if (activeTab === 'discovery') loadTrendingFallback();
    };

    const handleInterestPillClick = (keyword) => {
        if (selectedInterest === keyword) {
            setSelectedInterest(null);
        } else {
            setSelectedInterest(keyword);
        }
        if (activeTab === 'discovery') loadTrendingFallback();
    };

    const handleAddInterest = (e) => {
        if (e.key === 'Enter' && interestInput.trim()) {
            const newInterests = subscriptionService.addInterest(interestInput.trim());
            setInterests([...newInterests]);
            setInterestInput('');
        }
    };

    const handleRemoveInterest = (keyword) => {
        const newInterests = subscriptionService.removeInterest(keyword);
        setInterests([...newInterests]);
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
        setVideos([]); // Immediate reset to avoid "ghost" videos from previous view
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

                if (content.includes('# Netscape HTTP Cookie File')) {
                    alert("⚠️ Attention : Vous avez uploadé un fichier de Cookie et non de Favoris.");
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
                alert('Erreur lors de l\'import du fichier.');
            }
        };
        reader.readAsText(file);
    };

    const handleToggleFavorite = (video) => {
        if (subscriptionService.isFavorite(video.videoId)) {
            subscriptionService.removeFavorite(video.videoId);
            setFavoriteIds(prev => prev.filter(id => id !== video.videoId));
        } else {
            subscriptionService.addFavorite(video);
            setFavoriteIds(prev => [...prev, video.videoId]);
        }
    };

    const handleMarkAsRead = (videoId) => {
        subscriptionService.markAsWatched(videoId);
        setVideos(prev => prev.filter(v => v.videoId !== videoId));
    };

    const handlePlay = async (video) => {
        setActionLoading(true); // Don't hide the whole feed, just show a minor indicator if needed
        try {
            const details = await invidiousService.getVideoDetails(video.videoId);
            const streamUrl = invidiousService.getBestStreamUrl(details);

            if (streamUrl) {
                subscriptionService.markAsWatched(video.videoId);
                setPreviousTab(activeTab);
                setCurrentVideo({ ...video, ...details, streamUrl });
                setActiveTab('player');
            } else {
                alert("Aucun flux vidéo compatible trouvé.");
            }
        } catch (error) {
            console.error('Erreur lecture vidéo:', error);
            alert("Impossible de charger la vidéo. Vérifiez votre connexion à Invidious.");
        } finally {
            setActionLoading(false);
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
                    {feedFetching && (
                        <div className="refresh-indicator header-sync">
                            <div className="mini-loader"></div>
                            <span>Synchronisation...</span>
                        </div>
                    )}
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
                                className={activeTab === 'discovery' ? 'active' : ''}
                                onClick={() => setActiveTab('discovery')}
                            >
                                <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" /></svg>
                                Découverte
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
                        ) : activeTab === 'settings' ? (
                            <h2>Paramètres & Compte</h2>
                        ) : activeTab === 'discovery' ? (
                            <h2>Découverte & Tendances</h2>
                        ) : activeTab === 'favs' ? (
                            <h2>Mes Favoris</h2>
                        ) : (
                            <div className="header-with-status">
                                <h2>{activeTab === 'new' ? 'Dernières nouveautés' : 'Favoris'}</h2>
                            </div>
                        )}
                    </div>


                    {(loading || (activeTab === 'new' && feedLoading && feedVideos.length === 0)) ? (
                        <div className="loader-container">
                            <div className="loader"></div>
                            <p>Chargement du flux...</p>
                        </div>
                    ) : actionLoading ? (
                        <div className="action-loader-overlay">
                            <div className="loader"></div>
                            <p>Chargement de la vidéo...</p>
                        </div>
                    ) : activeTab === 'settings' ? (
                        <div className="settings-view">
                            <div className="settings-section magic-section">
                                <h3>Synchroniser vos abonnements YouTube</h3>
                                <p>Glissez ce bouton dans votre barre de favoris pour synchroniser vos abonnements en 1 clic.</p>

                                <a
                                    className="bookmarklet-btn"
                                    href={`javascript:(function(){function g(){let d=window.ytInitialData,i=[];try{let c=d.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].gridRenderer.items;i=c.map(x=>({author:x.gridChannelRenderer.title.simpleText,authorId:x.gridChannelRenderer.channelId}))}catch(e){i=Array.from(document.querySelectorAll('ytd-channel-renderer,ytd-grid-channel-renderer')).map(e=>{let a=e.querySelector('a#main-link,a#channel-info,a');return{author:e.querySelector('#text,#channel-title,#title').innerText.trim(),authorId:a.href.split('/').pop()}})}return i.filter(x=>x.authorId)}const s=btoa(unescape(encodeURIComponent(JSON.stringify(g()))));window.location.href='http://localhost:3000/?sync='+s;})();`}
                                    onClick={(e) => e.preventDefault()}
                                >
                                    YouStream Sync
                                </a>
                            </div>

                            <div className="settings-section">
                                <h3>Mes Intérêts (Découverte)</h3>
                                <p style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    Ajoutez des mots-clés pour personnaliser vos recommandations.
                                </p>

                                <div className="suggestions-grid" style={{ marginBottom: '20px' }}>
                                    <span style={{ display: 'block', width: '100%', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px' }}>Suggestions :</span>
                                    {PREDEFINED_INTERESTS.filter(p => !interests.includes(p)).map(p => (
                                        <button key={p} className="suggestion-badge" onClick={() => {
                                            const newInt = subscriptionService.addInterest(p);
                                            setInterests([...newInt]);
                                        }}>+ {p}</button>
                                    ))}
                                </div>

                                <input
                                    type="text"
                                    className="channel-filter-input"
                                    placeholder="Ajouter un intérêt personnalisé..."
                                    value={interestInput}
                                    onChange={(e) => setInterestInput(e.target.value)}
                                    onKeyDown={handleAddInterest}
                                    style={{ marginBottom: '16px', width: '100%' }}
                                />
                                <div className="interests-tags">
                                    {interests.map(interest => (
                                        <span key={interest} className="interest-tag">
                                            {interest}
                                            <button onClick={() => handleRemoveInterest(interest)}>✕</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="settings-section">
                                <h3>Mes Abonnements ({subscriptions.length})</h3>
                                <div className="subscription-manager">
                                    {subscriptions.map(sub => (
                                        <div key={sub.authorId} className="subscription-item">
                                            <span className="sub-name" onClick={() => handleChannelClick(sub)}>{sub.author}</span>
                                            <button className="unsub-btn" onClick={() => handleUnsubscribe(sub.authorId)}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'player' && currentVideo ? (
                        <div className="player-view">
                            <video
                                controls
                                autoPlay
                                src={currentVideo.streamUrl}
                                className="main-video-player"
                            />
                            <div className="video-details">
                                <h2 className="video-title">{currentVideo.title}</h2>
                                <div className="video-meta">
                                    <span className="video-author" onClick={() => handleChannelClick({ author: currentVideo.author, authorId: currentVideo.authorId })}>{currentVideo.author}</span>
                                </div>
                                {currentVideo.description && (
                                    <div className="video-description">
                                        {currentVideo.description}
                                    </div>
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
                                        .filter(sub => channelFilter === '' || sub.author.toLowerCase().includes(channelFilter.toLowerCase()))
                                        .map(sub => (
                                            <div key={sub.authorId} className="channel-card-mini" onClick={() => handleChannelClick(sub)}>
                                                {sub.authorThumbnails && sub.authorThumbnails.length > 0 ? (
                                                    <img
                                                        src={sub.authorThumbnails[0].url}
                                                        alt={sub.author}
                                                        className="channel-avatar-img"
                                                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                    />
                                                ) : null}
                                                <div className="channel-avatar" style={{ display: sub.authorThumbnails && sub.authorThumbnails.length > 0 ? 'none' : 'flex' }}>
                                                    {sub.author?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <span className="channel-name">{sub.author}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}

                            {activeTab === 'discovery' && (
                                <div className="category-pills">
                                    {['Trending', 'Music', 'Gaming', 'Technology', 'News', 'Movies'].map(cat => (
                                        <button
                                            key={cat}
                                            className={`pill ${discoveryCategory === cat && !selectedInterest ? 'active' : ''}`}
                                            onClick={() => handleCategoryChange(cat)}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                    <div className="pill-divider" />
                                    {interests.map(interest => (
                                        <button
                                            key={interest}
                                            className={`pill interest-pill ${selectedInterest === interest ? 'active' : ''}`}
                                            onClick={() => handleInterestPillClick(interest)}
                                        >
                                            {interest}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeTab !== 'subs' && (
                                <div className="video-grid">
                                    {(activeTab === 'new' && subscriptions.length > 0 ? feedVideos : videos).length > 0 ? (
                                        (activeTab === 'new' && subscriptions.length > 0 ? feedVideos : videos).map(video => (
                                            <VideoCard
                                                key={video.videoId}
                                                video={video}
                                                onMarkAsRead={handleMarkAsRead}
                                                onPlay={handlePlay}
                                                onChannelClick={handleChannelClick}
                                                isWatched={subscriptionService.isWatched(video.videoId)}
                                                onToggleFavorite={handleToggleFavorite}
                                                isFavorite={favoriteIds.includes(video.videoId)}
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
    );
}

export default App;
