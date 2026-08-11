"use strict";

const { version } = require("../package.json");

if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  throw new Error(`Invalid Xtension version in package.json: ${version || "<missing>"}`);
}

module.exports = Object.freeze({ version });
