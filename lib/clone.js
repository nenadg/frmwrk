import { isPrimitive } from "./primitiveops.js";
import isCyclic from "./cyclic.js";

/**
 * Returns original's clone
 * @constructor
 * @param {object} object - Object of any type.
 * @returns {object}
 */
const clone = (object) =>
  isPrimitive(object) ||
  typeof object === "function" ||
  (object !== null &&
    typeof object == "object" &&
    "nodeType" in object &&
    object.nodeType === 1 &&
    object.cloneNode)
    ? object
    : Array.isArray(object)
      ? object.map(clone)
      : typeof object === "object" && object !== null
        ? isCyclic(object)
          ? object
          : Object.keys(object).reduce(
              (acc, target) => ((acc[target] = clone(object[target])), acc),
              Object.create(object.constructor.prototype)
            )
        : object instanceof Date
          ? new Date(object)
          : object;

export default clone;
