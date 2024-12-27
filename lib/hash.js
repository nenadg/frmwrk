/**
 * Generates a fast, non-cryptographic hash value for a given string using the FNV-1a hash algorithm.
 * This implementation ensures the hash is a 32-bit unsigned integer, and it's designed for
 * performance and good distribution of hash values, minimizing collisions.
 *
 * @param {string} string - The input string to hash.
 * @returns {number} The resulting 32-bit unsigned integer hash value.
 */
const hash = (string) => {
	let hash = 0x811c9dc5; // FNV-1a offset basis
	const len = string.length;

	for (let i = 0; i < len; i++) {
		hash ^= string.charCodeAt(i);
		hash *= 0x01000193; // FNV-1a prime
	}

	// Convert to unsigned 32-bit integer
	return hash >>> 0;
};

export default hash;
