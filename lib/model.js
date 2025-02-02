import Base from "./loader.js";
import clone from "./clone.js";
import { render, getElement, mapChild, renderDiffs } from "./render";
import {
  Data,
  getReduced,
  matchExpression,
  isDataField,
  updateData,
  deleteData,
  getData,
  getVersionAt,
  getTimestamps,
  rebindValue,
  boundRe,
  quadraticMatchRe,
  canUndo,
  canRedo,
  getVersionableProperties
} from "./store.js";
import { isDifferent, isObject } from "./primitiveops.js";
import { Meta, updateMeta } from "./meta.js";
import { deleteLeaf, getLeavesByModelRef, rake, getRecordFor } from "./tree.js";

const getRandomString = () => (Math.random() * Math.pow(2, 54)).toString(36);

const getListeners = (config) => Object.keys(config).filter((key) => key.indexOf("on") === 0);

/**
 * Retrieves the model bindings for a given field, supporting both single and multiple bindings.
 *
 * @param {string} field - The field or fields (comma-separated) to bind.
 * @param {array} [multiple] - Optional. If provided, it will be used to handle multiple field bindings.
 * @returns {object|array|false} Returns the binding object for a single field, an array of bindings for multiple fields, or false for invalid input.
 */
const getModelBinding = (field, multiple = undefined) =>
  typeof field !== "string"
    ? false
    : ((multiple = field
        .split(",")
        .filter(
          (f) => (
            f == "undefined" ? console.error("[e] Gracefully fail before listener binding", new Error()) : null,
            f !== "undefined"
          )
        )),
      !multiple[1] ? bindToModelFn(field) : multiple.map(bindToModelFn));

/**
 * Binds a function or multiple functions to a model based on the provided field and action.
 *
 * @param {string} field - The field in the format 'Model:Some::action'.
 * @param {object} [model] - The model object (optional).
 * @param {string} [action] - The action to perform on the model (optional).
 * @returns {object|undefined} Returns an object with the function and model if valid, otherwise undefined.
 */
const bindToModelFn = (field, model = undefined, action = undefined) => (
  (field = field.split("::")),
  field[0] === "undefined"
    ? console.error("[e] Binding function is not available, probably missing in configuration", new Error())
    : null,
  (model = new (getModel(field[0]))()),
  (action = field[1]),
  model && action
    ? {
        fn: model.getConfiguration()[action],
        model: model
      }
    : undefined
);

const bindSingleFn = (leaf, modelBinding, e) =>
  modelBinding.fn(
    modelBinding.model,
    getRecordFor(leaf, clone(getData([modelBinding.model.getName()]))),
    e || getElement(leaf.elementId)
  );

/**
 * Binds the model function(s) to the leaf for the given event.
 *
 * @param {object} leaf - The leaf object to bind the model function(s) to.
 * @param {object|array} modelBinding - The model function(s) to bind. Can be a single function or an array of functions.
 * @param {object} e - The event object.
 */
const intermediaryBindFn = (leaf, modelBinding, e) =>
  ((e) =>
    Array.isArray(modelBinding)
      ? modelBinding.map((mb) => bindSingleFn(leaf, mb, e))
      : bindSingleFn(leaf, modelBinding, e))(e);

const bindBoundEvent = (event, leaf, data) => getReduced(matchExpression(event, leaf), data).value;

const bindDataFn = (event, leaf, data) => getReduced(matchExpression(event, leaf), data).value;

// returns bound event in full model format
const bindEventFn = (event, boundEvent, leaf, data) => (
  (event = boundEvent.replace(boundEvent, bindDataFn(boundEvent, leaf, data))), event
);

// returns leaf attributes with functions bound to events
const bindListener = (listener, leaf, attributes, data, event = undefined, boundEvents = [], modelBinding = null) => (
  (event = attributes[listener]),
  (boundEvents = isDataField(event)),
  boundEvents && boundEvents.length
    ? boundEvents
        .map((boundEvent) => bindEventFn(event, boundEvent, leaf, data))
        .map((unboundEvent, index) => (event = event.replace(boundEvents[index], unboundEvent)))
    : null,
  (modelBinding = getModelBinding(event)),
  modelBinding ? (attributes[listener] = intermediaryBindFn.bind(null, leaf, modelBinding)) : null,
  attributes
);

