import distinguish from "./distinguish";
import clone from "./clone";
import { bundle, isDomElement, isComponentType, isBoundType, getComponentType } from "./define";
import { getComponent } from "./component";
import {
  dataRe,
  boundRe,
  commentRe,
  getLeaf,
  createLeaf,
  removeLeaf,
  matchExpression,
  getReduced,
  getData,
  getMetaRoot,
  updateOrKill,
  getParentsModel,
  getRecordFor
} from "./store";
import { isObject } from "./primitiveops";
import { bindAttributes, getModelBinding } from "./model";

const elementMap = {};
let queue = [];
let renderEnd = false;
let fragment = document.createDocumentFragment();
let onrenderendFn = [];

const onrenderend = async (callback) =>
  onrenderendFn.length && !callback
    ? onrenderendFn.forEach((cb) => cb())
    : callback
      ? (onrenderendFn.push(callback), onrenderendFn.forEach((cb) => cb()))
      : null;

const tryRemoveElement = (elementId) => removeElement(getElement(elementId), elementId);

const removeElement = (element, elementId) =>
  !element
    ? removeFromTree(elementId)
    : (removeFromTree(element.pid), element.remove ? element.remove() : element.parentNode.removeChild(element));

const removeFromTree = (elementId) => (elementMap[elementId] ? delete elementMap[elementId] : null);

const rebindComponentType = (componentType, parentLeaf, candidate = undefined) => (
  (candidate = matchExpression(componentType, parentLeaf)),
  (candidate = getReduced(candidate, getData([candidate.split("--")[0]]))),
  (candidate = candidate.value || candidate.set),
  candidate ? candidate : componentType
);

const mapChild = (childType, parentLeaf) => {
  if (typeof childType !== "string") {
    return childType;
  }

  let child = {
    parent: parentLeaf.elementId
  };

  if (childType.match(dataRe)) {
    child.floating = childType;
    let reboundComponentType = rebindComponentType(childType, parentLeaf);

    if (isObject(reboundComponentType)) {
      const childType = getComponentType(reboundComponentType);
      child[childType] = reboundComponentType[childType];
    }

    if (typeof reboundComponentType === "string") {
      childType = reboundComponentType;
      child[childType] = {};
    }
  }

  if (child[childType] === undefined) {
    const constructor = getComponent(childType);

    if (constructor) {
      const component = new constructor();
      const componentConfig = component.getConfig();
      const newType = getComponentType(componentConfig);
      child[childType] = newType;
    } else {
      if (typeof constructor === "string" || isDomElement(childType)) {
        child[childType] = {};
      }
    }
  }

  return child;
};

const getElement = (id) => (elementMap[id] ? elementMap[id] : document.getElementById(id));

const renderOut = (renderPeace) => {
  let parent = getElement(renderPeace.parent) || fragment;
  let element = renderPeace.element;
  let leaf = renderPeace.leaf;

  if (parent && element) {
    const startAt = leaf.position;
    const beforeChild = parent.children[startAt];
    parent.insertBefore(element, beforeChild);

    if (leaf.dataMatch && leaf.dataMatch.length) {
      updateOrKill(leaf);
    }
  }

  return renderPeace.onmounted;
};

const appendRenderPeace = (renderPeace) =>
  renderHTML(renderPeace.config, renderPeace.leaf, renderPeace.data, renderPeace.componentType);

const applyMounting = (onmounted) =>
  queue.length === 0 && !renderEnd
    ? ((renderEnd = true),
      document.body.appendChild(fragment),
      (fragment = document.createDocumentFragment()),
      window.cancelAnimationFrame(chunkizeForRender),
      onrenderend())
    : onmounted
      ? onmounted()
      : null;

const applyChunk = async (chunk) => chunk.map(appendRenderPeace).map(applyMounting);

