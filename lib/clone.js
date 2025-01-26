import { isPrimitive } from "./primitiveops.js";
import isCyclic from "./cyclic.js";

/**
 * Returns original's clone
 * @constructor
 * @param {object} object - Object of any type.
 * @returns {object}
 */
// const clone = (object) =>
//   isPrimitive(object) ||
//   typeof object === "function" ||
//   (object !== null && typeof object == "object" && "nodeType" in object && object.nodeType === 1 && object.cloneNode)
//     ? object
//     : Array.isArray(object)
//       ? object.map(clone)
//       : typeof object === "object" && object !== null
//         ? isCyclic(object)
//           ? object
//           : Object.assign(
//               Object.create(Object.getPrototypeOf(object)),
//               ...Object.keys(object).map((key) => ({ [key]: clone(object[key]) }))
//             )
//         : object instanceof Date
//           ? new Date(object)
//           : object;

/**
 * Enhanced functional clone implementation with optimized performance
 * Maintains pure functional style while improving memory usage and speed
 * @param {*} object - Value to clone
 * @param {WeakMap} seen - WeakMap for circular reference tracking
 * @returns {*} Cloned value
 */
const clone = (object, seen = new WeakMap()) =>
  // Handle primitives and functions (fast path)
  isPrimitive(object) || typeof object === "function"
    ? object
    : // Handle DOM nodes (fast path)
      object !== null && typeof object === "object" && "nodeType" in object && object.nodeType === 1
      ? object
      : // Handle arrays with optimized path
        Array.isArray(object)
        ? seen.has(object)
          ? seen.get(object)
          : ((arr) => (
              seen.set(object, arr),
              Object.assign(
                arr,
                object.map((item) => clone(item, seen))
              )
            ))(new Array(object.length))
        : // Handle plain objects
          typeof object === "object" && object !== null
          ? isCyclic(object)
            ? object
            : seen.has(object)
              ? seen.get(object)
              : ((cloneObj) => (
                  seen.set(object, cloneObj),
                  Object.assign(
                    cloneObj,
                    Object.fromEntries(Object.entries(object).map(([key, value]) => [key, clone(value, seen)]))
                  )
                ))(Object.create(Object.getPrototypeOf(object)))
          : // Handle dates
            object instanceof Date
            ? new Date(object)
            : object;

export default clone;
