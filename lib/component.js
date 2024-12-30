import Base from "./loader.js";
import clone from "./clone.js";
import { render } from "./render.js";
import { removeLeaf, getLeavesByComponentName } from "./tree.js";
/**
 * Get a component object by its name
 *
 * @param {string} name - Name of the component
 * @returns {object} - Component object
 */
const getComponent = (name) => Base.components[name];

/**
 * Replace all instances of a component with a new component type
 *
 * @param {string} componentName - Name of the component to be replaced
 * @param {string} componentType - New component type
 */
const replaceComponent = (componentName, componentType) => {
	getLeavesByComponentName(componentName).forEach(
		(leaf) => (
			removeLeaf(leaf),
			render({
				parent: leaf.parent,
				[componentType]: leaf.componentName
			})
		)
	);
};

/**
 * Defines a new component and adds it to the root method.
 *
 * @param {object} rootMethod - The root method to add the component to.
 * @param {object} config - The configuration for the new component.
 */
const defineComponent = (rootMethod, config) => {
	const { name, config: componentConfig } = config;

	// Define the new component function (constructor)
	const newComponent = function () {};

	// Attach properties to the component function's prototype
	newComponent.prototype.name = name;
	newComponent.prototype.getConfig = () => clone(componentConfig);

	// Add the new component to the rootMethod's components
	rootMethod.components = {
		...rootMethod.components,
		[name]: newComponent
	};
};

export { getComponent, replaceComponent, defineComponent };
