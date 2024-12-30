import distinguish from "./distinguish";
import clone from "./clone";
import { bundle, isDomElement, isComponentType, isBoundType, getComponentType } from "./define";
import { getComponent } from "./component";
import { dataRe, boundRe, commentRe, matchExpression, getReduced, getData } from "./store";
import {
  getRecordFor,
  getLeaf,
  createLeaf,
  removeLeaf,
  getParentsModel,
  updateOrKill,
  getTemplates,
  getLeavesByModelRef
} from "./tree.js";
import { isObject } from "./primitiveops";
import { bindAttributes, getModelBinding } from "./model";
import { getMetaRoot } from "./meta";

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

/**
 * Maps a child component based on its type and the parent leaf.
 *
 * @param {string|object} childType - The type of the child component or an object.
 * @param {object} parentLeaf - The parent component's leaf object containing an `elementId`.
 * @returns {object} The mapped child object.
 */
const mapChild = (childType, parentLeaf) =>
  typeof childType !== "string"
    ? childType
    : {
        parent: parentLeaf.elementId,
        ...(childType.match(dataRe) ? mapFloatingChild(childType, parentLeaf) : {}),
        ...(childType[childType] === undefined ? mapNewComponentType(childType) : {})
      };

/**
 * Handles floating child logic and rebinding component type.
 */
const mapFloatingChild = (childType, parentLeaf, reboundComponentType = undefined) => (
  (reboundComponentType = rebindComponentType(childType, parentLeaf)),
  isObject(reboundComponentType)
    ? { [getComponentType(reboundComponentType)]: reboundComponentType[getComponentType(reboundComponentType)] }
    : typeof reboundComponentType === "string"
      ? { [reboundComponentType]: {} }
      : {}
);

/**
 * Handles mapping of new component types if childType is undefined.
 */
const mapNewComponentType = (childType, constructor = undefined) => (
  (constructor = getComponent(childType)),
  constructor
    ? (() => {
        const component = new constructor();
        const componentConfig = component.getConfig();
        const newType = getComponentType(componentConfig);
        return { [childType]: newType };
      })()
    : typeof constructor === "string" || isDomElement(childType)
      ? { [childType]: {} }
      : {}
);

const getElement = (id) => (elementMap[id] ? elementMap[id] : document.getElementById(id));

/**
 * Renders a component to the DOM based on the provided render peace configuration.
 *
 * @param {object} renderPeace - The render peace object containing the parent, element, leaf, and other properties.
 * @returns {function} The `onmounted` callback function from `renderPeace`.
 */
const renderOut = (renderPeace) =>
  renderPeace.parent && renderPeace.element
    ? (() => {
        const parent = getElement(renderPeace.parent) || fragment;
        const { element, leaf } = renderPeace;
        const startAt = leaf.position;
        const beforeChild = parent.children[startAt];

        parent.insertBefore(element, beforeChild);

        if (leaf.dataMatch && leaf.dataMatch.length) {
          updateOrKill(leaf);
        }

        return renderPeace.onmounted;
      })()
    : renderPeace.onmounted;

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

/**
 * Splits the queue into chunks and applies the chunk handling function.
 *
 * @param {Array} queue - The array to be chunked.
 */
const chunkizeForRender = () => {
  let queueSlice = queue.splice(0, queue.length);
  let len = queueSlice.length;

  const coef = Math.floor((len * 2) / 100) || 1;
  const byCoef = Math.floor(len / coef);

  queueSlice
    .reduce((chunks, item, index) => {
      const chunkSize = Math.floor(index / byCoef);
      chunks[chunkSize] = chunks[chunkSize] || [];
      chunks[chunkSize].push(item);
      return chunks;
    }, [])
    .forEach(applyChunk);
};

/**
 * Renders a component with the specified configuration.
 *
 * @param {string} componentType - The type of the component to render.
 * @param {object} config - The configuration object for the component.
 */
const renderComponent = (componentType, config) => {
  const { parent, floating } = config;
  const constructor = getComponent(componentType);
  const component = new constructor();
  const componentConfig = component.getConfig();
  const newType = getComponentType(componentConfig);

  const updatedConfig = {
    ...componentConfig,
    parent,
    ...(floating && { floating }),
    [newType]: {
      ...componentConfig[newType],
      ...Object.keys(componentConfig[newType]).reduce((acc, prop) => {
        const propValue = componentConfig[newType][prop];
        const configValue = config[componentType]?.[prop];
        if (typeof propValue === "string" && typeof configValue === "string") {
          acc[prop] = prop.startsWith("on") ? `${propValue},${configValue}` : `${propValue} ${configValue}`;
        } else if (propValue && configValue) {
          acc[prop] = { ...propValue, ...configValue };
        }
        return acc;
      }, {}),
      ...(typeof config[componentType] !== "string"
        ? Object.keys(config[componentType]).reduce((acc, prop) => {
            if (!componentConfig[newType].hasOwnProperty(prop)) {
              acc[prop] = config[componentType][prop];
            }
            return acc;
          }, {})
        : {}),
      ...(config[componentType]?.model && { model: config[componentType].model })
    }
  };

  render(updatedConfig);
};

const renderChildren = (componentType, config, parentLeaf) =>
  config[componentType] && config[componentType].children
    ? config[componentType].children.forEach((config, index) =>
        render(Object.assign(mapChild(config, parentLeaf), { parent: parentLeaf.elementId, index: index }))
      )
    : null;

