/**
 * Checks if object is cyclic, returns true or false.
 * @param {object} object - JS Object.
 * @param {seen} WeakSet - WeakSet used for referencing nested objects
 * @returns {boolean}
 */
const isCyclic = (object, seen = new WeakSet()) =>
	typeof object === "object" && object !== null
		? seen.has(object)
			? true
			: typeof object === "object" && object !== null
				? (seen.add(object),
					Object.keys(object).some((target) => isCyclic(object[target], seen)))
				: false
		: false;

export default isCyclic;