const chunkizeForRender = () => {
  let queueSlice = queue.splice(0, queue.length);
  let len = queueSlice.length;
  let coef = Math.floor((len * 2) / 100) || 1;
  let byCoef = parseInt(len / coef);
  let chunks = queueSlice.reduce((all, one, i) => {
    const chunkSize = Math.floor(i / byCoef);

    if (!all[chunkSize]) {
      all[chunkSize] = [];
    }

    all[chunkSize].push(one);

    return all;
  }, []);

  chunks.map(applyChunk);
};

const renderComponent = (componentType, config) => {
  const parent = config.parent;
  const constructor = getComponent(componentType);
  const component = new constructor();
  let componentConfig = component.getConfig();
  const newType = getComponentType(componentConfig);

  componentConfig.parent = parent;

  if (config.floating) {
    componentConfig.floating = config.floating;
  }

  // assign configuration to component (if any databinding - assign)
  Object.keys(componentConfig[newType]).forEach((prop) =>
    typeof componentConfig[newType][prop] === "string" && typeof config[componentType][prop] === "string"
      ? prop.startsWith("on")
        ? (componentConfig[newType][prop] += `,${config[componentType][prop]}`)
        : (componentConfig[newType][prop] += ` ${config[componentType][prop]}`)
      : Object.assign(componentConfig[newType][prop], config[componentType][prop])
  );
  // assign new config specifics to new component
  // eslint-disable-next-line no-unused-expressions
  typeof config[componentType] !== "string"
    ? Object.keys(config[componentType]).forEach((prop) =>
        // eslint-disable-next-line no-prototype-builtins
        !componentConfig[newType].hasOwnProperty(prop)
          ? (componentConfig[newType][prop] = config[componentType][prop])
          : null
      )
    : null;
  // typeof config[componentType] === 'string' ? componentConfig[newType][componentType] = config : null;

  if (config[componentType].model) {
    // NOTE: assign new model
    componentConfig[newType].model = config[componentType].model;
  }

  render(componentConfig);
};

const renderChildren = (componentType, config, parentLeaf) =>
  config[componentType] && config[componentType].children
    ? config[componentType].children.forEach((config, index) =>
        render(Object.assign(mapChild(config, parentLeaf), { parent: parentLeaf.elementId, index: index }))
      )
    : null;

const renderBound = (componentType, config) => {
  const parentLeaf = getLeaf(config.parent);
  const template = createLeaf(parentLeaf.elementId, config);
  const children = prepareBoundChildren(componentType, config, parentLeaf, template.elementId);

  let len = children.length;
  let coef = Math.floor((len * 2) / 100) || 1;
  let byCoef = parseInt(len / coef);
  let chunks = children.reduce((all, one, i) => {
    const chunkSize = Math.floor(i / byCoef);

    if (!all[chunkSize]) {
      all[chunkSize] = [];
    }

    all[chunkSize].push(one);

    return all;
  }, []);

  let timeoutFn = function (chunk) {
    chunk.map(render);
  };

  chunks.map((chunk) => setTimeout(timeoutFn.bind(null, chunk), 0));
};

const getDataKey = (key, parentLeaf) => key.replace("*:", getParentsModel(parentLeaf).getName() + "--");

const solveData = (
  componentType,
  parentLeaf,
  key = undefined,
  metaTransform = undefined,
  metaRoot = undefined,
  metaKey = undefined
) => (
  (key = getBoundRoot(componentType)),
  componentType.indexOf("*:") > -1
    ? ((key = getDataKey(key, parentLeaf)),
      (metaTransform = parentLeaf.model && parentLeaf.model.getMetaTransform(parentLeaf.elementId, key)),
      (metaRoot = getMetaRoot(parentLeaf)),
      (metaKey = metaRoot ? metaTransform[key + "|" + metaRoot.elementId] : undefined),
      (key = metaKey ? metaKey : key))
    : null,
  key
    ? (getData([key.substr(0, key.indexOf("--"))])[key] || []).map((d, i) => ({
        index: i,
        metaKey: metaKey
      }))
    : undefined
);

const getBoundRoot = (key) => key.replace(boundRe, "");

