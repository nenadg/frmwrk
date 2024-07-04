const wait = (ms, interval) =>
  new Promise((resolve) => (interval = setTimeout(() => (clearInterval(interval), resolve(true)), ms)));

const waitUntil = (conditionFn, ms = 1000, interval) =>
  typeof conditionFn !== "function"
    ? false
    : new Promise(
        (resolve, reject) =>
          (interval = setInterval(
            () => (
              conditionFn()
                ? (clearInterval(interval), resolve(conditionFn()))
                : ms <= 0
                  ? (clearInterval(interval), reject(false))
                  : null,
              ms--
            ),
            1
          ))
      );

export { wait, waitUntil };
