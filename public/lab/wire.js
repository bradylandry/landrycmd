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

  function isOpen(view) {
    return nativeFullscreen(view.ownerDocument) === view || view.classList.contains("is-fs");
  }

  function sync(button, on) {
    var name = on ? "Exit full screen" : "Full screen";
    button.setAttribute("aria-label", name);
    var label = button.querySelector(".lab-fs-label");
    if (label) label.textContent = on ? "Exit" : "Full screen";
  }

  function lockScroll(doc) {
    var body = doc.body;
    var win = doc.defaultView;
    if (!body || body.classList.contains("lab-fs-open")) return;
    var y = win ? win.scrollY || win.pageYOffset || 0 : 0;
    body.dataset.labFsY = String(y);
    body.classList.add("lab-fs-open");
    body.style.position = "fixed";
    body.style.top = "-" + y + "px";
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
  }

  function unlockScroll(doc) {
    var body = doc.body;
    var win = doc.defaultView;
    if (!body || !body.classList.contains("lab-fs-open")) return;
    var y = Number(body.dataset.labFsY || 0);
    body.classList.remove("lab-fs-open");
    delete body.dataset.labFsY;
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    if (win) win.scrollTo(0, y);
  }

  function fallback(view, button) {
    view.classList.add("is-fs");
    lockScroll(view.ownerDocument);
    sync(button, true);
  }

  function exitFallback(view) {
    view.classList.remove("is-fs");
    if (!view.ownerDocument.querySelector(".view.is-fs")) unlockScroll(view.ownerDocument);
  }

  function settle(button) {
    var view = button.closest(".view");
    sync(button, !!(view && isOpen(view)));
  }

  function mountFullscreen(doc) {
    if (doc.documentElement.hasAttribute("data-lab-fs")) return;
    doc.documentElement.setAttribute("data-lab-fs", "");
    var pendingButton = null;

    var views = doc.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      var view = views[i];
      if (view.querySelector(".lab-fs")) continue;
      var button = doc.createElement("button");
      button.type = "button";
      button.className = "lab-fs";
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

    function onChange() {
      var current = nativeFullscreen(doc);
      if (pendingButton) {
        var pendingView = pendingButton.closest(".view");
        if (pendingView && current === pendingView) pendingButton = null;
      }
      var buttons = doc.querySelectorAll(".lab-fs");
      for (var n = 0; n < buttons.length; n++) settle(buttons[n]);
    }

    function onError() {
      var button = pendingButton;
      pendingButton = null;
      if (!button) {
        onChange();
        return;
      }
      var view = button.closest(".view");
      if (!view || nativeFullscreen(doc) === view) {
        settle(button);
        return;
      }
      fallback(view, button);
    }

    doc.addEventListener("fullscreenchange", onChange);
    doc.addEventListener("webkitfullscreenchange", onChange);
    doc.addEventListener("fullscreenerror", onError);
    doc.addEventListener("webkitfullscreenerror", onError);
    doc.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = doc.querySelectorAll(".view.is-fs");
      for (var n = 0; n < open.length; n++) {
        if (nativeFullscreen(doc) === open[n]) continue;
        var button = open[n].querySelector(".lab-fs");
        exitFallback(open[n]);
        if (button) settle(button);
      }
    });

    function enter(button) {
      var view = button.closest(".view");
      if (!view) return;
      var req = view.requestFullscreen || view.webkitRequestFullscreen;
      if (typeof req !== "function") {
        fallback(view, button);
        return;
      }
      pendingButton = button;
      var pending;
      try {
        pending = req.call(view);
      } catch (err) {
        pendingButton = null;
        fallback(view, button);
        return;
      }
      if (!pending || typeof pending.then !== "function") return;
      pending.then(
        function () {
          if (pendingButton === button) pendingButton = null;
          settle(button);
        },
        function () {
          if (pendingButton === button) pendingButton = null;
          if (nativeFullscreen(doc) === view) settle(button);
          else fallback(view, button);
        },
      );
    }

    function leave(button) {
      var view = button.closest(".view");
      if (!view) return;
      if (nativeFullscreen(doc) !== view) {
        if (view.classList.contains("is-fs")) exitFallback(view);
        settle(button);
        return;
      }
      var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (typeof exit !== "function") {
        settle(button);
        return;
      }
      var pending;
      try {
        pending = exit.call(doc);
      } catch (err) {
        settle(button);
        return;
      }
      if (pending && typeof pending.then === "function") {
        pending.then(
          function () {
            settle(button);
          },
          function () {
            settle(button);
          },
        );
        return;
      }
      settle(button);
    }

    function toggle(button) {
      var view = button.closest(".view");
      if (!view) return;
      if (isOpen(view)) leave(button);
      else enter(button);
    }
  }

  global.labWire = { overlay: overlay, set: set };

  function boot() {
    mountFullscreen(global.document);
  }

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})(window);
