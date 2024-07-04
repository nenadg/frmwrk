import Base from "./loader";
import clone from "./clone";
import { render } from "./render";
import { removeLeaf, getLeavesByComponentName } from "./store";

/**
 * Get a component object by its name
 * @param {string} name - Name of the component
 * @returns {object} - Component object
 */
const getComponent = (name) => Base.components[name];

/**
 * Replace all instances of a component with a new component type
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
 * Define a new component and add it to the root method
 * @param {object} rootMethod - The root method to add the component to
 * @param {object} config - Configuration for the new component
 */
const defineComponent = (rootMethod, config) => {
	rootMethod.components[config.name] = function () {};
	rootMethod.components[config.name].prototype.name = config.name;
	rootMethod.components[config.name].prototype.getConfig = () => clone(config.config);
};

export { getComponent, replaceComponent, defineComponent };
