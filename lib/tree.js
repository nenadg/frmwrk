import { hash, enhancedLeafHash } from "./hash.js";
import { getComponentType } from "./define.js";
import { getModel } from "./model";
import { boundRe, bindToData, getReduced } from "./store.js";
import { isDifferent } from "./primitiveops.js";
import { tryRemoveElement } from "./render.js";
import updateElement from "./updater";

let Tree = [];
let TreeMap = {};
let ParentMap = {};

const getLeaves = () => Tree;

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

const createLeafId = (attributes, parentId) => {
	const hashInput = getHash(attributes) + parentId;
	return enhancedLeafHash(hashInput);
};

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

	// let hashCtor = getHash(attributes);

	leaf.elementId = "EL" + createLeafId(attributes, parentId);

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
	TreeMap[leaf.elementId] = Tree.length - 1;

	if (!ParentMap[parentId]) {
		ParentMap[parentId] = [];
	}

	ParentMap[parentId].push(leaf.elementId);

	Object.freeze(leaf[componentType]);

	return leaf;
};

const addLeaf = (leaf) => Tree.push(leaf);

const getLeafIndex = (leaf) => (leaf ? TreeMap[leaf.elementId] : -1);

const getLeaf = (elementId) => Tree[TreeMap[elementId]];

const getChildrenLeaves = (elementId) => (ParentMap[elementId] ? ParentMap[elementId].map(getLeaf) : []);

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

	delete TreeMap[leaf.elementId];
	delete ParentMap[leaf.elementId];

	if (ParentMap[parentId] && ParentMap[parentId].length) {
		const indexInParent = ParentMap[parentId].indexOf(leaf.elementId);
		ParentMap[parentId].splice(indexInParent, 1);
	}

	if (index > -1) {
		Tree.splice(index, 1);
		let i = index;

		for (; i < Tree.length; i++) {
			let updatedLeaf = Tree[i];
			TreeMap[updatedLeaf.elementId] = i;
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

const getLeavesByModelRef = (modelName) =>
	getLeaves().filter((leaf) => leaf.model && leaf.model.getName() === modelName);

const getTemplates = (leaves) => leaves.filter((leaf) => leaf.isTemplate);

const getLeafByBoundIndex = (leaf, key) =>
	getContextTree(leaf).filter(
		(parent) => parent.boundIndex && parent.boundIndex.indexOf(key.replace(boundRe, "")) > -1
	)[0];

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
	Tree,
	TreeMap,
	ParentMap,
	getLeaf,
	getLeaves,
	createLeaf,
	deleteLeaf,
	rake,
	getRecordFor,
	getParentsModel,
	getLeafByBoundIndex,
	getLeavesByModelRef,
	getLeavesByComponentName,
	getContextTree,
	getBindingLeaf,
	getTemplates,
	removeRelated,
	removeLeaf,
	updateOrKill
};
