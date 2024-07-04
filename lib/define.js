import Base from "./loader";
import { defineComponent, replaceComponent } from "./component";
import tag from "./tags.js";

import { defineModel } from "./model";

const define = (config) => {
  const componentName = config.name;
  const componentType = config.type;

  if (typeof config !== "object") {
    return console.warn("[w] Invalid component constructor.");
  }

  let what = componentType === "component" ? "components" : "models";

  if (Base[what][componentName]) {
    console.warn(`[w] Overwriting a definition for ${componentType || "(base)"} function -> ${componentName}.`);
    replaceComponent(componentName, componentType);
  }

  if (componentType === "component") {
    return defineComponent(Base, config);
  }

  if (componentType === "model") {
    return defineModel(Base, componentName, config);
  }

  Base[componentName] = config.fn;
};

const bundle = (configs) => configs.forEach(define);

const isDomElement = (htmltag) =>
  // htmltag.indexOf('@') === -1 ?
  htmltag[0] !== "@" ? tag(htmltag) : false;

const isComponentType = (htmltag) => (typeof htmltag !== "string" ? false : Base.components[htmltag]);

const isBoundType = (htmltag) => htmltag[0] === "@";

const getComponentType = (config) =>
  Object.keys(config).filter((key) => isComponentType(key) || isDomElement(key) || isBoundType(key))[0];

export { define, bundle, isDomElement, isComponentType, isBoundType, getComponentType };
