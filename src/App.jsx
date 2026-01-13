import React, { useState, useEffect } from 'react';
import './App.css';
import invidiousService from './services/invidiousService';
import subscriptionService from './services/subscriptionService';
import VideoCard from './components/VideoCard';
import ChannelCard from './components/ChannelCard';

function App() {
    const [videos, setVideos] = useState([]);
    const [channels, setChannels] = useState([]);
    const [subscriptions, setSubscriptions] = useState(subscriptionService.getSubscriptions());
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('new'); // 'new', 'subs', 'search', 'channel'
    const [currentVideo, setCurrentVideo] = useState(null);
    const [viewingChannel, setViewingChannel] = useState(null);

    useEffect(() => {
        if (activeTab === 'new') {
            loadNewVideos();
        }
    }, [activeTab]);

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

    const handleImportOPML = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const xmlContent = event.target.result;
                const newSubs = await subscriptionService.importFromOPML(xmlContent);
                setSubscriptions([...newSubs]);
                alert('Import réussi ! Vos abonnements ont été ajoutés.');
            } catch (error) {
                alert('Erreur lors de l\'import du fichier.');
            }
        };
        reader.readAsText(file);
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
                        <ul>
                            <li
                                className={activeTab === 'new' ? 'active' : ''}
                                onClick={() => setActiveTab('new')}
                            >
                                Nouveautés
                            </li>
                            <li
                                className={activeTab === 'subs' ? 'active' : ''}
                                onClick={() => setActiveTab('subs')}
                            >
                                Abonnements
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
                            <label className="import-btn">
                                Import OPML
                                <input type="file" accept=".xml,.opml" onChange={handleImportOPML} hidden />
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
