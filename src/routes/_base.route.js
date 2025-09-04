"use strict";

class BaseRoute {
  constructor(app) {
    this.app = app;
  }

  load() {
    throw new Error("load() method must be implemented by subclass");
  }
}

module.exports = BaseRoute;
