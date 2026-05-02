'use strict';

/**
 * @fileoverview Lightweight in-memory cache with TTL (time-to-live) expiry.
 * Improves API efficiency by avoiding redundant computation on hot data paths.
 * Uses a Map internally for O(1) get/set operations.
 * @module utils/cache
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} value - The cached value
 * @property {number} expiresAt - Epoch ms when this entry expires
 */

/**
 * Simple TTL-based in-memory cache.
 * Entries are lazily evicted on access (expired entries are deleted on read).
 * A periodic sweep runs every `sweepIntervalMs` to evict stale entries
 * and prevent unbounded memory growth.
 *
 * @example
 * const cache = new Cache({ ttlMs: 30000, maxSize: 500 });
 * cache.set('key', { data: 'value' });
 * cache.get('key'); // => { data: 'value' }
 */
class Cache {
  /**
   * @param {object} [options]
   * @param {number} [options.ttlMs=60000]         - Default TTL in milliseconds
   * @param {number} [options.maxSize=1000]         - Max entries before LRU eviction
   * @param {number} [options.sweepIntervalMs=120000] - Background sweep interval
   */
  constructor({ ttlMs = 60_000, maxSize = 1_000, sweepIntervalMs = 120_000 } = {}) {
    /** @type {Map<string, CacheEntry>} */
    this._store = new Map();
    this._ttlMs = ttlMs;
    this._maxSize = maxSize;

    // Background sweep to evict expired entries
    this._sweepTimer = setInterval(() => this._sweep(), sweepIntervalMs);
    this._sweepTimer.unref?.(); // don't keep process alive in tests
  }

  /**
   * Stores a value in the cache.
   * If the cache is at max capacity, the oldest entry is evicted first.
   * @param {string} key   - Cache key
   * @param {*}      value - Value to cache (should be serialisable)
   * @param {number} [ttlMs] - Per-entry TTL override (ms)
   * @returns {void}
   */
  set(key, value, ttlMs = this._ttlMs) {
    if (this._store.size >= this._maxSize) {
      const oldestKey = this._store.keys().next().value;
      this._store.delete(oldestKey);
    }
    this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Retrieves a cached value. Returns `undefined` if the key is missing
   * or the entry has expired (and lazily evicts it).
   * @param {string} key - Cache key
   * @returns {*} The cached value, or `undefined`
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) { return undefined; }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Checks whether a key exists and has not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Removes a single cache entry.
   * @param {string} key
   * @returns {boolean} True if the entry existed and was deleted
   */
  delete(key) {
    return this._store.delete(key);
  }

  /**
   * Removes all entries matching a key prefix.
   * Useful for invalidating a group of related entries (e.g. all `/teams` entries).
   * @param {string} prefix
   * @returns {number} Number of entries removed
   */
  invalidatePrefix(prefix) {
    let count = 0;
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Clears all cache entries. */
  clear() {
    this._store.clear();
  }

  /**
   * Returns cache statistics for monitoring and debugging.
   * @returns {{ size: number, maxSize: number, ttlMs: number }}
   */
  stats() {
    return { size: this._store.size, maxSize: this._maxSize, ttlMs: this._ttlMs };
  }

  /**
   * Internal: removes all expired entries.
   * @private
   */
  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this._store.entries()) {
      if (now > entry.expiresAt) {
        this._store.delete(key);
      }
    }
  }

  /** Stops the background sweep timer. Call during graceful shutdown. */
  destroy() {
    clearInterval(this._sweepTimer);
  }
}

// Shared singleton instances — one per logical domain
const teamsCache = new Cache({ ttlMs: 30_000 });
const tasksCache = new Cache({ ttlMs: 15_000 });
const messagesCache = new Cache({ ttlMs: 10_000 });
const usersCache = new Cache({ ttlMs: 60_000 });

module.exports = { Cache, teamsCache, tasksCache, messagesCache, usersCache };
