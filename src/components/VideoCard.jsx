import React from 'react';
import './VideoCard.css';

const VideoCard = ({ video, onMarkAsRead, onPlay, onChannelClick, isWatched }) => {
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

                <button className="mark-read-btn" onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(video.videoId);
                }}>
                    Marquer comme lu
                </button>
            </div>
        </div>
    );
};

export default VideoCard;
