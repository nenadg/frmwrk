import { render } from "./render";
import { getComponent } from "./component";

const distinguish = (name) => {
  const component = getComponent(name);

  if (component) {
    const view = new component();
    const config = view.getConfig();

    if (!config.parent) {
      config.parent = "body";
      console.warn(`[i] undefined parent will render to html body for ${name}.`);
    }

    return render(config);
  }

  return console.warn(`[i] can't distinguish or render ${name}.`);
};

export default distinguish;
