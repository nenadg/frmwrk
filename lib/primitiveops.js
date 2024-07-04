import isCyclic from "./cyclic.js";

const mergeArray = (arrayOne, arrayTwo) => {
  Array.prototype.push.apply(arrayOne, arrayTwo);
  return arrayOne;
};

const getLength = (array) => array.length;
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

const filterOutSimilar = (path, out, key) => (
  path.indexOf(out) > -1
    ? (path.splice(path.indexOf(out), 1), path.push(out + "." + key), path)
    : path.push(out + "." + key),
  path
);

const diffPath = (o1, o2, out = "", path = []) => (
  path.push(out),
  [
    ...new Set(
      Array.isArray(o1)
        ? o1
            .map((el, i) =>
              !o2
                ? filterOutSimilar(path, out, i)
                : isDifferent(el, o2[i])
                  ? ((path = filterOutSimilar(path, out, i)), diffPath(el, o2[i], out + "." + i, path))
                  : path
            )
            .flat()
        : typeof o1 === "object" && !isCyclic(o1) && o1 !== null
          ? Object.keys(o1)
              .map((key) =>
                // eslint-disable-next-line no-prototype-builtins
                !o2 || (o2 && !o2.hasOwnProperty(key))
                  ? filterOutSimilar(path, out, key)
                  : isDifferent(o1[key], o2[key])
                    ? ((path = filterOutSimilar(path, out, key)), diffPath(o1[key], o2[key], out + "." + key, path))
                    : path
              )
              .flat()
          : path
    )
  ]
);

const isObject = (object) => object !== null && !Array.isArray(object) && typeof object === "object";

export { mergeArray, isDifferent, getLength, isPrimitive, isCyclic, diffPath, isObject };
