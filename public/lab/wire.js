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

  function icon(d) {
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(NS, "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("d", d);
    svg.appendChild(path);
    return svg;
  }

  function nativeFullscreen(doc) {
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }

  function sync(button, on) {
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
    var label = button.querySelector(".lab-fs-label");
    if (label) label.textContent = on ? "Exit" : "Full screen";
  }

  function fallback(view, button) {
    view.classList.add("is-fs");
    view.ownerDocument.body.classList.add("lab-fs-open");
    sync(button, true);
  }

  function exitFallback(view) {
    view.classList.remove("is-fs");
    view.ownerDocument.body.classList.remove("lab-fs-open");
  }

  function toggle(button) {
    var view = button.closest(".view");
    if (!view) return;
    var doc = view.ownerDocument;
    var native = nativeFullscreen(doc);
    if (native === view || view.classList.contains("is-fs")) {
      exitFallback(view);
      var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (native && exit) {
        try {
          exit.call(doc);
        } catch (err) {
          /* The browser already left fullscreen. */
        }
      }
      sync(button, nativeFullscreen(doc) === view);
      return;
    }
    var req = view.requestFullscreen || view.webkitRequestFullscreen;
    if (typeof req === "function") {
      try {
        var pending = req.call(view);
        if (pending && typeof pending.then === "function") {
          pending.then(
            function () {
              exitFallback(view);
              sync(button, true);
            },
            function () {
              fallback(view, button);
            },
          );
          return;
        }
        sync(button, true);
        return;
      } catch (err) {
        /* Fullscreen is blocked in this frame. Use the in-page fill. */
      }
    }
    fallback(view, button);
  }

  function mountFullscreen(doc) {
    var views = doc.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      var view = views[i];
      if (view.querySelector(".lab-fs")) continue;
      var button = doc.createElement("button");
      button.type = "button";
      button.className = "lab-fs";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Full screen");
      button.appendChild(icon("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"));
      var label = doc.createElement("span");
      label.className = "lab-fs-label";
      label.textContent = "Full screen";
      button.appendChild(label);
      button.addEventListener("click", function (event) {
        toggle(event.currentTarget);
      });
      view.insertBefore(button, view.firstChild);
    }
    doc.addEventListener("fullscreenchange", onChange);
    doc.addEventListener("webkitfullscreenchange", onChange);
    doc.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = doc.querySelectorAll(".view.is-fs");
      for (var n = 0; n < open.length; n++) {
        exitFallback(open[n]);
        var button = open[n].querySelector(".lab-fs");
        if (button) sync(button, false);
      }
    });
    function onChange() {
      var current = nativeFullscreen(doc);
      var buttons = doc.querySelectorAll(".lab-fs");
      for (var n = 0; n < buttons.length; n++) {
        var view = buttons[n].closest(".view");
        if (view && current === view) exitFallback(view);
        sync(buttons[n], !!(view && (current === view || view.classList.contains("is-fs"))));
      }
    }
  }

  global.labWire = { overlay: overlay, set: set };
  if (global.document) {
    try {
      mountFullscreen(global.document);
    } catch (err) {
      /* A lab page with no simulator view has nothing to mount. */
    }
  }
})(window);
