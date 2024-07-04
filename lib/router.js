import { render } from "./render";
import { getComponent } from "./component";

window.onpopstate = function (event) {
  if (event.state) {
    let state = event.state;
    render(state);
  }
};

const route = (where) => {
  let component = getComponent(where);
  if (component) {
    const View = new component();
    const config = View.getConfig();

    window.history.pushState(where, View.name, View.name);

    render(config);
  }
};

export default route;
