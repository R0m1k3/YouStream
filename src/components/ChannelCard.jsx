import React from 'react';
import './ChannelCard.css';

const ChannelCard = ({ channel, isSubscribed, onSubscribe, onUnsubscribe, onClick }) => {
    return (
        <div className="channel-card" onClick={() => onClick(channel)}>
            <div className="channel-avatar">
                <img
                    src={channel.authorThumbnails?.[0]?.url || 'https://via.placeholder.com/100'}
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
