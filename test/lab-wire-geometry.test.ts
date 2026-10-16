import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { checkLabHtml } from "./lab-wire-geometry.ts";

const labRoot = new URL("../public/lab/", import.meta.url);

const PRE_FIX_GLITCH = `<!DOCTYPE html><html><body>
<svg id="topo"></svg>
<script>
const S='http://www.w3.org/2000/svg';
const mk=(t,a,p)=>{const e=document.createElementNS(S,t);for(const k in a)e.setAttribute(k,a[k]);p&&p.appendChild(e);return e};
const topo=document.getElementById('topo');
const eg=mk('g',{},topo),ng=mk('g',{},topo),fg=mk('g',{},topo);
mk('path',{class:'edge',d:'M570 56 H700'},eg);
mk('path',{class:'flow',d:'M570 56 H700'},fg);
const g=mk('g',{class:'node',transform:'translate(560 40)','aria-label':'Core 7200s'},ng);
mk('rect',{width:160,height:40},g);
const t=mk('text',{x:80,y:24},g);t.textContent='Core 7200s';
</script>
</body></html>`;

test("packet dashes never cross a node box or label", async () => {
  const caught = await checkLabHtml(PRE_FIX_GLITCH, "pre-fix glitch");
  assert.ok(
    caught.some((problem) => problem.includes("painted before the packet layer")),
    caught.join("\n"),
  );
  assert.ok(
    caught.some((problem) => problem.includes('crosses the interior of node "Core 7200s"')),
    caught.join("\n"),
  );
  assert.ok(
    caught.some((problem) => problem.includes('crosses the interior of label "Core 7200s"')),
    caught.join("\n"),
  );

  const entries = await readdir(labRoot, { withFileTypes: true });
  const problems: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const html = await readFile(new URL(`./${entry.name}/index.html`, labRoot), "utf8");
    problems.push(...(await checkLabHtml(html, entry.name)));
  }
  assert.deepEqual(problems, []);
});
