import { getElement, render } from "./render.js";
import { getComponentType } from "./define.js";
import {
  dataRe,
  boundRe,
  commentRe,
  dataInverseRe,
  removeLeaf,
  removeRelated,
  getElementProperties,
  getBindableFields,
  getBindValues
} from "./store.js";

/**
 * Updates the element based on current and previous state, and the leaf configuration.
 *
 * @param {object} current - The current data values.
 * @param {object} previous - The previous data values.
 * @param {object} leaf - The leaf configuration containing element and properties.
 * @returns {object} - The updated leaf configuration.
 */
const updateElement = (current, previous, leaf) => {
  const element = getElement(leaf.elementId);

  if (!leaf.dataMatch || leaf.isTemplate) {
    // [w] store: no dataMatch, carry on
    return leaf;
  }

  if (!element) {
    return handleMissingElement(current, previous, leaf);
  }

  const { props, bindables, bindValues } = prepareElementData(current, previous, leaf);
  return updateAttributes(element, bindables, bindValues, props, current, previous, leaf);
};

/**
 * Prepares necessary data for element update.
 *
 * @param {object} current - The current data values.
 * @param {object} previous - The previous data values.
 * @param {object} leaf - The leaf configuration containing element and properties.
 * @returns {object} - Prepared data for element update.
 */
const prepareElementData = (current, previous, leaf) => {
  const componentType = getComponentType(leaf);
  const props = getElementProperties(leaf, componentType);
  const bindables = getBindableFields(props);
  const bindValues = getBindValues(current);
  return { props, bindables, bindValues };
};

/**
 * Handles a missing element (when no element is found for the given leaf).
 *
 * @param {object} current - The current data values.
 * @param {object} previous - The previous data values.
 * @param {object} leaf - The leaf configuration containing element and properties.
 * @returns {object} - The leaf configuration after handling the missing element.
 */
const handleMissingElement = (current, previous, leaf) => {
  const dataAlive = getBindableFields(leaf).indexOf("data-alive");

  if (dataAlive > -1) {
    const now = current[dataAlive];
    const earlier = previous[dataAlive];

    if (now.value === true && !earlier.value) {
      return render(leaf); // Resurrect single leaf
    }
  }

  return leaf;
};

/**
 * Updates the attributes of the element based on bindables and values.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {Array} bindables - The list of bindable attributes.
 * @param {Array} bindValues - The list of values to bind to the attributes.
 * @param {object} props - The element properties.
 * @param {object} current - The current data values.
 * @param {object} previous - The previous data values.
 * @param {object} leaf - The leaf configuration.
 * @returns {object} - The updated leaf configuration.
 */
const updateAttributes = (element, bindables, bindValues, props, current, previous, leaf) => {
  let index = 0;
  let len = bindables.length;

  for (; index < len; index++) {
    const attribute = bindables[index];
    const prop = bindValues[index];
    const now = current[index];
    const earlier = previous[index];
    const value = now?.value;
    const previousValue = earlier?.value;

    if (value === undefined && previousValue !== undefined && !props.hasOwnProperty("data-alive")) {
      removeLeaf(leaf); // Remove leaf if value is undefined and no data-alive property
      return;
    }

    handleAttributeUpdate(element, attribute, value, previousValue, props, prop, current, previous, leaf);
  }

  return leaf;
};

/**
 * Handles updating an individual attribute on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {string} attribute - The attribute to update.
 * @param {any} value - The value to set for the attribute.
 * @param {object} props - The element properties.
 * @param {object} current - The current data values.
 * @param {object} previous - The previous data values.
 * @param {object} leaf - The leaf configuration.
 */
