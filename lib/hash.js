/**
 * string-hash function
 * credits go to: https://github.com/darkskyapp/string-hash
 * performance tests: https://gist.github.com/victor-homyakov/bcb7d7911e4a388b1c810f8c3ce17bcf
 * @constructor
 * @param {string} string - String to be hashed.
 * @returns {string}
 */
const hash = (string) => {
	let hash = 5381;
	let i = string.length;

	while (i) {
		hash = (hash * 33) ^ string.charCodeAt(--i);
	}

	/* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
	 * integers. Since we want the results to be always positive, convert the
	 * signed int to an unsigned by doing an unsigned bitshift. */
	return hash >>> 0;
};

export default hash;
