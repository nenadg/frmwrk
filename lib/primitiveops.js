import isCyclic from "./cyclic.js";

const primitives = {
  boolean: true,
  null: true,
  undefined: true,
  number: true,
  bigint: true,
  string: true,
  symbol: true
};

/**
 * Checks if the provided value is a primitive JavaScript type.
 *
 * A primitive type is one of the following:
 * - boolean
 * - null
 * - undefined
 * - number
 * - bigint
 * - string
 * - symbol
 *
 * @param {*} value - The value to check.
 * @returns {boolean} Returns `true` if the value is a primitive, otherwise `false`.
 */
const isPrimitive = (value) => primitives[typeof value] === true;

/**
 * Checks if two values are different.
 *
 * @param {*} o1 - The first value to compare.
 * @param {*} o2 - The second value to compare.
 * @returns {boolean} Returns `true` if the values are different, otherwise `false`.
 */
const isDifferent = (o1, o2) =>
  isPrimitive(o1)
    ? o1 !== o2
    : typeof o1 !== typeof o2 ||
      (Array.isArray(o1) && o1.length !== o2.length) ||
      Object.keys(o1).some((k) => isCyclic(o1) || !o2.hasOwnProperty(k) || isDifferent(o1[k], o2[k]));

/**
 * Checks if the provided value is a plain object (not null, array, or other types of objects).
 *
 * @param {*} value - The value to check.
 * @returns {boolean} Returns `true` if the value is a plain object, otherwise `false`.
 */
const isObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

export { isDifferent, isPrimitive, isCyclic, isObject };