const handleAttributeUpdate = (element, attribute, value, previousValue, props, prop, current, previous, leaf) => {
  switch (attribute) {
    case "src":
      element.setAttribute(attribute, value);
      break;
    case "hidden":
      handleHiddenAttribute(element, value);
      break;
    case "for":
      handleForAttribute(element, value);
      break;
    case "textContent":
      element.textContent = value;
      break;
    case "innerText":
      handleInnerTextAttribute(element, value, props, attribute);
      break;
    case "innerHTML":
      handleInnerHTMLAttribute(element, value, props, prop, attribute, current);
      break;
    case "data-":
      handleDataAttributes(element, attribute, value, leaf);
      break;
    case "disabled":
      handleDisabledAttribute(element, value);
      break;
    case "className":
      handleClassNameAttribute(element, value, previousValue, props.className, attribute, prop);
      break;
    case "style":
      handleStyleAttribute(element, value, props.style, attribute, props, prop);
      break;
    case "checked":
    case "radio":
    case "checkbox":
      handleCheckableAttributes(element, attribute, value);
      break;
    default:
      Object.assign(element, { [attribute]: value });
      break;
  }
};

/**
 * Handles the 'hidden' attribute update on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {any} value - The value for the 'hidden' attribute.
 */
const handleHiddenAttribute = (element, value) => {
  const hidden = value === "hidden" || Boolean(value);
  if (hidden) {
    element.setAttribute("hidden", true);
  } else {
    element.removeAttribute("hidden");
  }
};

/**
 * Handles the 'for' attribute update on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {any} value - The value for the 'for' attribute.
 */
const handleForAttribute = (element, value) => {
  if (typeof value === "boolean") {
    element.setAttribute("for", value);
  } else {
    element.removeAttribute("for");
  }
};

/**
 * Handles the 'innerText' attribute update on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {any} value - The value for the 'innerText' attribute.
 * @param {object} props - The element properties.
 * @param {string} attribute - The attribute name.
 */
const handleInnerTextAttribute = (element, value, props, attribute) => {
  const userText = props[attribute].split(/\n/gim) || [];
  let i = 0;

  for (i; i < userText.length; i++) {
    if (userText[i]) {
      if (typeof value === "string" && value.startsWith("$")) {
        value = "$" + value;
      }

      userText[i] = userText[i].replace(dataRe, value);
    }
  }

  element[attribute] = userText.join("");
};

/**
 * Handles the 'innerHTML' attribute update on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {any} value - The value for the 'innerHTML' attribute.
 * @param {object} props - The element properties.
 * @param {string} attribute - The attribute name.
 * @param {object} current - The current data values.
 */
const handleInnerHTMLAttribute = (element, value, props, prop, attribute, current) => {
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
};

/**
 * Handles the 'data-' attributes update on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {string} attribute - The attribute name.
 * @param {any} value - The value for the 'data-' attribute.
 * @param {object} leaf - The leaf configuration.
 */
const handleDataAttributes = (element, attribute, value, leaf) => {
  const dataAttr = attribute
    .replace("data-", "")
    .split("-")
    .map((e, i) => (i > 0 ? e[0].toUpperCase() + e.substr(1) : e))
    .join("");
  element.dataset[dataAttr] = value;
  element.setAttribute(attribute, value);

  if (dataAttr === "alive" && !value) {
    removeRelated(leaf);
  }
};

/**
 * Handles the 'disabled' attribute update on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {any} value - The value for the 'disabled' attribute.
 */
const handleDisabledAttribute = (element, value) => {
  if (!value) {
    element.removeAttribute("disabled");
  } else {
    element.setAttribute("disabled", "disabled");
  }
};

/**
 * Handles the 'className' attribute update on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {any} value - The value for the 'className' attribute.
 * @param {string} className - The current className.
 * @param {string} attribute - The attribute name.
 */
const handleClassNameAttribute = (element, value, previousValue, className, attribute, prop) => {
  let originalClasses = className.split(" ");

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
};

/**
 * Handles the 'style' attribute update on the element.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {any} value - The value for the 'style' attribute.
 * @param {string} style - The current style.
 * @param {string} attribute - The attribute name.
 */
const handleStyleAttribute = (element, value, style, attribute, props, prop) => {
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
};

/**
 * Handles checkable attributes like "checked" for radio and checkbox elements.
 *
 * @param {HTMLElement} element - The element to update.
 * @param {string} attribute - The attribute name.
 * @param {any} value - The value for the 'checked' attribute.
 */
const handleCheckableAttributes = (element, attribute, value) => {
  if (attribute === "checked") {
    element.checked = Boolean(value);
  }
};

export default updateElement;
