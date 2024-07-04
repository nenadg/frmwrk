import route from "./lib/router.js";
import type from "./lib/type.js";
import clone from "./lib/clone.js";
import hash from "./lib/hash.js";
import fetch from "./lib/fetch.js";
import { isDifferent } from "./lib/primitiveops.js";
import { tree, treeMap, getLeaf } from "./lib/store.js";
import { define, bundle, getComponentType } from "./lib/define.js";
import { getComponent } from "./lib/component.js";
import { render, onrenderend } from "./lib/render";
import { wait, waitUntil } from "./lib/wait.js";
import { getModel } from "./lib/model";

window.frmwrk = {
	getComponentType,
	getModel,
	getComponent,
	render,
	define,
	bundle,
	hash,
	route,
	type,
	clone,
	onrenderend,
	wait,
	waitUntil,
	isDifferent,
	fetch,
	tree,
	treeMap,
	getLeaf
};

export {
	getComponentType,
	getModel,
	getComponent,
	render,
	define,
	bundle,
	hash,
	route,
	type,
	clone,
	onrenderend,
	wait,
	waitUntil,
	isDifferent,
	fetch,
	tree,
	treeMap,
	getLeaf
};