const prepareBoundChildFromString = (componentType, config, parentLeaf, boundRoot, startAt, component = {}) => (
  (component = getComponent(config[componentType])),
  (component = new component()),
  (component = component.getConfig()),
  (component.parent = parentLeaf.elementId),
  (component.boundIndex = `${boundRoot}.${startAt}`),
  // getBoundRoot(componentType) + '::' + startAt;
  // assign parent's attributes ...
  (config[componentType] = component),
  config[componentType]
);

const prepareBoundChild = (componentType, config, parentLeaf, boundRoot, startAt, templateId, component = {}) => (
  (boundRoot = getDataKey(boundRoot, parentLeaf, componentType)),
  typeof config[componentType] === "string" && isComponentType(config[componentType])
    ? (config[componentType] = prepareBoundChildFromString(componentType, config, parentLeaf, boundRoot, startAt))
    : null,
  Object.assign(component, config[componentType]),
  {
    parent: parentLeaf.elementId,
    boundIndex: `${boundRoot}.${startAt}`,
    boundRoot: boundRoot,
    templateId: templateId,
    [getComponentType(component)]: component[getComponentType(component)]
  }
);

const prepareBoundChildren = (componentType, config, parentLeaf, templateId) =>
  (solveData(componentType, parentLeaf) || []).map((data) =>
    prepareBoundChild(
      componentType,
      config,
      parentLeaf,
      data.metaKey ? data.metaKey : getBoundRoot(componentType),
      data.index,
      templateId
    )
  );

