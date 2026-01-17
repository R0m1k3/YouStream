import React from 'react';
import './VideoCard.css';

const VideoCard = ({ video, onMarkAsRead, onPlay, onChannelClick, isWatched, onToggleFavorite, isFavorite }) => {
    const formatViews = (views) => {
        if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
        if (views >= 1000) return (views / 1000).toFixed(1) + 'k';
        return views;
    };

    return (
        <div className={`video-card ${isWatched ? 'watched' : ''}`}>
            <div className="thumbnail-container" onClick={() => onPlay(video)}>
                <img
                    src={video.videoThumbnails?.[0]?.url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCBzbGljZSIgZm9jdXNhYmxlPSJmYWxzZSIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJQbGFjZWhvbGRlciI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzU1NSI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjMzMzIiBkeT0iLjNlbSIgc3R5bGU9ImZvbnQtc2l6ZToyMHB4O3RleHQtYW5jaG9yOm1pZGRsZTtmb250LWZhbWlseTphcmlhbCI+Tm8gVGh1bWJuYWlsPC90ZXh0Pjwvc3ZnPg=='}
                    alt={video.title}
                    className="thumbnail"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCBzbGljZSIgZm9jdXNhYmxlPSJmYWxzZSIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJQbGFjZWhvbGRlciI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzU1NSI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjMzMzIiBkeT0iLjNlbSIgc3R5bGU9ImZvbnQtc2l6ZToyMHB4O3RleHQtYW5jaG9yOm1pZGRsZTtmb250LWZhbWlseTphcmlhbCI+RXJyb3I8L3RleHQ+PC9zdmc+'; }}
                />
                <span className="duration">{Math.floor(video.lengthSeconds / 60)}:{(video.lengthSeconds % 60).toString().padStart(2, '0')}</span>
            </div>

            <div className="video-info">
                <h3 className="video-title" title={video.title} onClick={() => onPlay(video)}>{video.title}</h3>
                <p
                    className="channel-name"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onChannelClick) onChannelClick({ author: video.author, authorId: video.authorId });
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    {video.author}
                </p>
                <div className="meta">
                    <span>{formatViews(video.viewCount)} vues</span>
                    <span className="dot">•</span>
                    <span>{video.publishedText}</span>
                </div>

                <div className="card-actions">
                    <button
                        className={`fav-btn ${isFavorite ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleFavorite) onToggleFavorite(video);
                        }}
                        title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                        <svg viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                    </button>
                    <button className="mark-read-btn" onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsRead(video.videoId);
                    }}>
                        Marquer lu
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoCard;
