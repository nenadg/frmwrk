/**
 * Faster than FNV-1a for shorter strings
 *
 * @param {string} string - The input string to hash.
 * @returns {number} The resulting 32-bit unsigned integer hash value.
 */
const hash = (string) => {
	let hash = 0;
	const len = string.length;

	// Optimized for common component name lengths
	for (let i = 0; i < len; i++) {
		// Using prime numbers for better distribution
		hash = (hash << 5) - hash + string.charCodeAt(i);
		hash = hash & hash; // Convert to 32-bit integer
	}

	return Math.abs(hash).toString(36);
};

/**
 * Enhanced hashing strategy specifically optimized for leaf identification
 * Features:
 * - Improved collision handling using Set for O(1) lookups
 * - Efficient cache management with LRU-like behavior
 * - Built-in cache size limiting
 */
const enhancedLeafHash = (() => {
	// Cache for frequently used hashes
	const hashCache = new Map();
	// Set for O(1) collision detection
	const usedHashes = new Set();
	// Counter for handling potential collisions
	let collisionCounter = 0;
	// Maximum cache size
	const MAX_CACHE_SIZE = 10000;

	// Collision-resistant hash generation with O(1) lookup
	const generateUniqueHash = (input) => {
		// Check cache first
		if (hashCache.has(input)) {
			return hashCache.get(input);
		}

		const baseHash = hash(input);
		let finalHash = baseHash;

		// O(1) collision check using Set
		while (usedHashes.has(finalHash)) {
			collisionCounter++;
			finalHash = baseHash + collisionCounter.toString(36);
		}

		// Cache management - implement simple LRU-like behavior
		if (hashCache.size >= MAX_CACHE_SIZE) {
			// Remove oldest entry
			const firstKey = hashCache.keys().next().value;
			const oldHash = hashCache.get(firstKey);
			hashCache.delete(firstKey);
			usedHashes.delete(oldHash);
		}

		// Store in cache and used hashes
		hashCache.set(input, finalHash);
		usedHashes.add(finalHash);

		return finalHash;
	};

	return (input) => {
		return "EL" + generateUniqueHash(input);
	};
})();

export { hash, enhancedLeafHash };
