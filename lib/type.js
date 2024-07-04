const type = value => Object.prototype.toString.call(value)
  .match(/([A-Z])\w+/g)[0];

export default type;
