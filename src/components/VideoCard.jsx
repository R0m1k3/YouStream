import React from 'react';
import './VideoCard.css';

const VideoCard = ({ video, onMarkAsRead, onPlay }) => {
    const formatViews = (views) => {
        if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
        if (views >= 1000) return (views / 1000).toFixed(1) + 'k';
        return views;
    };

    return (
        <div className="video-card">
            <div className="thumbnail-container" onClick={() => onPlay(video)}>
                <img src={video.videoThumbnails[0]?.url} alt={video.title} className="thumbnail" />
                <span className="duration">{Math.floor(video.lengthSeconds / 60)}:{(video.lengthSeconds % 60).toString().padStart(2, '0')}</span>
            </div>

            <div className="video-info">
                <h3 className="video-title" title={video.title} onClick={() => onPlay(video)}>{video.title}</h3>
                <p className="channel-name">{video.author}</p>
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
