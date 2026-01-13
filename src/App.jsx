import React, { useState, useEffect } from 'react';
import './App.css';
import invidiousService from './services/invidiousService';
import subscriptionService from './services/subscriptionService';
import VideoCard from './components/VideoCard';
import ChannelCard from './components/ChannelCard';

function App() {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('new'); // 'new', 'subs', 'favs'
    const [currentVideo, setCurrentVideo] = useState(null);

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
            try {
                const data = await invidiousService.search(searchQuery, 'video');
                setVideos(data.filter(v => !subscriptionService.isWatched(v.videoId)));
                setActiveTab('search');
            } catch (error) {
                console.error('Erreur recherche:', error);
            } finally {
                setLoading(false);
            }
        }
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
                            <li>Favoris</li>
                        </ul>
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
                        <h2>{activeTab === 'search' ? `Résultats pour "${searchQuery}"` : 'Dernières nouveautés'}</h2>
                    </div>

                    {loading ? (
                        <div className="loader-container">
                            <div className="loader"></div>
                            <p>Chargement des vidéos...</p>
                        </div>
                    ) : (
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
                                <p className="placeholder-text">Aucune vidéo trouvée ou tout a été lu !</p>
                            )}
                        </div>
                    )}
                </section>
            </main>
        </div>
    )
}

export default App
