import React from 'react';
import './ChannelCard.css';

const ChannelCard = ({ channel, isSubscribed, onSubscribe, onUnsubscribe, onClick }) => {
    return (
        <div className="channel-card" onClick={() => onClick(channel)}>
            <div className="channel-avatar">
                <img
                    src={channel.authorThumbnails?.[0]?.url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCBzbGljZSIgZm9jdXNhYmxlPSJmYWxzZSIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJQbGFjZWhvbGRlciI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzU1NSI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjMzMzIiBkeT0iLjNlbSIgc3R5bGU9ImZvbnQtc2l6ZToyMHB4O3RleHQtYW5jaG9yOm1pZGRsZTtmb250LWZhbWlseTphcmlhbCI+QXZhPC90ZXh0Pjwvc3ZnPg=='}
                    alt={channel.author}
                />
            </div>
            <div className="channel-info">
                <h3>{channel.author}</h3>
                <p className="sub-count">{channel.subCount?.toLocaleString()} abonnés</p>
                <p className="description">{channel.description}</p>
            </div>
            <div className="channel-actions">
                {isSubscribed ? (
                    <button
                        className="sub-btn subscribed"
                        onClick={(e) => { e.stopPropagation(); onUnsubscribe(channel.authorId); }}
                    >
                        Abonné
                    </button>
                ) : (
                    <button
                        className="sub-btn"
                        onClick={(e) => { e.stopPropagation(); onSubscribe(channel); }}
                    >
                        S'abonner
                    </button>
                )}
            </div>
        </div>
    );
};

export default ChannelCard;
