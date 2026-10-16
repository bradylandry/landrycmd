/* Overlay the shared packet dash on an existing SVG link. */
(function (global) {
  var NS = "http://www.w3.org/2000/svg";

  function overlay(path, parent) {
    var flow = document.createElementNS(NS, "path");
    flow.setAttribute("class", "flow");
    flow.setAttribute("d", path.getAttribute("d") || "");
    (parent || path.parentNode).appendChild(flow);
    return flow;
  }

  function set(flow, on) {
    if (!flow) return;
    flow.setAttribute("class", on ? "flow on" : "flow");
  }

  global.labWire = { overlay: overlay, set: set };
})(window);