/**
 * Renders a component with bound children.
 *
 * @param {string} componentType - The type of the component to render.
 * @param {object} config - The configuration object for the component.
 */
const renderBound = (componentType, config) => {
  const parentLeaf = getLeaf(config.parent);
  const template = createLeaf(parentLeaf.elementId, config);
  const children = prepareBoundChildren(componentType, config, parentLeaf, template.elementId);

  const len = children.length;
  const coef = Math.floor((len * 2) / 100) || 1;
  const byCoef = Math.floor(len / coef);

  const chunks = children.reduce((all, child, i) => {
    const chunkSize = Math.floor(i / byCoef);
    all[chunkSize] = all[chunkSize] || [];
    all[chunkSize].push(child);
    return all;
  }, []);

  chunks.forEach((chunk) => setTimeout(() => chunk.forEach(render), 0));
};

const getDataKey = (key, parentLeaf) => key.replace("*:", getParentsModel(parentLeaf).getName() + "--");

/**
 * Solves and transforms data based on the provided componentType and parentLeaf.
 *
 * @param {string} componentType - The type of the component.
 * @param {object} parentLeaf - The parent leaf object.
 * @param {string} [key] - The key to use for data retrieval.
 * @param {object} [metaTransform] - The meta transformation function.
 * @param {object} [metaRoot] - The root of the meta data.
 * @param {string} [metaKey] - The meta key.
 * @returns {Array|undefined} An array of transformed data or undefined.
 */
const solveData = (
  componentType,
  parentLeaf,
  key = undefined,
  metaTransform = undefined,
  metaRoot = undefined,
  metaKey = undefined
) => {
  const keyFromBoundRoot = getBoundRoot(componentType);
  const isMetaComponent = componentType.indexOf("*:") > -1;

  if (isMetaComponent) {
    key = getDataKey(keyFromBoundRoot, parentLeaf);
    metaTransform = parentLeaf.model?.getMetaTransform(key);
    metaRoot = getMetaRoot(parentLeaf);
    metaKey = metaRoot ? metaTransform?.[key + "|" + metaRoot.elementId] : undefined;
    key = metaKey || key;
  }

  return key
    ? ([getData([key.substr(0, key.indexOf("--"))])[key]] || []).flat().map((d, i) => ({
        index: i,
        metaKey: metaKey || key
      }))
    : undefined;
};

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

/**
 * Renders HTML based on the configuration, leaf, data, and component type.
 *
 * @param {object} config - The configuration for rendering.
 * @param {object} leaf - The leaf element.
 * @param {object} data - The data used for rendering.
 * @param {string} componentType - The type of the component to render.
 * @returns {void}
 */
const renderHTML = (config, leaf, data, componentType) => {
  const elementId = leaf.elementId;
  const element = getElement(elementId);

  if (!element) return;

  // Get raw and bound attributes
  const rawAttributes = { ...leaf[componentType] };
  const boundAttributes = leaf.model ? bindAttributes(rawAttributes, leaf, data) : rawAttributes;

  // Prepare attributes and remove 'children'
  const attributes = Object.fromEntries(Object.entries(boundAttributes).filter(([key]) => key !== "children"));

  // Define event types
  const dragTouchEvents = [
    "dragenter",
    "dragleave",
    "dragover",
    "dragstart",
    "drop",
    "touchstart",
    "touchend",
    "touchcancel",
    "touchmove",
    "wheel"
  ];

  // Add events and attributes to the element
  Object.entries(attributes).forEach(([key, value]) => {
    if (key.startsWith("on") && key !== "oninitelement") {
      const event = key.substr(2);

      if (dragTouchEvents.includes(event)) {
        element.addEventListener(event, value, { passive: true });
      } else {
        element.addEventListener(
          event,
          typeof value === "string" && value.startsWith("!#")
            ? eval(value.substr(2))
            : typeof value === "function"
              ? eval(value)
              : value
        );
      }
    } else {
      element[key] = value;
    }
  });

  // Clean text nodes (remove comments)
  [...element.childNodes]
    .filter((cn) => cn.nodeType === 3)
    .forEach((textNode) => {
      if (textNode) {
        textNode.data = textNode.data.match(commentRe) ? textNode.data.replace(/\/\//gim, "") : textNode.data;
      }
    });

  // Handle dataset attributes
  Object.keys(attributes)
    .filter((key) => key.startsWith("data-"))
    .forEach((dataField) => {
      element.dataset[dataField.replace("data-", "")] = attributes[dataField];
    });

  if (attributes["for"]) {
    element.setAttribute("for", config[componentType]["for"]);
  }

  // Prepare renderPeace object
  const parentId = config.parent || "body";
  const renderPeace = {
    leaf,
    parent: parentId,
    element,
    elementId,
    onmounted: attributes["onmounted"]
  };

  return renderOut(renderPeace);
};

/**
 * Renders a component or DOM child based on the configuration.
 *
 * @param {object|string} configuration - The configuration object for rendering or a string for distinguishing.
 * @returns {void}
 */
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

const renderDiffs = async (modelName) => getTemplates(getLeavesByModelRef(modelName)).forEach(render);

export { render, tryRemoveElement, getElement, mapChild, onrenderend, renderDiffs };
