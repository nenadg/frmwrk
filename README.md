(also available at [frmwrk.lol](https://frmwrk.lol/) in docsify's format)

# frmwrk

> A JavaScript framework emphasizing simplicity by using JavaScript objects for templating and events for data handling.

**frmwrk** aims to provide a lightweight and efficient interface for creating dynamic websites and applications. By blending simplicity with maintainability, it offers a robust solution for modern web development.

```javascript
import { render } from "@nenadg/frmwrk";

render({
  div: {
    innerText: "hello world",
  },
});
```

---

## Table of Contents

1. <a href="#/?id=introduction">Introduction</a>
2. <a href="#/?id=core-features">Core Features</a>
3. <a href="#/?id=getting-started">Getting Started</a>
4. <a href="#/?id=components-and-models">Components and Models</a>
5. <a href="#/?id=template-notation">Template Notation</a>
6. <a href="#/?id=event-handling">Event Handling</a>
7. <a href="#/?id=advanced-feature">Advanced Features</a>
8. <a href="#/?id=general-state-management">General state management</a>
9. <a href="#/?id=api-reference">API Reference</a>

---

## Introduction

**frmwrk** is a minimalist JavaScript framework designed for building dynamic web applications. Its focus on performance and simplicity makes it ideal for projects ranging from small websites to complex applications.

## Core Features

- **Lightweight**: Minimalistic, ensuring fast load times and execution.
- **Component-Based**: Build reusable, stateful UI components.
- **Reactive Data Binding**: Keeps UI synchronized with application state.
- **Modularity**: Easy integration with custom components and models.
- **Dynamic Component Placement**: Fine-grained control over DOM.

---

## Getting Started

### Installation

Install frmwrk with Webpack for a basic setup:

```bash
npm install --save @nenadg/frmwrk webpack webpack-cli webpack-dev-server
```

Basic Project Structure

```plaintext
frmwrk.hello/
├── src/
│   └── index.js
├── public/
│   └── index.html
├── package.json
```

### Configuration

Update `package.json` to use Webpack's development server:

```json
"scripts": {
  "start": "webpack-dev-server --mode development --progress"
}
```

### Hello World Example

#### index.js

```javascript
import { render } from "@nenadg/frmwrk";

render({
  div: {
    innerText: "hello world",
  },
});
```

#### index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>frmwrk Example</title>
  </head>
  <body>
    <script src="main.js"></script>
  </body>
</html>
```

Run the example using:

```bash
npm start
```

---

## Components and Models

Components and Models are the primary building blocks in frmwrk. Both are JS objects containing `name`, `type` and `config` properties. Components are used to express your HTML, while models are used to express your driving logic using event listeners.

### Components

Components define the HTML structure as JavaScript objects.

#### Example: Basic component

```javascript
const HelloComponent = {
  type: "component",
  name: "Hello",
  config: {
    div: {
      innerText: "I'm a component",
    },
  },
};
export default HelloComponent;
```

### Models

Models manage state and handle events for components.

#### Example: Basic model

```javascript
const HelloModel = {
  type: "model",
  name: "Hello",
  config: {
    oninitelement: (model) => model.update({ text: "My first component" }),
  },
};
export default HelloModel;
```

#### Using Models with Components

```javascript
const HelloComponent = {
  type: "component",
  name: "Hello",
  config: {
    div: {
      model: "Hello",
      oninitelement: "Hello::oninitelement",
      innerText: "{*:text}",
    },
  },
};
```

---

## Template Notation

frmwrk binds data to the DOM using:

- **Direct Matching**: `{*:property}` binds directly to a model property.
- **Linear Matching**: Loops through arrays with `@{*:array}`.
- **Cross Matching**: Handles nested loops for complex data binding.

frmwrk also binds events using:

- **Direct event assignment**: `Model::Event` binds `Event` to the `Model` (eg. `onclick: 'Model::OnClick`). Can bind multiple events this way (eg. `onclick: "Model::OnClick,Model::OnAnotherEvent"`)
- **Data-bound event assignment**: Events are bind as Direct matched data `{*:onClick}`

frmwrk can also load components based on data it has:

- **Floating components**: Components can be expressed using direct match expression as `{*:someComponent}` that will change based on it's state in the model.

frmwrk has built-in mechanism that allows reusability expressed through `meta` concept.

### Direct Matching

Direct matching is the simplest way to bind a single property from the model to an element's attribute or content. For instance, to bind a `text` property:

Model:

```javascript
const DirectModel = {
  type: "model",
  name: "DirectExample",
  config: {
    oninitelement: (model) => model.update({ text: "Hello, World!" }),
  },
};
```

Component:

```javascript
const DirectComponent = {
  type: "component",
  name: "DirectExample",
  config: {
    div: {
      innerText: "{*:text}",
    },
  },
};
```

This will render a `<div>` with the text "Hello, World!".

### Linear Matching

Linear matching allows you to iterate over an array in the model and render elements for each item.

Model:

```javascript
const LinearModel = {
  type: "model",
  name: "LinearExample",
  config: {
    oninitelement: (model) =>
      model.update({
        todos: [{ text: "Buy groceries" }, { text: "Walk the dog" }],
      }),
  },
};
```

Component:

```javascript
const LinearComponent = {
  type: "component",
  name: "LinearExample",
  config: {
    ul: {
      children: [
        {
          "@{*:todos}": {
            li: {
              innerText: "{*:todos[*:todos.text]}",
            },
          },
        },
      ],
    },
  },
};
```

This will render:

```html
<ul>
  <li>Buy groceries</li>
  <li>Walk the dog</li>
</ul>
```

### Cross Matching

Cross matching enables rendering elements by correlating data from multiple arrays.

Basic Project Structure

```plaintext
frmwrk.table/
├── src/
│   └── index.js
│   └───Table/
│   └──────table.model.js
│   └──────table.header.row.js
│   └──────table.header.js
│   └──────table.body.row
│   └──────table.js
├── public/
│   └── index.html
├── package.json
```

Model:

```javascript
// table.model.js
const TableModel = {
  name: "Table",
  type: "model",
  config: {
    oninitelement: async (model) => {
      model.update({
        header: [
          {
            header_text: 'Todo name',
            index: 'name'
          },
          {
            header_text: 'Due date',
            index: 'due_date'
          },
          {
            header_text: 'Status',
            index: 'completed'
          }
          ...
        ],
        todos: [
          {
            name: 'Buy groceries',
            due_date: '01/02/2025',
            completed: 'not-completed',
          },
          {
            name: 'Sell crypto',
            due_date: '02/02/2025',
            completed: 'not-completed'
          },
          ...
        ]
      })
    }
  }
};

export default TableModel;

```

Components:

```javascript
// table.header.row.js
const TableHeaderRow = {
  name: "TableHeaderRow",
  type: "component",
  config: {
    tr: {
      children: [
        {
          "@{*:header}": {
            th: {
              innerText: "{*:header[*:header.header_text}",
            },
          },
        },
      ],
    },
  },
};

export default TableHeaderRow;
```

```javascript
// table.header.js
import TableHeaderRow from "./table.header.row.js";

const TableHeader = {
  name: "TableHeader",
  type: "component",
  config: {
    thead: {
      children: [TableHeaderRow],
    },
  },
};

export default TableHeader;
```

```javascript
// table.body.row.js
const TableBodyRow = {
  name: "TableBodyRow",
  type: "component",
  config: {
    tr: {
      children: [
        {
          "@{*:header}": {
            td: {
              innerHTML: "{*:todos.?[*:header.index]}",
            },
          },
        },
      ],
    },
  },
};

export default TableBodyRow;
```

```javascript
// table.body.js
import TableBodyRow from "./table.body.row.js";

const TableBody = {
  name: "TableBody",
  type: "component",
  config: {
    tbody: {
      model: "Table",
      oninitelement: "Table::oninitelement",
      children: [
        {
          "@{*:todos}": "TableBodyRow",
        },
      ],
    },
  },
};

export default TableBody;
```

```javascript
// table.js
import { bundle } from "@nenadg/frmwrk";
import TableModel from "./table.model.js";
import TableHeader from "./table.header.js";
import TableBody from "./table.body.js";

const Table = {
  name: "Table",
  type: "component",
  config: {
    table: {
      model: "Table",
      oninitelement: "Table::oninitelement",
      children: [
        TableHeader,
        TableBody,
        //, TableFooter
      ],
    },
  },
};

bundle([TableModel]);

export default Table;
```

```javascript
// index.js
import { render } from "@nenadg/frmwrk";
import Table from "./Table/table.js";

render(Table);
```

This will render:

```html
<table>
  <thead>
    <tr>
      <th>Task</th>
      <th>Due date</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Buy groceries</td>
      <td>01/02/2025</td>
      <td>Pending</td>
    </tr>
    <tr>
      <td>Walk the dog</td>
      <td>02/02/2025</td>
      <td>Completed</td>
    </tr>
  </tbody>
</table>
```

### Direct event assingment

To assign an event to the template logic, we need to give it a proper name containing the name of the model that handles such an event, and the name of event, joined together like this `Model::Event`.
To follow this example, we are going to add sorting to our todos HTML table. Let's modify the `TableHeaderRow` component by adding event to the header click action:

```javascript
// table.header.row.js
const TableHeaderRow = {
  name: "TableHeaderRow",
  type: "component",
  config: {
    tr: {
      children: [
        {
          "@{*:header}": {
            th: {
              innerText: "{*:header[*:header.header_text}",
              onclick: "Table::OnSort",
            },
          },
        },
      ],
    },
  },
};

export default TableHeaderRow;
```

Template was extended by adding `onclick: "Table::OnSort"`, now we have to add that event to our model configuration:

```javascript
// table.model.js
const TableModel = {
  name: "Table",
  type: "model",
  config: {
    oninitelement: async (model) => {
      ...
    },
    OnSort: async (model, state, e) => {
      // this event fires when header row is clicked
      ...
    }
  }
};

export default TableModel;
```

Every event, direct or bound have the same interface that we are going to cover in <a href="#/?id=event-handling">Event handling</a> section of this documentation.

### Data-bound event assignment

Events can be assigned directly using `Model::Event` notation, or assigned as a value to be bound to the current model configuration as `{*:someEvent}`.
To have an event that can change over time and model configuration we are simply going to treat it as any value and change our template configuration to handle it like that:

```javascript
const TableHeaderRow = {
  name: "TableHeaderRow",
  type: "component",
  config: {
    tr: {
      children: [
        {
          "@{*:header}": {
            th: {
              innerText: "{*:header[*:header.header_text}",
              onclick: "{*:onHeaderClick}",
            },
          },
        },
      ],
    },
  },
};
```

Now we can set what it does in our model:

```javascript
// table.model.js
const TableModel = {
  name: "Table",
  type: "model",
  config: {
    oninitelement: async (model) => {
      model.update({
        header: [ ... ],
        todos: [ ... ],
        onHeaderClick: "Table::OnSort"
      })
    },
    OnSort: async (model, state, e) => {
      // let's not fire this event but 'OnSomethingElse'
      model.update({onHeaderClick: "Table::OnSomethingElse"});
    },
    OnSomethingElse: async (model, state, e) => {
      // this event is fired after the 'OnSort' has changed it
    },
  }
};

export default TableModel;

```

### Floating components

Let's say that we are not going to display todo list all the time, and we need to show some other screens too. For example, we are going to display a landing page before one can enter todo list.

```javascript
{
  ul: {
   className: 'todo-list',
   children: [
      '{*:landingOrTodo}'
    ]
  }
}
```

and then set the initial state of todo's model to show bundled component:

```javascript
{
    oninitelement: (model) => model.update({ ... landingOrTodo: 'Landing', ... }),
}

```

and later changing it at some point:

```javascript
{
    onclick: (model) => model.update({ ... landingOrTodo: 'Todo', ... }),
}

```

This will render separate views, based solely on the template (component) and model configuration.

### _meta_ property

The concept of using `meta` property is to facilitate component reuse in frmwrk. It enhances modularity and flexibility by allowing the same component configuration to be used across different contexts with different models. Here's a breakdown of how this works and why it's beneficial:

_Purpose:_ The meta property acts as a bridge between a component's configuration and different data models. It maps component properties to different model properties, allowing the same component to adapt to various data contexts without rewriting the component logic or structure.\
_Functionality:_ By specifying meta in a component's configuration, you can redefine which model properties should be bound to the component's properties. This is particularly useful when you want to use the same component structure with different data sources.

Example

We are going to reuse our `Table` component in different data context (using different model):

```javascript
let SomeOtherModel = {
  type: "model",
  name: "SomeOtherModel",
  config: {
    oninitelement: (model, state, e) => {
      model.update({
        otherHeader: [
          /* different data */
        ],
        otherTodos: [
          /* different data */
        ],
        onOtherHeaderClick: "SomeOtherModel::OnSort",
      });
    },
  },
};
```

while our `Table` is going to be reconfigured to use `meta` property to translate original context to some new:

```javascript
import Table from "./Table/table.js";

render({
  Table: {
    model: "SomeOtherModel",
    oninitelement: "SomeOtherModel::oninitelement",
    meta: {
      header: "otherHeader",
      todos: "otherTodos",
      onHeaderClick: "onOtherHeaderClick",
    },
  },
});
```

In this setup:

_meta Mapping:_ The meta property maps the `header`, `todos` and `onHeaderClick` from Table to `otherHeader`, `otherTodos` and `onOtherHeaderClick` of SomeOtherModel. This mapping tells the framework to bind these new model properties to the existing component properties when rendering.\
_Flexibility:_ The component remains the same, but the data it displays is dynamically sourced from SomeOtherModel thanks to the meta property.

### _parent_ property

Incorporating the parent property within a frmwrk component configuration provides an efficient way to specify exactly where in the DOM the component should be rendered. This allows for more precise control over the UI and helps integrate frmwrk components smoothly into existing web applications or pages with specific layout requirements.

```javascript
export const App = {
  type: "component",
  name: "App",
  config: {
    div: {
      className: "app-container",
      parent: "#app", // Specifies the ID of the DOM element where the component should render
      children: [TodoComponent, TodoCounterComponent],
    },
  },
};
```

### _implicit_ property

Models propagate their data in a top-down manner. This means that every component that has `model: "SomeModel"` assigned to a parent component will inherit it's data context. This can be overriden using `implicit` property.

```javascript
const HelloComponent = {
  type: "component",
  name: "Hello",
  config: {
    div: {
      model: "Hello",
      oninitelement: "Hello::oninitelement",
      children: [
        {
          p: {
            innerText: "{*:text}",
          },
        },
        {
          p: {
            model: "SomeOtherModel",
            implicit: true,
            innerText: "{*:someOtherText}",
          },
        },
      ],
    },
  },
};
```

Using `implicit` keyword while assigning different model will have the `{*:someOtherModel}` source it's value from that other model instead of the one configured upstream.

### _position_ property

frmwrk handles positioning of the elements out of the box without the need to provide keys, indexes or things like that. HTML elements will appear in the order they are expressed in the template, while looping elements will appear in the order they are assigned in their respective arrays in model's configuration. The position property in frmwrk is a helpful attribute that provides precise control over the placement of components within their parent container in the DOM adding to flexibility.

```javascript
export const App = {
  type: "component",
  name: "App",
  config: {
    div: {
      className: "app-container",
      parent: "#app", // Parent container's ID
      children: [
        {
          div: {
            className: "header",
            innerText: "Application Header",
            position: 0, // Ensures this is always the first element
          },
        },
        TodoComponent,
        TodoCounterComponent,
        {
          div: {
            className: "footer",
            innerText: "Application Footer",
            position: 3, // Ensures this is always the last element, assuming there are 4 elements total
          },
        },
      ],
    },
  },
};
```

### _data-alive_ property

The `data-alive` property allows components to be conditionally rendered based on a specific state. This feature is akin to conditional rendering in other frameworks but directly influences the DOM
presence of the element.

**Usage**: When `{*:isSomePropertyAlive}` evaluates to false, the corresponding element is not just hidden but removed from the DOM. When it evaluated to true, element will be rendered back to it's place. This can be beneficial for performance, especially in applications with potentially many dynamic elements, as it reduces the load on the browser's rendering engine.

```javascript
{
  div: {
    'data-alive': '{*:isVisible}',
    className: 'dynamic-content',
    innerText: 'This content is conditionally rendered.'
  }
}
```

### _data-\*_ attribute as a property

frmwrk employs HTML native _data-\*_ attribute to store additional state data if needed. As in the example with _data-alive_ property, similarly you can assign _data-whatever_ if you want it's value to be represented in the state argument for event handling.

```javascript
{
  button: {
    'data-alive': '{*:isVisible}',
    'data-whatever': '{*:whatever}',
    onclick: "Model::OnClick",
    textContent: 'Get 2 state values'
  }
}
```

```javascript
OnClick: (model, state) => {
  // in this example 'state' argument will provide an array of
  // two state objects directly assigned to the template,
  // { prop: 'isVisible', value: true, set: { isVisible: true, whatever: 'something' }}
  // { prop: 'whatever', value: 'something', set: { isVisible: true, whatever: 'something' }}
  // we are going to use 'index' which is the second member of this array as defined in the template
  ...
};
```

---

## Event Handling

Events in frmwrk pass three arguments:

1. **model**: The instance of the model where the event is being handled.
2. **state**: Snapshot of the current element’s data.
3. **event**: The native event object.

**state** provides array of elements state objects containing these properties:

1. **prop**: The name of the property in the model's data collection.
2. **value**: The value of the property.
3. **set**: A larger data context to which the property belongs.

### Example: Sorting a Table

Extend the `table.header.row.js`:

```javascript
{
  th: {
    innerText: "{*:header[*:header.header_text}",
    "data-prop": "{*:header[*:header.index}",
    onclick: "Table::OnSort",
  },
}
```

```javascript
OnSort: (model, state) => {
  // in this example 'state' argument will provide an array of
  // two state objects directly assigned to the template,
  // { prop: 'header_text', value: 'Todo name', set: { header_text: 'Todo name', index: 'name' }}
  // { prop: 'index', value: 'name', set: { header_text: 'Todo name', index: 'name' }}
  // we are going to use 'index' which is the second member of this array as defined in the template
  let prop = state[1].value;

  // get the initial data set in 'oninitelement'
  let data = model.getData(true);
  let todos = data.todos;

  model.update({
    todos: todos.sort((a, b) =>
      b[prop].toLowerCase().localeCompare(a[prop].toLowerCase()),
    ),
  });
};
```

Let's dive deeper into some concepts shown in the example above.

### model, state, event trio

The intricacies of the (model, state, event) trio in frmwrk, play a crucial role in managing component behavior and interactions. Here's a deeper dive into how each part of this trio works and interacts within the framework:

#### model

Represents the data model assigned to a specific component. It acts as the central management point for the data related to that component.

**Data Handling**: The model is responsible for storing, updating, and retrieving the component's data. It supports operations like `model.update(...)`, `model.append(...)`, `model.unload()`, and `model.persist()`.\
**Event Initiation**: Initializes the component's state using the `oninitelement` event, setting up the initial data state when a component is rendered.\
**Data Retrieval**: Offers methods like model.getData(true) for fetching the initial state and model.getData(-N) for accessing historical states, facilitating undo-like features or debugging.

#### state

Represents the current snapshot of data related to the component at the moment an event is handled. It facilitates direct interaction with the data relevant to a particular event.

**Data Snapshot**: Provides a snapshot of the data at the time of the event, allowing the event handler to access and modify relevant data based on user interactions.\
**Data Structure**: The state is typically an array of objects, each containing properties like prop (property name), value (current value), and set (a larger data set to which the property belongs). This structure helps in pinpointing the exact data affected by an event.\
**Complex Data Handling**: In scenarios where set is complex, it can map to an object or an array, providing a deeper level of interaction with the data structure.

#### event

Represents the browser-generated event (like click, input, etc.) that triggers the model and state functions.

**Interaction Handling**: Captures user interactions and triggers the associated event handlers in the model.\
**Default Behavior**: Can be used within the framework to prevent default actions (like form submission) or to stop propagation, offering more control over the event lifecycle.\
**Customization**: Developers can define custom events within the framework to handle more specific behaviors tailored to their application needs.

#### Interactions Among Trio

**Event Driven**: When an event occurs, it triggers an event handler that uses the model and state to respond appropriately. For example, a click event on a button might use the state to check which button was clicked and the model to update the data accordingly.\
**Data Flow**: The model updates influence what is stored in the state, and the state provides the context for what the event is acting upon. This interplay allows for a dynamic yet controlled data flow within components.\
**Lifecycle Management**: The lifecycle events like `oninitelement` and `onunload` help in managing the setup and teardown of components, ensuring data consistency and component integrity throughout the application lifecycle.

Understanding and utilizing the (model, state, event) trio effectively allows for sophisticated component and data management in frmwrk, making it a powerful tool for building interactive and responsive web applications.

---

## Advanced Features

### Lazy loading

Using async/await for lazy loading of event logic in frmwrk is an innovative approach that enhances the efficiency and scalability of applications. This technique allows for components to be lighter and more responsive by only loading the code necessary for specific interactions when those interactions occur. Here’s an in-depth look at this concept:

**Lazy Loading**: The essence of lazy loading in this context is to defer the loading of event handlers until they are actually needed. This is particularly useful for large applications with many features that may not be immediately required on the initial load.\
**Async/Await**: Using async/await with dynamic imports (import()) allows you to fetch the event handlers asynchronously from separate files only when the related events are triggered.

#### Example: lazy loading events using async/await

In example, `SomeModelWithLazyEvents` is defined with several asynchronous actions that are loaded only when invoked. Here’s how it works:

Model Configuration

```javascript
let SomeModelWithLazyEvents = {
  type: "model",
  name: "SomeModelWithLazyEvents",
  config: {
    oninitelement: (...) => { ... },

    SomeAction: async (model, state, e) =>
      await import('./Events/SomeAction.js')
        .then(module => module.default(model, state, e))
        .catch(e => console.log('[e] can\'t load SomeAction.', e)),

    SomeOtherAction: async (model, state, e) =>
      await import('./Events/SomeOtherAction.js')
        .then(module => module.default(model, state, e))
        .catch(e => console.log('[e] can\'t load SomeOtherAction.', e))
  }
};
```

**Dynamic Import**: Event handlers like SomeAction and SomeOtherAction are loaded dynamically using import(). This import is triggered only when the event occurs.\
**Handling Failures**: The .catch() method ensures that any issues during the load (such as network errors) are gracefully handled, preventing the application from breaking.

External Event Handler File

```javascript
/* ./Events/SomeAction.js */
export default async (model, state, event) => {
  // Event-specific logic here
};
```

**Separation of Concerns**: By moving the event logic to separate files, you not only reduce the initial load size but also organize your code better, making it easier to manage and update.

Benefits

_Performance:_ Improves initial load time by reducing the size of the initial JavaScript bundle.\
_Scalability:_ Makes it easier to scale applications by adding more features without bogging down the initial load.\
_Maintainability:_ Helps keep the codebase more organized and manageable by separating event logic into different files.

Considerations

_Network Dependence:_ Relies on the user's network speed and reliability since event logic needs to be fetched in real-time. Good error handling and fallback mechanisms are crucial.\
_Caching:_ Proper caching strategies should be implemented to avoid re-fetching the same code repeatedly.

This lazy loading technique is a sophisticated use of modern JavaScript features that can significantly enhance the user experience and efficiency of applications built with frmwrk.

### Persisters

Persisters in frmwrk are an advanced feature designed to enable actions to be automatically performed after model data updates. This mechanism adds a layer of functionality that can enhance data handling by executing custom logic every time the model is updated. Here's a detailed breakdown of how persisters work and how they can be effectively used:

**Purpose**: Persisters serve as hooks or middleware that are triggered after the model.update(...) function has successfully updated the model's state. This allows for additional operations to be performed in a controlled manner.\
**Usage**: Persisters are specified as additional arguments to the model.update(...) function, which means they are flexible and can be customized per update operation.

#### Example: assigning persisters

```javascript
// Define persisters
let persister1 = (model) => {
  // Logic that needs to be executed after the model is updated
};

let persister2 = (model) => {
  // Another set of operations post-update
};

// Usage in model.update
model.update(
  {
    key: "value",
  },
  persister1,
  persister2,
);
```

**Serial Execution**: Persisters are executed one after the other in the order they are passed to `model.update(...)`. This ensures a predictable execution flow and helps manage dependencies between operations.\
**Argument Passing**: Each persister function receives the model as its only argument, giving it access to the updated state and the ability to perform further actions based on that state.

#### Safe Data Manipulation

**Avoiding Infinite Loops**: It's crucial to avoid calling `model.update(...)` from within a persister because it would trigger the persisters again, potentially creating infinite loops. Instead, `model.append(...)` is used for making further updates from within a persister. This function behaves like `model.update(...)` but without triggering additional persister executions.

Benefits

_Automation:_ Automates related tasks that need to occur right after a data update, such as logging, validation, or syncing with external systems.\
_Consistency:_ Ensures that all subsequent actions dependent on the updated state are consistently executed.\
_Flexibility:_ Provides the ability to tailor post-update behaviors specific to different update scenarios by selectively attaching different persisters.

Considerations

_Performance:_ Although useful, adding many complex persisters can impact performance due to additional processing after each update. It's important to ensure that persisters are as efficient as possible.\
_Complexity:_ The use of persisters increases the complexity of the data update mechanism. Proper documentation and understanding of their flow are essential to prevent hard-to-trace bugs.

Persisters are a powerful tool within frmwrk that can significantly enhance the capability to manage side effects and additional operations tied to model state changes. This feature promotes cleaner and more organized code by segregating primary update logic from post-update operations.

### Model listeners

Model listeners in frmwrk provide a powerful mechanism for cross-model communication, allowing models to react to changes in other models. This feature facilitates a more reactive architecture where components and models can stay synchronized with each other's state changes. Here’s how this feature is structured and its implications:

**Purpose**: Listeners are designed to enable a model to react to changes in another model's properties. This is akin to a publish-subscribe pattern where a model subscribes to changes in another model and executes specified logic in response.\
**Structure**: Listeners are defined within a listen object in the model's configuration. This object maps models by their names and specifies arrays of properties to listen to, along with associated callback functions.

#### Example: model listener

```javascript
{
  config: {
    // Configuration for the model itself
  },
  listen: {
    SomeModel: [
      {
        headerTitleText: async (model, someModel) => {
          // Logic to execute when 'headerTitleText' in 'SomeModel' changes
        }
      }
    ]
  }
}
```

_Model-to-Model Binding:_ In this example, the model is set up to listen to changes in the `headerTitleText` property of `SomeModel`. Whenever `headerTitleText` is updated, the specified asynchronous function is triggered.\
_Callback Function Parameters:_ \
_model:_ The model that owns the listener.\
_someModel:_ The model being listened to, in this case, `SomeModel`.

Benefits

_Reactivity:_ Enhances the reactivity of the application by allowing models to respond to changes in other parts of the application, ensuring data consistency across components.\
_Decoupling:_ Helps decouple components by allowing them to react to changes without needing to directly invoke methods on other models, which can simplify dependencies and interactions.\
_Flexibility:_ Provides flexibility in handling complex interdependencies between models, useful in scenarios where changes in one part of the application need to reflect in another without tightly coupling their implementations.

Use Cases

_Synchronized Updates:_ Useful in dashboard-like interfaces where changes in one widget need to reflect in another.\
_Conditional Logic:_ Executes specific logic conditionally based on changes in another model, such as enabling or disabling form inputs based on the state of other components.\
_Data Validation:_ Validates or transforms data in one model when another model changes, ensuring data integrity across the system.

Considerations

_Performance Implications:_ Care must be taken to ensure that listeners do not lead to performance bottlenecks, especially in cases where many models are interlinked and updates are frequent.\
_Complexity in Debugging:_ Debugging can become more complex due to the indirect nature of interactions initiated by listeners. It's important to maintain clear documentation and possibly implement debugging aids to trace interactions.

Model listeners add a significant layer of interactivity and reactivity within frmwrk, aligning it with more complex application architectures that require dynamic interactions across different components.

---

## General state management

### Data management

frmwrk employs a highly structured approach to state management, where each model's properties are stored independently with their own version history. This approach enhances the ability to track changes over time and provides an efficient mechanism for retrieving current and past states.

**Store Structure**: The state is stored as a large object (called `Data`) where each key corresponds to a model-property combination (e.g., `SomeModel--headerTitleText`). Each key maps to an object where each property version is stored.

**Versioning and Immutability**:

_Immutability_: When data is updated via `model.update(...)`, a new version of the data is created in the state store, preserving the previous versions. This ensures that the state objects are immutable, preventing unintended side effects from changes.\
_Retrieving Data_: Using `model.getData()` retrieves the clone of the latest snapshot of the model’s data. However, because of the versioning, it’s possible to access previous states, making debugging and data tracking more manageable.\
_Performance_: This method of storing data ensures quick access to any model’s current and historical data without needing to traverse a complex nested structure. Each property is indexed and retrieved independently, which can significantly speed up lookups in applications with heavy state manipulation.

```javascript
let originalSnapshot = mode.getData(true); // Retrieves initial state
let stateSnapshot = model.getData(); // Retrieves current state
let historicalState = model.getData(-1); // Retrieves one version back
```

### DOM management

frmwrk's rendering logic works by creating internal state representing a DOM tree. Such tree (called `Tree`) is nothing more than a list of all DOM nodes containing objects called `leaves`. Individual `leaf` carries it's own information about it's current (and previous) state, HTML representation, model to which it belongs (if any) and position in the DOM throughout it's lifecycle. Data stored in central store called `Data` is used for referencing and versioning with the individual states each `leaf` maintains for itself.

---

## API Reference

Here's the API reference what frmwrk exposes and where.

### Native Functions

These are native functions that are exposed and available for import {...} from '@nenadg/frmwrk'

- `getModel(modelName)`: Retrieves a model's configuration by its name.
- `getModel('ModelState').getInstance()` - returns the instance of current model, providing the interface to the model's context outside an event.
- `render(config)`: Renders a component based on the given configuration.
- `define(config)`: Defines or extends a component.
- `bundle([configs])`: Same as define but array.
- `clone(object)`: Creates an immutable clone of a given object.
- `onrenderend()`: Event triggered when the rendering cycle is complete.
- `waitUntil(asyncFunction, ms)`: Pauses execution until the asynchronous function resolves or the timeout expires.
- `wait(ms)`: Pauses execution for the specified duration in milliseconds.

### Lifecycle Events

- **oninitelement**: Triggered before rendering, used to initialize the model's data.

  Example:

  ```javascript
  function initializeComponent(model, state, event) {
    model.update({ initialData: "value" });
  }
  ```

- **onunload**: Fires when `model.unload()` completes, allowing cleanup or additional logic.

  Example:

  ```javascript
  function cleanupComponent(lastDataState) {
    console.log("Cleanup with data:", lastDataState);
  }
  ```

### Model API Functions

- `model.getData(true | -N)`: Fetches either the original dataset (`true`) or the dataset N updates prior (`-N`).
- `model.update(data, ...persisters)`: Updates the dataset and optionally triggers persisters.
- `model.append(data)`: Adds data without triggering persisters.
- `model.unload()`: Clears the model's data and triggers the `onunload` event.
- `model.persist()`: Manually triggers persisters without modifying the dataset.

This comprehensive API allows developers to manage components and their data with precision and flexibility.
