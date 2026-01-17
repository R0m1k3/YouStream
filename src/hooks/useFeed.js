import { useQueries } from '@tanstack/react-query';
import invidiousService from '../services/invidiousService';
import subscriptionService from '../services/subscriptionService';

export const useFeed = (subscriptions) => {
    const queries = subscriptions.map((sub) => ({
        queryKey: ['channelVideos', sub.authorId],
        queryFn: async () => {
            let authorId = sub.authorId;
            // Handle Resolution Logic (Optimistic)
            if (authorId.startsWith('@')) {
                const realId = await invidiousService.resolveHandle(authorId);
                if (realId) {
                    subscriptionService.updateSubscriptionId(authorId, realId);
                    authorId = realId;
                }
            }
            return invidiousService.getChannelVideos(authorId);
        },
        staleTime: 1000 * 60 * 5, // 5 Minutes cache
        cacheTime: 1000 * 60 * 30, // 30 Minutes unused
        retry: 1,
    }));

    const queryResults = useQueries({ queries });

    const isLoading = queryResults.some(q => q.isLoading);
    const isError = queryResults.some(q => q.isError);

    // Aggregation
    let allVideos = [];
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    queryResults.forEach((result) => {
        if (result.data && Array.isArray(result.data)) {
            const recent = result.data.filter(v => {
                if (!v.published) return false;
                // published is Unix timestamp in SECONDS, convert to milliseconds
                const pubDate = typeof v.published === 'number'
                    ? v.published * 1000  // Unix timestamp (seconds)
                    : new Date(v.published).getTime();  // ISO string fallback
                return (now - pubDate) < ONE_MONTH;
            });
            allVideos.push(...recent);
        }
    });

    // Sort Newest First (published is Unix timestamp in seconds)
    allVideos.sort((a, b) => (b.published || 0) - (a.published || 0));

    // Limit 50
    const videos = allVideos.slice(0, 50);

    return { videos, isLoading, isError };
};
