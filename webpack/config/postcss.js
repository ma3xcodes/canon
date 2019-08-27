const appDir = process.cwd(),
      path = require("path");

const appPath = path.join(appDir, "app");

const variables = require("../require-fallback")("style.yml") || {};
const customProperties = {};
for (const key in variables) {
  if ({}.hasOwnProperty.call(variables, key)) {
    customProperties[`${key.startsWith("--") ? "" : "--"}${key}`] = variables[key];
  }
}

module.exports = [
  require("postcss-import")({
    addDependencyTo: process.env.NODE_ENV === "development" ? require("webpack") : undefined,
    path: appPath
  }),
  require("lost")(),
  require("pixrem")(),
  require("postcss-mixins")(),
  require("postcss-each")(),
  require("postcss-for")(),
  require("postcss-custom-properties")({
    importFrom: [
      path.join(__dirname, "variables.css"),
      {customProperties}
    ],
    preserve: false
  }),
  require("postcss-map")({
    maps: [variables]
  }),
  require("postcss-nesting")(),
  require("postcss-conditionals")(),
  require("postcss-preset-env")({
    browserslist: ["> 1%", "last 2 versions"]
  }),
  require("postcss-reporter")({
    filter: msg => msg.type === "warning" || msg.type !== "dependency"
  }),
  require("postcss-color-function")(),
  require("postcss-flexbugs-fixes")()
];
