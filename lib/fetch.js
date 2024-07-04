/**
 * Listener function
 * @constructor
 * @param {callback} function - Callback function.
 * @param {event} event - XMLHttpRequest Progress event.
 */
const listener = (callback, event) => callback(event.currentTarget);

/**
 * XMLHttpRequest fetch function
 * @constructor
 * @param {address} string - URL.
 * @param {type} string - Call type ('GET', 'POST', 'PUT', etc.)
 * @param {callback} function - Callback function.
 * @param {body} JSON - JSON body (if call type is 'POST' etc.)
 */
const fetch = (address, type, callback, body) => {
  const req = new XMLHttpRequest();
  req.addEventListener("load", listener.bind(null, callback));
  req.open(type, address);
  if (type === "POST") {
    req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    return req.send(JSON.stringify(body));
  }
  req.send();
};

export default {
  name: "fetch",
  fn: fetch
};
