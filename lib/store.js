import hash from "./hash.js";
import clone from "./clone.js";
import { render, tryRemoveElement, getElement } from "./render";

import { isDifferent } from "./primitiveops.js";
import { getComponentType } from "./define";
// eslint-disable-next-line import/namespace
import { getModel } from "./model";

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

let Meta = {};
let Data = {};
let tree = [];
let treeMap = {};
let parentMap = {};

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

const updateMeta = (meta) => {
  const keys = Object.keys(meta);
  const len = keys.length;
  let i = 0;

  for (; i < len; i++) {
    let key = keys[i];
    Meta[key] = meta[key];
  }

  return meta;
};

const replaceMeta = (attributeValue, matched, meta) =>
  attributeValue
    .split(" ")
    .map((attr) =>
      attr.indexOf(matched) > -1
        ? attr.replace(dataRe, "{*:" + meta.substr(meta.indexOf("--") + 2, meta.length) + "}")
        : attr
    )
    .join(" ");

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
  const arrayExp = dataMatch.match(arrayRe) !== null || boundIndex !== undefined;

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

const getHash = (attributes, keys = Object.keys(attributes)) =>
  keys.reduce(
    (a, c) => (
      c !== "children"
        ? typeof attributes[c] === "object"
          ? (a += getHash(attributes[c]))
          : (a += attributes[c])
        : "ch",
      a
    ),
    "" + keys.length
  );

