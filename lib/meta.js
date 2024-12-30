import { dataRe } from "./store.js";
import { getContextTree } from "./tree.js";

let Meta = {};

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

export { Meta, updateMeta, replaceMeta, getMetaRoot };
