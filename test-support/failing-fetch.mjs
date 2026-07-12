globalThis.fetch = async () => {
  throw new TypeError("simulated translation network failure");
};
