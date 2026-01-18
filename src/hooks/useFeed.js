import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import invidiousService from '../services/invidiousService';
import subscriptionService from '../services/subscriptionService';

export const useFeed = (subscriptions) => {
    const queries = (subscriptions || []).map((sub) => ({
        queryKey: ['channelVideos', sub.authorId],
        queryFn: async () => {
            let authorId = sub.authorId;
            if (authorId.startsWith('@')) {
                const realId = await invidiousService.resolveHandle(authorId);
                if (realId) {
                    subscriptionService.updateSubscriptionId(authorId, realId);
                    authorId = realId;
                }
            }
            return invidiousService.getChannelVideos(authorId);
        },
        staleTime: 1000 * 60 * 10, // 10 Minutes cache
        cacheTime: 1000 * 60 * 60, // 1 Hour
        retry: 1,
    }));

    const queryResults = useQueries({ queries });

    // Status logic:
    // isLoading: At least one query is actively loading AND we have no data yet
    // isFetching: Background activity (Non-blocking)
    const hasData = queryResults.some(q => q.data && q.data.length > 0);
    const allSettled = queryResults.every(q => !q.isLoading);
    const isLoading = subscriptions.length > 0 && !hasData && !allSettled;
    const isFetching = queryResults.some(q => q.isFetching);

    // Aggregation (Stream-friendly)
    // We memoize the results to prevent infinite re-render loops in consumers
    const videos = useMemo(() => {
        let allVideos = [];
        const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        queryResults.forEach((result) => {
            if (result.data && Array.isArray(result.data)) {
                const recent = result.data.filter(v => {
                    if (!v.published) return false;
                    const pubDate = typeof v.published === 'number'
                        ? v.published * 1000
                        : new Date(v.published).getTime();
                    return (now - pubDate) < ONE_MONTH;
                });
                allVideos.push(...recent);
            }
        });

        // Deduplication by videoId
        const seen = new Set();
        const deduped = allVideos.filter(v => {
            if (seen.has(v.videoId)) return false;
            seen.add(v.videoId);
            return true;
        });

        // Stable numeric sorting
        const getTimestamp = (v) => {
            if (!v.published) return 0;
            if (typeof v.published === 'number') return v.published;
            const parsed = new Date(v.published).getTime();
            return isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
        };

        deduped.sort((a, b) => getTimestamp(b) - getTimestamp(a));

        // Limit 80 for a richer feed
        return deduped.slice(0, 80);
    }, [JSON.stringify(queryResults.map(q => q.data?.length))]); // Only re-run if data lengths change

    return { videos, isLoading, isFetching };
};
