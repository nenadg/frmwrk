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
 * Returns optimized deep clone of original
 * @param {*} object - Value to clone
 * @param {WeakMap} seen - WeakMap for circular reference tracking
 * @returns {*} Cloned value
 */
const clone = (object, seen = new WeakMap()) =>
  // Handle primitives, functions, and DOM nodes
  isPrimitive(object) ||
  typeof object === "function" ||
  (object !== null && typeof object === "object" && "nodeType" in object && object.nodeType === 1)
    ? object
    : // Handle arrays with optimized path
      Array.isArray(object)
      ? (() => {
          if (seen.has(object)) return seen.get(object);
          const cloneArr = new Array(object.length);
          seen.set(object, cloneArr);
          return Object.assign(
            cloneArr,
            object.map((item) => clone(item, seen))
          );
        })()
      : // Handle plain objects
        typeof object === "object" && object !== null
        ? isCyclic(object)
          ? object
          : (() => {
              if (seen.has(object)) return seen.get(object);
              const prototype = Object.getPrototypeOf(object);
              const cloneObj = Object.create(prototype);
              seen.set(object, cloneObj);
              return Object.assign(
                cloneObj,
                ...Object.entries(object).map(([key, value]) => ({
                  [key]: clone(value, seen)
                }))
              );
            })()
        : // Handle dates
          object instanceof Date
          ? new Date(object)
          : object;

export default clone;
