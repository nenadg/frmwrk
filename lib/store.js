import clone from "./clone.js";
import { render, tryRemoveElement, getElement } from "./render.js";
import updateElement from "./updater.js";
import { getComponentType } from "./define";
// eslint-disable-next-line import/namespace

import { Meta, updateMeta, replaceMeta, getMetaRoot } from "./meta.js";
import { getLeaf, getLeaves, createLeaf, getBindingLeaf, getLeafByBoundIndex } from "./tree.js";

const matrixMatchRe = /\[.*]/gi;
const quadraticRe = /(.*\..*)(\[.*?\])/gi;
const quadraticMatchRe = /^(.*?\.\d+)\.(.*)$/;
const commentRe = /\/\/{\*:([^{}]*)}/g;
const dataRe = /{\*:([^{}]*)}/g;
const mappedRe = /{.*--([^{}]*)}/g;
const boundRe = /([@{}])/g;
const dataInverseRe = /([@{*:}])/g;
const multiBindRe = /\*:/gi;
const modelNameRe = /([A-Z])\w+--/gi;
const arrayRe = /\{*\[/gi;
const expressionRe = /\{|\}/gi;
const breakMatchRe = /(?!-|_)[^a-zA-Z0-9]/gi;
const orderMatchRe = /(\w+(--))(\w+(\d*))|(\w+)/gi;

let Data = {};

const isDataField = (field) => field && field.match && !field.match(commentRe) && field.match(dataRe);

const getDataKeys = (key) => (Data[key] ? Data[key].__marrow_keys : [0]);

const pointInTime = (key, at = 0, keys, pointer = 0) => ((pointer = keys.length - 1), pointer + at);

const getTimestamps = (key, at = 0) => Object.values(getDataKeys(key)).reverse()[at];

const getVersionAt = (key, at) => (Data[key] ? Data[key][at] : undefined);

const getProperVersion = (at, key, keys) => ({ [key]: getVersionAt(key, keys[pointInTime(key, at, keys)]) });

const mapData = (at, key, keys = []) => (
  (keys = getDataKeys(key)), getProperVersion(typeof at === "boolean" ? 1 - keys.length : at, key, keys)
);

const getData = (modelNames, at = 0, mutable) => (
  (mutable = Object.keys(Data)
    .filter((key) => modelNames.includes(key.substr(0, key.indexOf("--"))))
    .map((key) => mapData(at, key))
    .reduce((acc, curr) => Object.assign(acc, curr), {})),
  mutable
);

const reduceIndexes = (data, order, acc, target, i, arr, reduced) => (
  (reduced = order.slice(target, arr[i - 1]).reduce((a, t) => a && a[t], data)),
  arr[i - 1] !== undefined ? (!acc ? reduced : reduced && reduced[acc]) : !acc ? reduced : acc[reduced]
);

const reduceMatch = (order, data, indexes) => indexes.reduce(reduceIndexes.bind(null, data, order), null);

const mapIndexes = (m, i) => (!isNaN(parseInt(m)) ? i - 1 : 0);

const getReduced = (match, data) => {
  let order = match.match(orderMatchRe);
  let setOrder = order.slice(0, order.length - 1);
  let indexes = [...new Set(order.map(mapIndexes))].reverse();

  let value = reduceMatch(order, data, indexes);
  let set = setOrder.length ? reduceMatch(setOrder, data, indexes) : value;
  let prop = order
    .pop()
    .replace(modelNameRe, "")
    .replace(/\{|\}|\[|\]|\?/gi, "")
    .trim();

  return {
    prop: prop,
    value: value,
    set: set
  };
};

const updateData = (data = clone(data)) => {
  const keys = Object.keys(data);
  const len = keys.length;
  let i = 0;

  for (; i < len; i++) {
    let key = keys[i];

    if (Data[key] === undefined) {
      Data[key] = { __marrow_generation: -1 };
    }

    Data[key].__marrow_generation++;

    if (Data[key].__marrow_keys === undefined) {
      Data[key].__marrow_keys = [];
    }

    Data[key].__marrow_keys.push(Data[key].__marrow_generation);
    Data[key][Data[key].__marrow_generation] = data[key];
  }

  return data;
};

const deleteData = (key) => delete Data[key];

const calculateIndexes = (leaf, dataMatch) => {
  let boundIndex = leaf.boundIndex || getBindingLeaf(leaf)?.boundIndex;

  const indexMatch = dataMatch.match(quadraticRe)
    ? dataMatch.replace(quadraticRe, "")
    : dataMatch.replace(matrixMatchRe, "");
  const indexLeaf = getLeafByBoundIndex(leaf, indexMatch);
  const indexRoot = indexLeaf && indexLeaf.boundIndex.split(".");
  const horizontalIndex = boundIndex && Number(boundIndex.split(".")[1]);
  const verticalIndex = indexRoot && Number(indexRoot[1]);

  if (dataMatch.match(matrixMatchRe) && verticalIndex !== undefined) {
    // NOTE: reconsider this, if there is matrix match and vertical index is available
    // no need to seek new boundIndex (horizontal) except if matrix match is quadratic,
    // in that case assign parentBoundIndex as horizontal match
    let parentBoundIndex = getBindingLeaf(getLeaf(indexLeaf.parent))?.boundIndex;
    if (typeof parentBoundIndex !== "undefined") {
      boundIndex = parentBoundIndex;
    }

    return { horizontalIndex: boundIndex && Number(boundIndex.split(".")[1]), verticalIndex };
  }

  return { horizontalIndex, verticalIndex };
};

const matchExpression = (candidate, leaf) => {
  let boundIndex = leaf.boundIndex || getBindingLeaf(leaf)?.boundIndex;

  const rebound = rebindValue(candidate, leaf);
  const dataMatch = rebound.match(mappedRe)[0];
  // note: this is misleading: boundIndex will return true even for direct matches
  // resulting in data not being matched
  // const arrayExp = dataMatch.match(arrayRe) !== null || boundIndex !== undefined;
  const arrayExp = dataMatch.match(arrayRe) !== null;

  if (arrayExp) {
    const { horizontalIndex, verticalIndex } = calculateIndexes(leaf, dataMatch);

    return getMatch(dataMatch, horizontalIndex, verticalIndex);
  }

  return getMatch(dataMatch);
};

const getMatch = (dataMatch, verticalIndex, horizontalIndex) => {
  const sentence = dataMatch.replace(expressionRe, "");
  let split = sentence.split(breakMatchRe).filter((f) => f && f.length > 0);
  let path = split[0];

  if (split[0] === split[1]) {
    split[1] = split[2];
  }

  if (horizontalIndex !== undefined) {
    path += `.${horizontalIndex}${split[1] ? `.${split[1]}` : ""}`;
    if (verticalIndex !== undefined && split[1] !== split[2]) {
      path += `.${verticalIndex}.${split[2]}`;
    }
  } else if (verticalIndex !== undefined) {
    let same = verticalIndex === parseInt(split[1], 10);
    if (split[1] !== undefined) {
      path += `.${verticalIndex}${!same ? `.${split[1]}` : ""}`;
    }
    if (split[1] !== split[2] && split[2] !== undefined) {
      path += `.${split[2]}`;
    }
  } else if (split[1] !== undefined) {
    path += `.${split[1]}`;
  }
  return path;
};

const getElementProperties = (leaf, componentType) => Object.assign({}, leaf[componentType]);

const bindToData = (leaf, attributes) => {
  let model = leaf.model;

  if (!model) {
    return [];
  }

  const bindables = getBindableFields(attributes);
  const componentType = getComponentType(leaf);
  const props = getElementProperties(leaf, componentType);

  if (!bindables.length) {
    return [];
  }

  const len = bindables.length;
  let j = 0;
  let k = 0;
  let dataMatch = [];
  let lastAttr;

  for (; j < len; j++) {
    let attribute = bindables[j];

    if (lastAttr !== attribute && k > 0) {
      k = 0;
    }

    let matching = props[attribute].match(dataRe);
    let candidate = matching[k];

    if (matching.length && k < matching.length - 1) {
      k++;
    }

    lastAttr = attribute;

    let matched = matchExpression(candidate, leaf);
    let metaMatches = model.getMetaTransform(matched);

    if (Object.keys(metaMatches).length) {
      let metaRoot = getMetaRoot(leaf);

      leaf.hasMetaRoot = true;

      if (metaRoot) {
        let metaRootId = metaRoot.elementId;
        let metaMatch = Object.keys(metaMatches).filter(
          (mm) => mm === (matched && matched.split(".")[0] ? matched.split(".")[0] : matched) + "|" + metaRootId
        )[0];

        let metaMatched = metaMatches[metaMatch];

        if (metaMatched !== undefined) {
          leaf[componentType][attribute] = replaceMeta(leaf[componentType][attribute], candidate, metaMatched);

          dataMatch = dataMatch.concat(metaMatched);
        }
      }
    } else {
      dataMatch.push(matched);
    }
  }

  return dataMatch;
};

// const checkForUnload = (model) => {
//   if (model.shouldUnload()) {
//     const leaves = getLeavesByModelRef(model.name);
//     const alive = leaves.length;

//     if (!alive) {
//       model.unload();
//       leaves.forEach(deleteLeaf);
//     }
//   }
// };

const getBindableFields = (attributes) => {
  let bindableFields = [];

  Object.entries(attributes).forEach(([key, value]) => {
    if (isDataField(value)) {
      value.match(dataRe).forEach(() => {
        bindableFields.push(key);
      });
    }
  });

  return bindableFields;
};

const rebindValue = (value, leaf) => {
  if (typeof value !== "string") {
    return value;
  }

  const { model, bindingLeaf } = leaf;
  let boundRoot = bindingLeaf ? bindingLeaf.boundRoot.substr(0, bindingLeaf.boundRoot.indexOf("--")) : undefined;
  const key = model ? model.getName() : boundRoot;

  if (!key) {
    return value;
  }

  return value.replace(multiBindRe, key + "--");
};

const getBindValues = (current) => current.map((t) => t.prop);

export {
  Data,
  dataRe,
  boundRe,
  commentRe,
  dataInverseRe,
  quadraticMatchRe,
  getData,
  updateData,
  deleteData,
  isDataField,
  getTimestamps,
  getVersionAt,
  rebindValue,
  matchExpression,
  getReduced,
  getElementProperties,
  getBindableFields,
  getBindValues,
  bindToData
};
