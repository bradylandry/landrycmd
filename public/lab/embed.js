/* Hide site chrome when a lab is inside the homepage dialog, and send
   links to the top window so they do not navigate the iframe. */
(function () {
  var framed = false;
  try {
    framed = window.self !== window.top;
  } catch (err) {
    framed = true;
  }
  var embed = framed;
  try {
    if (new URLSearchParams(window.location.search).get("embed") === "1") embed = true;
  } catch (err) {
    embed = true;
  }
  if (!embed) return;
  document.documentElement.classList.add("lab-embed");
  var links = document.querySelectorAll("a[href]");
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    if (link.getAttribute("target") === "_blank") continue;
    link.setAttribute("target", "_top");
  }
})();
