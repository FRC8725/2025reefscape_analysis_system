export function readCache(cacheKey) {
    try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;

        const obj = JSON.parse(raw);
        return (obj && Array.isArray(obj.data)) ? obj : null;

    } catch (err) {
        console.error('Error reading cache:', err);
        return null;
    }
}

export function writeCache(data, cacheKey) {
    localStorage.setItem(cacheKey, JSON.stringify({ "data": data, "updatedAt": Date.now() }));
}
export function isFresh(cache, TTL) { return cache && (Date.now() - cache.updatedAt) < TTL; }