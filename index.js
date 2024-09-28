import clone from "./lib/clone.js";
import hash from "./lib/hash.js";

import { isDifferent } from "./lib/primitiveops.js";
import { define, bundle, getComponentType } from "./lib/define.js";
import { getComponent } from "./lib/component.js";
import { render, onrenderend } from "./lib/render";
import { wait, waitUntil } from "./lib/wait.js";
import { getModel } from "./lib/model";

import { Data } from "./lib/store.js";

window.frmwrk = {
	getComponentType,
	getModel,
	getComponent,
	render,
	define,
	bundle,
	hash,
	clone,
	onrenderend,
	wait,
	waitUntil,
	isDifferent,
	Data
};

export {
	getComponentType,
	getModel,
	getComponent,
	render,
	define,
	bundle,
	hash,
	clone,
	onrenderend,
	wait,
	waitUntil,
	isDifferent,
	Data
};

import SomeComponent from "./livetest";

render(SomeComponent);