const createLeaf = (parentId, attributes) => {
  if (attributes.elementId) {
    return getLeaf(attributes.elementId);
  }

  const componentType = getComponentType(attributes);

  let leaf = {
    parent: parentId || "body"
  };

  leaf[componentType] = {};

  const configuration = attributes[componentType] || {};

  leaf[componentType] = configuration;

  leaf.parentLeaf = getLeaf(parentId);

  // const hashCtor = JSON.stringify(Object.keys(attributes)
  //   .reduce((a, c) =>
  //     (c !== 'children' ? a[c] = attributes[c] : null, a), { }));

  let hashCtor = getHash(attributes);

  leaf.elementId = "EL" + hash(hashCtor + parentId);

  let alreadyLeaf = getLeaf(leaf.elementId);

  if (alreadyLeaf) {
    return alreadyLeaf;
  }

  if (attributes.name) {
    leaf.componentName = attributes.name;
  }

  if (attributes.boundIndex) {
    leaf.boundIndex = attributes.boundIndex;
  }

  if (attributes.boundRoot) {
    leaf.boundRoot = attributes.boundRoot;
  }

  if (attributes.replaces) {
    leaf.replaces = attributes.replaces;
  }

  if (attributes.floating) {
    leaf.floating = attributes.floating;
  }

  if (attributes.templateId) {
    leaf.templateId = attributes.templateId;
  }

  if (leaf[componentType].model) {
    let model;
    let modelName = leaf[componentType].model;
    model = getModel(modelName);

    if (!model) {
      console.error("[e] you probably haven't set proper model name for ", componentType);
    }

    model = model.getInstance() || new model();

    leaf.model = model;
    // leaf.boundModel = model;
  }

  const parentLeaf = getLeaf(parentId);
  let parentsModel = parentLeaf && getParentsModel(parentLeaf);

  if (parentsModel && !attributes.implicit) {
    let model;
    model = parentsModel;

    if (!model) {
      // this has no point
      model = new model();
    }

    leaf.model = model;

    // if (parentLeaf.boundModel) {
    //   leaf.model = parentLeaf.boundModel;
    // }
  }

  let isTemplate = componentType.match(boundRe) !== null;

  if (isTemplate) {
    leaf.isTemplate = true;
  }

  if (leaf.model && configuration.meta) {
    leaf.model.appendMeta(leaf.elementId, configuration.meta);
    leaf.meta = configuration.meta;
  }

  const dataMatch = bindToData(leaf, configuration);
  leaf.dataMatch = dataMatch;
  leaf.bindingLeaf = getBindingLeaf(leaf);

  if (leaf[componentType].position !== undefined) {
    leaf.position = leaf[componentType].position;
  }

  if (leaf.position === undefined) {
    const parentsChildren = getChildrenLeaves(parentId);
    leaf.position = parentsChildren.length;

    if (leaf.boundIndex) {
      let template = parentsChildren.filter((lf) => lf.elementId === leaf.templateId)[0];
      const boundIndex = parseInt(leaf.boundIndex.split(".").pop());

      if (template) {
        leaf.position = template.position + boundIndex;
      }

      // put the rest of elements in correct positions
      // parentsChildren.forEach(childLeaf =>
      //   childLeaf.templateId !== template.elementId &&
      //   childLeaf.elementId !== template.elementId ?
      //     childLeaf.position > template.position ?
      //       childLeaf.position += boundIndex : null
      //   : null);

      // theRestOfChildrenToIncrease.forEach((childLeaf, index) =>
      //   childLeaf.position > template.position ?
      //     childLeaf.position += boundIndex : null);
    }
  }

  addLeaf(leaf);
  treeMap[leaf.elementId] = tree.length - 1;

  if (!parentMap[parentId]) {
    parentMap[parentId] = [];
  }

  parentMap[parentId].push(leaf.elementId);

  Object.freeze(leaf[componentType]);

  return leaf;
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

const addLeaf = (leaf) => tree.push(leaf);

const getLeafIndex = (leaf) => (leaf ? treeMap[leaf.elementId] : -1);

const getLeaf = (elementId) => tree[treeMap[elementId]];

const getChildrenLeaves = (elementId) => (parentMap[elementId] ? parentMap[elementId].map(getLeaf) : []);

const getMetaRoot = (leaf) => {
  let contextTree = getContextTree(leaf);
  let i = 0;
  let metaRoot;

  contextTree.push(leaf); // .unshift?

  // ct.some((lf) => (lf.meta !== undefined ? ((metaRoot = lf), true) : false));

  while (!metaRoot && i <= contextTree.length) {
    if (contextTree[i] && contextTree[i].meta) {
      metaRoot = contextTree[i];
    }

    i++;
  }

  return metaRoot;
};

const getParentsModel = (parentLeaf) => {
  const ct = getContextTree(parentLeaf);
  let model = undefined;
  let i = ct.length - 1;

  if (parentLeaf.model) {
    return parentLeaf.model;
  }

  while (ct[i] !== undefined && model === undefined) {
    model = ct[i].model;
    i--;
  }

  return model;
};

const deleteLeaf = (leaf) => {
  // important: first, remove children than parents,
  // otherwise there will be no reference to catch upon
  // so leftover orphans will amass
  getChildrenLeaves(leaf.elementId).forEach(deleteLeaf);

  removeLeaf(leaf);

  const index = getLeafIndex(leaf);
  const parentId = leaf.parent;

  delete treeMap[leaf.elementId];
  delete parentMap[leaf.elementId];

  if (parentMap[parentId] && parentMap[parentId].length) {
    const indexInParent = parentMap[parentId].indexOf(leaf.elementId);
    parentMap[parentId].splice(indexInParent, 1);
  }

  if (index > -1) {
    tree.splice(index, 1);
    let i = index;

    for (; i < tree.length; i++) {
      let updatedLeaf = tree[i];
      treeMap[updatedLeaf.elementId] = i;
    }
  }
};

const removeRelated = (leaf) => {
  const bindingLeaf = leaf.bindingLeaf; // getBindingLeaf(leaf);

  if (bindingLeaf) {
    const boundRoot = leaf.boundRoot;
    const bindingLeafBoundRoot = bindingLeaf.boundRoot;
    // const isIndexing = leaf.dataMatch && leaf.dataMatch.length;

    // previous note:
    // if boundRoot === context key, don't remove anything,
    // it's just child in binding context that doesn't need
    // updating (updated data doesn't include this child)
    /// these must be perma deleted
    let bindingLeafElementId = bindingLeaf.elementId;
    if (boundRoot === bindingLeafBoundRoot) {
      removeLeaf(getLeaf(bindingLeafElementId));
      // delete leaf here
    } else {
      const isBoundArray = bindingLeafBoundRoot.split(".").length > 1;

      if (isBoundArray) {
        removeLeaf(getLeaf(bindingLeafElementId));
        // delete leaf here
      }
    }

    return removeLeaf(leaf);
  }

  // remove related parents
  const parentId = leaf.parent;
  const children = getChildrenLeaves(parentId);
  const parentLeaf = leaf.parentLeaf;
  const len = children.length;
  let childrenCount = children.length;
  let k = 0;

  for (; k < len; k++) {
    if (!children[k]) {
      continue;
    }

    childrenCount--;
  }

  if (childrenCount === 0) {
    removeLeaf(leaf);
  }

  if (parentLeaf) {
    const parentBindingLeaf = parentLeaf.bindingLeaf; // getBindingLeaf(parentLeaf);
    const parentContext = parentLeaf.boundRoot;

    // removeLeaf(parentLeaf);
    if (parentBindingLeaf) {
      const parentBoundRoot = parentBindingLeaf.boundRoot;

      if (parentBoundRoot === parentContext) {
        removeLeaf(parentLeaf);
      }
    }
  }

  removeLeaf(leaf);
};

const removeLeaf = (leaf) => {
  const elementId = leaf.elementId;
  const children = getChildrenLeaves(elementId);
  // const hasModel = leaf.model !== undefined;

  tryRemoveElement(leaf.elementId);
  children.forEach(removeLeaf);

  // if (hasModel) {
  //   const model = leaf.model;
  //   checkForUnload(model);
  // }

  // deleteLeaf(leaf);
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

const updateElement = (current, previous, leaf) => {
  let element = getElement(leaf.elementId);

  if (!leaf.dataMatch || leaf.isTemplate) {
    // [w] store: no dataMatch, carry on
    return leaf;
  }

  const componentType = getComponentType(leaf);
  const props = getElementProperties(leaf, componentType);
  const bindables = getBindableFields(props);
  const bindValues = getBindValues(current);
  // const matches = leaf.dataMatch;

  if (!element) {
    let dataAlive = bindables.indexOf("data-alive");

    if (dataAlive > -1) {
      let now = current[dataAlive];
      let earlier = previous[dataAlive];

      if (now.value === true && !earlier.value) {
        // resurrect single leaf
        return render(leaf);
      }
    }

    return leaf;
  }

  let index = 0;
  let len = bindables.length;

  for (; index < len; index++) {
    let attribute = bindables[index];
    let prop = bindValues[index];
    // let match = matches[index];
    let now = current[index];
    let earlier = previous[index];
    let value = now && now.value;
    // let set = (now && now.set) || {};
    let previousValue = earlier && earlier.value;

    // eslint-disable-next-line no-prototype-builtins
    if (value === undefined && previousValue !== undefined && !props.hasOwnProperty("data-alive")) {
      removeLeaf(leaf);
      return;
    }

    if (attribute === "src") {
      element.setAttribute(attribute, value);
      continue;
    }

    if (attribute === "hidden") {
      let hidden = false;

      if (value !== "hidden") {
        hidden = Boolean(value);
      }

      if (value === "hidden") {
        hidden = true;
      }

      if (value === true) {
        hidden = true;
      }

      if (hidden) {
        element.setAttribute(attribute, true);
      } else {
        // TODO: check to default
        element.removeAttribute(attribute);
      }

      continue;
    }

    if (element.type === "radio" && attribute === "checked") {
      element.checked = Boolean(value);
      continue;
    }

    if (element.type === "checkbox" && attribute === "checked") {
      element.checked = Boolean(value);
      continue;
    }

    if (attribute === "for") {
      if (typeof value === "boolean") {
        element.setAttribute("for", value);
        continue;
      }

      // TODO: check to default
      element.removeAttribute("for");
      continue;
    }

    if (attribute === "textContent") {
      element.textContent = value;
      continue;
    }

    if (attribute === "innerText") {
      // let textNodes = [...element.childNodes];
      // .filter(cn => cn.nodeType === 3);
      let userText = props[attribute].split(/\n/gim) || [];
      //   .filter(f => f !== '');

      let i = 0;

      for (i; i < userText.length; i++) {
        if (userText[i]) {
          if (typeof value === "string" && value.startsWith("$")) {
            value = "$" + value;
          }

          userText[i] = userText[i].replace(dataRe, value);

          // textNode.data = userText[i].split(' ')
          //   .map((text, i) =>
          //     text.indexOf(propCtr) > -1 && !text.match(commentRe) ?
          //       (text.replace(propCtr, value !== undefined ?
          //         value : 'marrow_err__use_meta')) :
          //           (text.match(commentRe) ? text.replace(/\/\//igm, '') : text.match(dataRe) &&
          //             (text.replace(dataInverseRe, '')).indexOf(now.prop) > -1 ?
          //               text.replace(dataRe, now.value)

          //               // this will leave it as is, since we are not changing anything
          //             : textNode.data.split(' ')[i]))
          //   .join(' ');
        }
      }

      element[attribute] = userText.join("");

      continue;
    }

    if (attribute === "innerHTML") {
      let propCtr = ["{*:", prop, "}"].join("");

      element.innerHTML = props[attribute]
        .split(" ")
        .map((text) =>
          text.indexOf(propCtr) > -1 && !text.match(commentRe)
            ? text.replace(propCtr, value !== undefined ? value : "marrow_err__use_meta")
            : // slower variant but ok for innnerHTML
              text.match(commentRe)
              ? text.replace(/\/\//gim, "")
              : text.match(dataRe)
                ? text.replace(
                    dataRe,
                    (
                      current
                        .filter((dt) => (text.replace(dataInverseRe, "").indexOf(dt.prop) > -1 ? true : false))
                        .pop() || { value: "wtf" }
                    ).value
                  )
                : text
        )
        .join(" ");
      continue;
    }

    if (attribute.indexOf("data-") > -1) {
      let dataAttr = attribute
        .replace("data-", "")
        .split("-")
        .map((e, i) => (i > 0 ? e.substr(0, 1).toUpperCase() + e.substr(1, e.length) : e))
        .join("");

      element.dataset[dataAttr] = value;
      element.setAttribute(attribute, value);

      if (dataAttr === "alive" && !value) {
        // remove related instead of remove single removeLeaf(leaf);
        removeRelated(leaf);
        return;
      }

      continue;
    }

    if (attribute === "disabled") {
      if (!value) {
        element.removeAttribute("disabled");
        continue;
      }

      element.setAttribute("disabled", "disabled");
      continue;
    }

    if (attribute === "className") {
      let originalClasses = props.className.split(" ");

      let bindedClasses = originalClasses.filter((cls) => cls.match(dataRe));

      bindedClasses.forEach((cls) => element.classList.contains(cls) && element.classList.remove(cls));

      let toAdd = bindedClasses.filter((bc) => bc.replace(boundRe, "").indexOf(prop) > -1)[0];

      if (toAdd && value && value !== "") {
        if (value.split(" ").length > 1) {
          value.split(" ").forEach((val) => element.classList.add(val.replace(dataRe, val)));
        } else {
          element.classList.add(toAdd.replace(dataRe, value));
        }
      }

      if (previousValue && previousValue.length && previousValue !== value) {
        if (previousValue.split(" ").length) {
          previousValue.split(" ").forEach((v) => element.classList.remove(v));
        } else {
          element.classList.remove(previousValue);
        }
      }

      // if (value && value.length) {
      //   if (value.split(' ').length > 1) {
      //     value.split(' ').forEach((v, i) => element.classList.add(v));
      //   } else {
      //     element.classList.add(value);
      //   }
      // }

      if (value === "" && previousValue === "") {
        element.classList.remove(prop);
      }

      continue;
    }

    let ce = element.getAttribute("contentEditable");

    if (ce) {
      element.innerHTML = value;
    }

    if (attribute === "style") {
      let originalStyles = props.style
        .replace(/(\n)/gim, " ")
        .split(";")
        .filter((s) => s.length);

      let styles = {};

      originalStyles.forEach((style) => {
        let split = style.split(":");
        let styleProperty = split[0];
        let styleValue = split.slice(1, split.length).join(":");

        if (styleValue.match(prop)) {
          styleValue = styleValue.replace(dataRe, value);
        }

        styleProperty = styleProperty.trim();
        styleValue = styleValue.trim();

        if (!styleValue.match(dataRe) && styleValue.indexOf("undefined") === -1) {
          // no !important
          if (styleProperty.indexOf("-") > 1) {
            let splitStyle = styleProperty.split("-");
            styleProperty =
              splitStyle[0] + splitStyle[1].substr(0, 1).toUpperCase() + splitStyle[1].substr(1, splitStyle[1].length);
          }
          // TODO: remove setting of "'s
          if (styleProperty.indexOf("--") > -1) {
            // pseudo - set immediately
            element.style.setProperty(styleProperty, styleValue);
          } else {
            // not pseudo - set latter
            styles[styleProperty] = styleValue;
          }
        }
      });

      Object.assign(element.style, styles);
      continue;
    }

    Object.assign(element, { [attribute]: value });
  }

  return leaf;
};

const renderDiffs = async (modelName) => getTemplates(getLeavesByModelRef(modelName)).forEach(render);

const getLeavesByComponentName = (componentName) =>
  getLeaves().filter((leaf) => leaf.componentName && leaf.componentName === componentName);

const getLeavesByFullDataMatch = (leaves, dataMatches) =>
  (dataMatches.length &&
    leaves.filter(
      (leaf) =>
        leaf.dataMatch &&
        leaf.dataMatch.some((dataMatch) =>
          dataMatches.some((dm) => dataMatch === dm || dataMatch.indexOf(dm) > -1 || dm.indexOf(dataMatch) > -1)
        )
    )) ||
  [];

const getLeaves = () => tree;

const getLeavesByModelRef = (modelName) =>
  getLeaves().filter((leaf) => leaf.model && leaf.model.getName() === modelName);

const getTemplates = (leaves) => leaves.filter((leaf) => leaf.isTemplate);

const getLeafByBoundIndex = (leaf, key) =>
  getContextTree(leaf).filter(
    (parent) => parent.boundIndex && parent.boundIndex.indexOf(key.replace(boundRe, "")) > -1
  )[0];

const isViableForUpdate = (data, previousData, leaf) => (
  (leaf.previous = leaf.current ? leaf.current : getRecordFor(leaf, previousData)),
  (leaf.current = getRecordFor(leaf, data)),
  isDifferent(
    leaf.current.map((v) => v.value),
    leaf.previous.map((v) => v.value)
  )
);

const updateOrKill = (leaf) => {
  const current = leaf.current;
  const previous = leaf.previous;
  const nowork = leaf.dataMatch.length === 0;
  const dead = current.filter((v) => v.prop === "alive" && !v.value)[0];

  if (nowork) {
    return;
  }

  if (dead) {
    return removeRelated(leaf);
  }

  const toKill = current.reduce((a, t) => a && t.value === undefined, true);

  if (toKill) {
    return removeLeaf(leaf);
  }

  updateElement(current, previous, leaf);
};

const rake = async (keys, modelName, data, previousData) =>
  await getLeavesByFullDataMatch(getLeavesByModelRef(modelName), keys)
    .filter(isViableForUpdate.bind(null, data, previousData))
    .map(updateOrKill);

const getRecordFor = (leaf, data) =>
  (leaf.dataMatch || []).map((match) => getReduced(match, data)) || [
    {
      prop: "prop",
      value: null,
      set: []
    }
  ];

const getContextTree = (leaf) => {
  const contextTree = [];
  let previous = undefined;

  while (leaf && previous !== leaf) {
    previous = leaf;
    leaf = leaf.parentLeaf;

    if (leaf) {
      contextTree.push(leaf); // unshift
    }
  }

  return contextTree.reverse(); // when unshift is used, no reverse() should be applied
};

const getBindingLeaf = (leaf) => {
  while (leaf && leaf.boundIndex === undefined) {
    leaf = leaf.parentLeaf;
  }

  return leaf;
};

export {
  createLeaf,
  getLeaf,
  getLeaves,
  removeLeaf,
  deleteLeaf,
  updateOrKill,
  updateData,
  updateMeta,
  deleteData,
  renderDiffs,
  rake,
  treeMap,
  dataRe,
  commentRe,
  boundRe,
  quadraticMatchRe,
  getData,
  isDataField,
  getRecordFor,
  getParentsModel,
  Meta,
  getMetaRoot,
  getLeavesByModelRef,
  getLeavesByComponentName,
  getTimestamps,
  getVersionAt,
  rebindValue,
  matchExpression,
  getReduced,
  getElementProperties,
  tree,
  Data
};