const renderHTML = (config, leaf, data, componentType) => {
  const elementId = leaf.elementId;
  const element = getElement(elementId);

  if (!element) {
    return;
  }

  // NOTE: raw attributes from config[componentType] can be changed upstream by meta transformation,
  // so we'll use leaf[componentType] which holds correct configuration in both cases, meta transformed and default
  let rawAttributes = Object.assign({}, leaf[componentType]);
  const boundAttributes = leaf.model ? bindAttributes(rawAttributes, leaf, data) : rawAttributes;
  const attributeKeys = Object.keys(boundAttributes);
  let parentId = config.parent;
  // replace markup because {} can't go render
  let attributes = {};
  attributeKeys.forEach((key) => (attributes[key] = boundAttributes[key]));

  delete attributes.children;

  const dragTouchEvents = [];
  // 'dragenter',
  // 'dragleave',
  // 'dragover',
  // 'dragstart',
  // 'drop',
  // 'touchstart',
  // 'touchend',
  // 'touchcancel',
  // 'touchmove',
  // 'wheel'];

  // assing events and attributes to element
  attributeKeys.forEach((key, i, arr, ev) =>
    key !== "children"
      ? key.startsWith("on") && key !== "oninitelement"
        ? ((ev = key.substr(2, key.length)),
          dragTouchEvents.indexOf(ev) > -1
            ? element.addEventListener(ev, attributes[key], { passive: true })
            : element.addEventListener(
                ev,
                attributes[key] && typeof attributes[key] === "string" && attributes[key].startsWith("!#")
                  ? eval(attributes[key].substr(2, attributes[key].length))
                  : typeof attributes[key] === "function"
                    ? eval(attributes[key])
                    : attributes[key]
              ))
        : (element[key] = attributes[key])
      : null
  );

  // remove commented markup
  let textNodes = [...element.childNodes].filter((cn) => cn.nodeType === 3);

  let i = 0;

  for (i; i < textNodes.length; i++) {
    let textNode = textNodes[i];

    if (textNode) {
      textNode.data = textNode.data.match(commentRe) ? textNode.data.replace(/\/\//gim, "") : textNode.data;
    }
  }

  // dataset stuff
  let dataset = attributeKeys.filter((key) => key.indexOf("data-") === 0);

  if (attributeKeys.indexOf("for") > -1) {
    element.setAttribute("for", config[componentType]["for"]);
  }
  // assign dataset
  dataset.forEach((dataField) => (element.dataset[dataField.replace("data-", "")] = attributes[dataField]));

  if (!parentId) {
    parentId = "body";
  }

  const renderPeace = {
    leaf: leaf,
    parent: parentId,
    element: element,
    elementId: elementId,
    onmounted: attributes["onmounted"]
  };

  return renderOut(renderPeace);
};

const render = (configuration) => {
  if (typeof configuration === "string") {
    return distinguish(configuration);
  }

  if (!(configuration instanceof Object) || Object.keys(configuration).length === 0) {
    console.warn(`[x] Component config should be an object.`);
    return false;
  }

  const config = clone(configuration);

  let componentType = getComponentType(config);

  if (componentType === undefined) {
    let constructor = getComponent(config.name);

    if (config.type && config.name) {
      if (typeof constructor !== "function") {
        bundle([config]);
        constructor = getComponent(config.name);
      }

      let component = new constructor();
      let componentConfig = component.getConfig();

      componentType = getComponentType(componentConfig);

      if (!componentConfig.parent) {
        componentConfig.parent =
          config.parent || (config.config && config.config[componentType] && config.config[componentType].parent);
      }

      if (componentConfig[componentType].model) {
        componentConfig.model = componentConfig[componentType].model;
      }

      if (component.name) {
        componentConfig.name = component.name;
      }

      return render(componentConfig);
    }

    if (config.floating) {
      return console.warn(`[w] Floating component unavailable at model initialization time. ${config.floating}`);
    }

    return console.warn(`[w] Unknown component or DOM child: ${componentType}.`);
  }

  let parentId = config[componentType].parent ? config[componentType].parent : config.parent;

  let model = config.model;

  if (
    model &&
    typeof config[componentType] !== "string" &&
    !config[componentType].model &&
    !Object.isFrozen(config[componentType])
  ) {
    config[componentType].model = model;
  }

  let componentName = config.name;

  if (
    componentName &&
    typeof config[componentType] !== "string" &&
    !config[componentType].name &&
    !Object.isFrozen(config[componentType])
  ) {
    config[componentType].name = componentName;
  }

  if (!parentId) {
    parentId = "body";
  }

  // !parentId...
  if (!parentId.indexOf("EL") === -1 || parentId.startsWith(".")) {
    if (parentId !== "body") {
      let parentEl = document.querySelector(parentId);
      parentId = parentEl ? parentEl.pid : "body";
      if (config[componentType].model) {
        config.implicit = true;
      }
    }
  }

  config.parent = parentId;

  if (config[componentType].implicit !== undefined) {
    config.implicit = config[componentType].implicit;
  }

  if (isComponentType(componentType)) {
    return renderComponent(componentType, config);
  }

  if (isBoundType(componentType)) {
    return renderBound(componentType, config);
  }

  if (config[componentType].position === undefined && !Object.isFrozen(config[componentType])) {
    config[componentType].position = config.index || undefined;
  }

  const leaf = config.elementId ? getLeaf(config.elementId) : createLeaf(parentId, config);

  let element = getElement(leaf.elementId);
  let parentEl = getElement(parentId);

  if (parentId !== "body" && !parentEl) {
    return removeLeaf(leaf);
  }

  if (!element) {
    element = document.createElement(componentType);
    element.pid = leaf.elementId;
    element.position = leaf.position;
    elementMap[leaf.elementId] = element;

    let data = undefined;
    let previousData = undefined;

    if (config[componentType].oninitelement) {
      const modelBinding = getModelBinding(config[componentType].oninitelement);

      if (modelBinding) {
        modelBinding.fn(modelBinding.model, leaf.current, element);
      }
    }

    const model = leaf.model;

    if (model) {
      data = model ? getData([leaf.model.getName()]) : undefined;
      previousData = model ? getData([leaf.model.getName()], -1) : undefined;

      leaf.current = getRecordFor(leaf, data);
      leaf.previous = getRecordFor(leaf, previousData);
    }

    if (!queue.length) {
      window.requestAnimationFrame(chunkizeForRender);
    }

    queue.push({ config, leaf, data, componentType });
    renderEnd = false;
  }

  renderChildren(componentType, config, leaf);
};

export { render, tryRemoveElement, getElement, mapChild, onrenderend };
