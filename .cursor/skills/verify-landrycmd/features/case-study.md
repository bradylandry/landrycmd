# Case study

## Sub-features

- Standalone write-up of the AI Network Operations Platform
- Scale line: 28 servers, about 573 tools, 44 agents, 31 skills, 23 authored
- Links out to the MCP hub lab and the firewall review lab

## How to get to it (user POV)

From Home, Work, follow "AI Network Operations Platform". The URL is `/work/ai-network-operations`.

## Driving it with curl and drive.mjs

```bash
curl -fsSL -o /tmp/landrycmd-verify/case-study.html http://localhost:4321/work/ai-network-operations
test -s /tmp/landrycmd-verify/case-study.html
grep -q 'AI Network Operations Platform (MCP)' /tmp/landrycmd-verify/case-study.html
grep -q '/lab/mcp-simulator/' /tmp/landrycmd-verify/case-study.html
grep -q '/lab/frr-review/' /tmp/landrycmd-verify/case-study.html
```

Selectors: `article.prose h1`, `a[href="/lab/mcp-simulator/"]`, `a[href="/lab/frr-review/"]`. The page has no `role="tab"`.

`drive.mjs` runs contrast on this URL in both themes.

## Gotchas

- This page is not the firewall review. The review numbers (backlog 200 to about 40, 30–60 minutes to 3–5) are mentioned only to point at `/lab/frr-review/`.
- Home's Work band (`#work`) links the same three URLs. The case-study test in `test/case-study.test.ts` locks that.
