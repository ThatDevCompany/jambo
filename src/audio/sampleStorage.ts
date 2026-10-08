import type { Storage, StorageResponse } from "smplr"

const CACHE_NAME = "jambo-samples"
const MAX_PARALLEL = 6
const MAX_ATTEMPTS = 4

/**
 * Where instruments fetch their samples from. Replaces smplr's own storage, which fires every request
 * at once (hundreds for the grand piano), never retries, and caches error responses too.
 *
 * Samples come from Cache Storage when we have them. Otherwise they're downloaded a few at a time,
 * retried with backoff, and cached only when the download succeeded.
 */
export const sampleStorage: Storage = {
    async fetch(url: string): Promise<StorageResponse> {
        const cache = await openCache()
        const cached = await cache?.match(url).catch(() => undefined)
        if (cached !== undefined) return cached

        const response = await withSlot(() => fetchWithRetry(url))
        if (response.ok) await cache?.put(url, response.clone()).catch(() => undefined)
        return response
    },
}

let cachePromise: Promise<Cache | null> | null = null
function openCache(): Promise<Cache | null> {
    // Cache Storage only exists in secure contexts (HTTPS or localhost).
    cachePromise ??= "caches" in window ? caches.open(CACHE_NAME).catch(() => null) : Promise.resolve(null)
    return cachePromise
}

async function fetchWithRetry(url: string): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(url)
            // 404s won't fix themselves, but server hiccups (5xx) might.
            if (response.ok || response.status < 500 || attempt === MAX_ATTEMPTS) return response
        } catch (error) {
            if (attempt === MAX_ATTEMPTS) throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
    }
}

let active = 0
const waiting: (() => void)[] = []

/** Runs `task` once fewer than MAX_PARALLEL downloads are in flight. */
async function withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve))
    active++
    try {
        return await task()
    } finally {
        active--
        waiting.shift()?.()
    }
}