const bindAttributes = (attributes, leaf, data, listeners = []) => (
  (listeners = getListeners(attributes)),
  !listeners.length ? attributes : listeners.map((listener) => bindListener(listener, leaf, attributes, data)).pop()
);

const getModel = (name) => Base.models[name];

const defineModel = (rootMethod, baseName, config) => {
  rootMethod.models[baseName] = function () {
    this.name = baseName.split(":").pop();
    this.configuration = config;

    this.getName = function () {
      var name = this.name;
      return name;
    };

    this.getDataName = function () {
      var name = this.name; //.replace('Model.', '');
      var suffix = "--";
      var dataName = name + suffix;

      return dataName;
    };

    this.metaTransform = function (that, part) {
      if (part.startsWith(that.getName())) {
        let transformed = that.getMetaTransform(part);
        part = Object.values(transformed)[0] ? Object.values(transformed)[0] : part;
      }

      return part;
    };

    this.getMetaTransform = function (metaKey) {
      const metaKeyDeep = metaKey.split(".");
      const name = this.name;
      const keys = Object.keys(Meta);

      let modelMeta = keys
        .filter((m) => m.indexOf(metaKeyDeep[0]) > -1)
        .reduce(
          (acc, target) => ({
            ...acc,
            [target]:
              name +
              "--" +
              Meta[target] +
              (metaKeyDeep.length > 1
                ? "." +
                  metaKeyDeep
                    .slice(1, metaKeyDeep.length)
                    .map((part) => this.metaTransform(this, part))
                    .join(".")
                : "")
          }),
          {}
        );

      return modelMeta;
    };

    this.appendMeta = function (id, meta) {
      var keys = Object.keys(meta);
      var modelName = this.getName();
      var newMeta = {};
      var len = keys.length;
      var i = 0;

      for (; i < len; i++) {
        var key = keys[i];
        var prop = modelName + "--" + key + "|" + id;
        var metaValue = meta[key];

        newMeta[prop] = metaValue;
      }

      updateMeta(newMeta);
    };

    this.travelTo = function (version) {
      const modelName = this.getName();
      const success = setCurrentVersion(modelName, version);

      if (success) {
        const restoredData = getData([modelName], version);
        // Use append instead of update to avoid creating new version
        this.append(restoredData);
        return restoredData;
      }

      return false;
    };

    this.undo = function () {
      const modelName = this.getName();
      if (!canUndo(modelName)) {
        return false;
      }

      // Get properties that can be undone
      const versionableProps = getVersionableProperties(modelName, -1);
      const dataName = this.getDataName();
      const currentData = this.getData(-1);

      // Build the undo state
      const undoState = versionableProps.reduce((acc, key) => {
        const cleanKey = key.replace(dataName, "");

        acc[cleanKey] = currentData[cleanKey];
        return acc;
      }, {});

      // Only apply to properties that can be undone
      return this.append(undoState);
    };

    this.redo = function () {
      const modelName = this.getName();
      if (!canRedo(modelName)) {
        return false;
      }

      // Get properties that can be redone
      const versionableProps = getVersionableProperties(modelName, 1);
      const dataName = this.getDataName();

      // Build the redo state
      const redoState = versionableProps.reduce((acc, key) => {
        const cleanKey = key.replace(dataName, "");
        const nextData = this.getData(1); // Get next version for applicable properties
        acc[cleanKey] = nextData[cleanKey];
        return acc;
      }, {});

      // Only apply to properties that can be redone
      return this.append(redoState);
    };

    this.getVersions = function () {
      const modelName = this.getName();
      const modelKeys = Object.keys(Data).filter((key) => key.startsWith(modelName + "--"));

      if (!modelKeys.length) return [];

      // Get the key with most versions to determine total version count
      const versions = modelKeys.reduce((acc, key) => {
        const keyVersions = Data[key].__marrow_keys.length;
        return keyVersions > acc ? keyVersions : acc;
      }, 0);

      return Array.from({ length: versions }, (_, i) => ({
        version: i,
        isCurrent: i === getCurrentVersion(modelName)
      }));
    };

    this.append = async function (data) {
      const model = this;
      const dataName = this.getDataName();
      const modelName = this.getName();
      const currentData = getData([modelName]);
      const keys = Object.keys(data);
      const clean = [];
      let props = [];
      let toUpdate = {};
      let len = keys.length;
      let i = 0;

      for (; i < len; i++) {
        const key = keys[i];
        const models = key.match(/([A-Z])\w+--/gi, "");

        if (!models || models.length === 1) {
          if (!models || models.indexOf(dataName) > -1) {
            let cleanKey = key.replace(/([A-Z])\w+--/gi, "");
            let prop = dataName + cleanKey;
            let value = data[key];

            if (value !== undefined) {
              // eslint-disable-next-line no-prototype-builtins
              toUpdate[prop] = data.hasOwnProperty(key) ? value : undefined;
              props.push(prop);
              clean.push(cleanKey);
            }
          }
        }
      }

      updateData(toUpdate);
      rake(props, modelName, getData([modelName]), currentData);

      // renderdiffs is a bottleneck for updates
      let hasDiffs = props.filter(
        (prop) =>
          !currentData[prop] || (Array.isArray(currentData[prop]) && toUpdate[prop].length !== currentData[prop].length)
      ).length;

      if (hasDiffs) {
        renderDiffs(modelName);
      }

      let listeners = Object.values(this.constructor.listen || {});

      if (listeners.length) {
        let modelKeys = Object.keys(this.constructor.listen).filter((key) => clean.indexOf(key.split("-")[1]) > -1);

        modelKeys.forEach((prop) => this.constructor.listen[prop] && this.constructor.listen[prop]());
      }

      // was in update
      let floatingLeaves = getLeavesByModelRef(model.name).filter((f) => f.floating);
      let toRender = [];
      len = floatingLeaves.length;
      i = 0;

      for (; i < len; i++) {
        const leaf = floatingLeaves[i];
        const floating = leaf.floating;
        const rebound = rebindValue(floating, leaf);
        const key = rebound.replace(boundRe, "");
        const current = getVersionAt(key, getTimestamps(key));
        const previous = getVersionAt(key, getTimestamps(key, 1));

        if (current && previous && isDifferent(current, previous)) {
          let mappedChild = mapChild(current, leaf.parentLeaf);
          mappedChild.floating = floating;

          if (!toRender.length || (toRender.length && toRender.some((mc) => isDifferent(mc, mappedChild)))) {
            toRender.push(mappedChild);
          }
        }
      }

      toRender.forEach(render);

      return this;
    };

    this.update = async function (data, ...cbs) {
      let currentData = this.getData();

      if (cbs !== undefined && cbs.length) {
        if (currentData.__persisterFns === undefined) {
          data.__persisterFns = {};
        }

        if (data.__persisterFns === undefined) {
          data.__persisterFns = {};
        }

        cbs.forEach((cb) => {
          if (typeof cb === "function") {
            let cbName = `persister_${getRandomString()}`;
            //if (cb.name) {
            // NOTE: endless loops will occur if
            // update method is called from
            // persister fn, this is avoided by
            // using model.append fn
            // data.__persisterFns[cb.name] = cb;
            data.__persisterFns[cbName] = cb;
          }
          // }
        });
      }

      this.append(data);
      if (isObject(currentData.__persisterFns)) {
        // executes persister fns in right order
        const persisterFns = Object.keys(currentData.__persisterFns).map(
          (fnName) => currentData.__persisterFns[fnName]
        );

        const keys = Object.keys(data);
        const diff = keys.filter((key) => isDifferent(data[key], currentData[key]));

        // if date changed since the last time, we can run
        // persister fns
        if (diff.length) {
          Promise.all(
            persisterFns.map(async (fn) => {
              await fn(this);
            })
          );
        }
      }

      return this;
    };

    this.persist = function () {
      const persisterFns = this.getData().__persisterFns;
      Object.keys(persisterFns || {}).forEach(async (persisterFn) => await persisterFns[persisterFn](this));
    };

    this.shouldUnload = () => {
      var data = getData([this.getName()]);
      var keys = Object.keys(data);
      var dataName = this.getDataName();
      var len = keys.length;

      return len && keys.filter((key) => key.match(/([A-Z])\w+--/gi, "")[0] === dataName).length;
    };

    this.unload = function () {
      var data = getData([this.getName()]);
      var keys = Object.keys(data);
      var dataName = this.getDataName();
      var len = keys.length;
      var i = 0;
      let spareData = this.getData();
      let config = this.getConfiguration();

      for (; i < len; i++) {
        var key = keys[i];
        var match = key.match(/([A-Z])\w+--/gi, "");

        if (match[0] && match[0] === dataName) {
          deleteData(key);
        }
      }

      if (config.onunload) {
        config.onunload(spareData);
      }

      getLeavesByModelRef(this.getName()).forEach(deleteLeaf);
    };

    // this.getData = function (at = 0) {
    //   const data = getData([this.getName()], at);
    //   const dataName = this.getDataName();
    //   const dataKeys = Object.keys(data);
    //   let keys = dataKeys.map((key) => key.replace(dataName, ""));

    //   return keys.reduce((acc, key, index) => ((acc[key] = clone(data[dataKeys[index]])), acc), {});
    // };

    this.getData = function (at = 0) {
      const data = getData([this.getName()], at);
      const dataName = this.getDataName();
      const dataKeys = Object.keys(data);
      let keys = dataKeys.map((key) => key.replace(dataName, ""));

      return keys.reduce((acc, key, index) => {
        acc[key] = clone(data[dataKeys[index]]);
        return acc;
      }, {});
    };

    this.getModel = function (modelName) {
      if (modelName) {
        let named = Base.models[modelName];

        if (!named) {
          return undefined;
        }

        var instance = named.getInstance();

        if (!instance) {
          let constructor = getModel(modelName);
          instance = new constructor();
        }

        return instance;
      }

      return this;
    }.bind(this);

    this.getConfiguration = function () {
      return this.configuration.config;
    };

    // Enhance existing update method
    const originalUpdate = this.update;
    this.update = function (data, ...cbs) {
      // Regular update creates new version automatically via updateData
      return originalUpdate.call(this, data, ...cbs);
    };

    // Enhance existing append method
    const originalAppend = this.append;
    this.append = function (data) {
      // Using append for version restoration to avoid creating new versions
      return originalAppend.call(this, data);
    };

    this.getListeners = function () {
      return this.configuration.listen;
    };

    this.intermediaryTrigger = (triggerFn, baseModel, targetModel) =>
      Object.keys(baseModel.getData()).length ? triggerFn(baseModel, targetModel) : null;

    if (!Base.models[baseName].instance) {
      Base.models[baseName].instance = this;

      // assign trigger listeners for other model's props
      // and assign trigger functions
      let targetModel;

      Object.keys(config.listen || {}).forEach(
        (name) => (
          (targetModel = getModel(name)),
          config.listen[name].forEach((propFn) =>
            Object.keys(propFn).forEach(
              (prop) => (
                !targetModel.listen ? (targetModel.listen = {}) : null,
                (targetModel.listen[`${this.name}-${prop}`] = this.intermediaryTrigger.bind(
                  null,
                  propFn[prop],
                  this,
                  targetModel.getInstance()
                ))
              )
            )
          )
        )
      );
    }
  };

  rootMethod.models[baseName].getInstance = function () {
    if (!this.instance) {
      return new rootMethod.models[baseName]();
    }

    return this.instance;
  };
};

export {
  defineModel,
  getModel,
  getModelBinding,
  bindToModelFn,
  bindSingleFn,
  intermediaryBindFn,
  bindBoundEvent,
  bindDataFn,
  bindEventFn,
  bindAttributes
};
