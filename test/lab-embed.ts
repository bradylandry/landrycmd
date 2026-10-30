import { JSDOM } from "jsdom";

const FOLLOWS = 4;

export function embedProblems(html: string, embedJs: string, shellCss: string, url: string) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  const { window } = dom;
  const { document } = window;
  const problems: string[] = [];
  const script = document.querySelector('script[src="/lab/embed.js"]');
  if (!script) {
    window.close();
    return ["page does not load /lab/embed.js, so it keeps its chrome and links navigate the iframe"];
  }
  const links = [...document.querySelectorAll("a[href]")];
  if (links.some((link) => !(link.compareDocumentPosition(script) & FOLLOWS))) {
    problems.push("/lab/embed.js loads before a link, so that link is not retargeted");
  }
  const style = document.createElement("style");
  style.textContent = shellCss;
  document.head.append(style);
  (window as unknown as { eval(code: string): void }).eval(embedJs);
  if (!document.documentElement.classList.contains("lab-embed")) {
    problems.push("?embed=1 did not set html.lab-embed");
  }
  for (const link of links) {
    const target = link.getAttribute("target");
    if (target !== "_top" && target !== "_blank") {
      problems.push(`link ${link.getAttribute("href")} would navigate inside the iframe`);
    }
  }
  for (const chrome of document.querySelectorAll(".lab-header, .lab-footer")) {
    if (window.getComputedStyle(chrome).display !== "none") {
      problems.push(`.${chrome.className} still shows inside the dialog`);
    }
  }
  window.close();
  return problems;
}
