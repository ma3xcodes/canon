module.exports = {
  colorScale: {
    key: "colorScale",
    display: "Color scale",
    format: "Accessor",
    required: true
  },
  columns: {
    key: "columns",
    display: "Columns",
    format: "Checkbox",
    required: true
  },
  groupBy: {
    key: "groupBy",
    display: "Grouping",
    format: "Accessor",
    required: true,
    typeof: "id"
  },
  label: {
    key: "label",
    display: "Label",
    format: "Accessor",
    required: true
  },
  html: {
    key: "html",
    display: "HTML",
    format: "Input",
    required: true
  },
  imageURL: {
    key: "imageURL",
    display: "Image URL",
    format: "Input",
    required: true
  },
  size: {
    key: "size",
    display: "Size",
    format: "Accessor",
    required: false
  },
  subtitle: {
    key: "subtitle",
    display: "Subtitle",
    format: "Accessor",
    required: true
  },
  sum: {
    key: "sum",
    display: "Sum",
    format: "Accessor",
    required: true,
    typeof: "number",
    tooltip: true
  },
  topojson: {
    key: "topojson",
    display: "TopoJSON URL",
    format: "Input",
    required: true
  },
  value: {
    key: "value",
    display: "Value",
    format: "Accessor",
    required: true,
    typeof: "number",
    tooltip: true
  },
  x: {
    key: "x",
    display: "X-axis",
    format: "Accessor",
    required: true,
    tooltip: true
  },
  xConfigTitle: {
    key: "xConfig.title",
    display: "X-axis label",
    format: "Input",
    required: false
  },
  y: {
    key: "y",
    display: "Y-axis",
    format: "Accessor",
    required: true,
    tooltip: true
  },
  yConfigTitle: {
    key: "yConfig.title",
    display: "Y-axis label",
    format: "Input",
    required: false
  }
};
