import Base from "./loader";
import { defineComponent, replaceComponent } from "./component";
import tag from "./tags.js";

import { defineModel } from "./model";

/**
 * Defines a component or model and registers it in the appropriate category.
 *
 * @param {Object} definition - Definition object for the component or model.
 * @param {string} definition.name - The unique name of the component or model.
 * @param {string} definition.type - The type of the definition ('component' or 'model').
 *
 * @throws {Error} Logs warnings for invalid definitions, unsupported types, or overwriting existing definitions.
 *
 * @example
 * define({
 *   name: 'myComponent',
 *   type: 'component',
 *   config: { someProperty: 'value' }
 * });
 *
 * @example
 * define({
 *   name: 'myModel',
 *   type: 'model',
 *   config: { someProperty: 'value' }
 * });
 */
const define = (definition) => {
  if (typeof definition !== "object" || !definition.name || !definition.type) {
    console.warn("[w] Invalid or incomplete component definition.");
    return;
  }

  const { name: componentName, type: componentType, config, listen } = definition;
  const validTypes = { component: "components", model: "models" };

  if (!validTypes[componentType]) {
    console.warn(`[w] Unsupported type: '${componentType}'. Valid types are 'component' or 'model'.`);
    return;
  }

  const category = validTypes[componentType];

  // Check for conflicts and issue warnings if overwriting
  if (Base[category]?.[componentName]) {
    console.warn(`[w] Overwriting definition for ${componentType}: '${componentName}'.`);
    replaceComponent(componentName, componentType);
  }

  // Delegate handling based on type
  if (componentType === "component") {
    defineComponent(Base, { name: componentName, config });
  } else if (componentType === "model") {
    defineModel(Base, componentName, { config, listen });
  } else {
    console.warn(`[w] No valid definition logic for type: '${componentType}'.`);
  }
};

const bundle = (configs) => configs.forEach(define);

const isDomElement = (htmltag) => (htmltag[0] !== "@" ? tag(htmltag) : false);

const isComponentType = (htmltag) => (typeof htmltag !== "string" ? false : Base.components[htmltag]);

const isBoundType = (htmltag) => htmltag[0] === "@";

const getComponentType = (config) =>
  Object.keys(config).find((key) => Base.components[key] || tag(key) || key[0] === "@");

export { define, bundle, isDomElement, isComponentType, isBoundType, getComponentType };
