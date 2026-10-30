export class MemoryCache {
  constructor(ttlMilliseconds = 5 * 60 * 1000) {
    this.ttlMilliseconds = ttlMilliseconds;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key, value) {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMilliseconds
    });
  }

  clear() {
    this.entries.clear();
  }
}
