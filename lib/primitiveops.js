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

const isPrimitive = (value) => primitives[typeof value] === true;

const isDifferent = (o1, o2) => {
  let out = false;
  if (isPrimitive(o1)) {
    return o1 !== o2;
  }

  if (typeof o1 !== typeof o2) {
    return true;
  }

  if (Array.isArray(o1)) {
    if (o1.length !== o2.length) {
      return true;
    }
  }

  let k;

  for (k in o1) {
    if (isCyclic(o1)) {
      return true;
    }
    // eslint-disable-next-line no-prototype-builtins
    if (o1.hasOwnProperty(k)) {
      // eslint-disable-next-line no-prototype-builtins
      if (!o2.hasOwnProperty(k)) {
        out = true;
        break;
      }

      out = isDifferent(o1[k], o2[k]);
      if (out) {
        break;
      }
    }
  }

  return out;
};

const isObject = (object) => object !== null && !Array.isArray(object) && typeof object === "object";

export { isDifferent, isPrimitive, isCyclic, isObject };
