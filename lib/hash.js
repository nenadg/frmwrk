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
 * -
 * - Built-in collision handling
 * - Cache for frequently accessed hashes
 */
const enhancedLeafHash = (() => {
	// Cache for frequently used hashes
	const hashCache = new Map();
	// Counter for handling potential collisions
	let collisionCounter = 0;

	// Collision-resistant hash generation
	const generateUniqueHash = (input) => {
		const baseHash = hash(input);

		// Check cache first
		if (hashCache.has(input)) {
			return hashCache.get(input);
		}

		// Handle potential collisions
		let finalHash = baseHash;
		while (Array.from(hashCache.values()).includes(finalHash)) {
			collisionCounter++;
			finalHash = baseHash + collisionCounter.toString(36);
		}

		// Cache management - keep cache size reasonable
		if (hashCache.size > 10000) {
			const firstKey = hashCache.keys().next().value;
			hashCache.delete(firstKey);
		}

		// Store in cache
		hashCache.set(input, finalHash);
		return finalHash;
	};

	return (input) => {
		return "EL" + generateUniqueHash(input);
	};
})();

export { hash, enhancedLeafHash };
