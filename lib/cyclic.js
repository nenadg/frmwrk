/**
 * Checks if object is cyclic, returns true or false.
 * @param {object} object - JS Object.
 * @param {seen} Map - Map used for referencing nested objects
 * @returns {boolean}
 */
const isCyclic = (object, seen = new Map()) =>
	typeof object === "object" && object !== null
		? seen.has(object)
			? true
			: (seen.set(object, true), Object.keys(object).some((key) => isCyclic(object[key], seen)))
		: false;

export default isCyclic;
