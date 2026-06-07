# Graph Report - .  (2026-06-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 128 nodes · 145 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `97f6f26e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `../../layouts/Layout.astro` - 10 edges
2. `[]` - 9 edges
3. `File Map` - 9 edges
4. `getRedis()` - 7 edges
5. `scripts` - 6 edges
6. `verifyToken()` - 6 edges
7. `Starbase 2026 Trip Page — Design Spec` - 6 edges
8. `landrycmd` - 5 edges
9. `sign()` - 4 edges
10. `POST()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `checkRateLimit()` --calls--> `getRedis()`  [EXTRACTED]
  src/pages/api/trips/auth.ts → src/lib/redis.ts
- `POST()` --calls--> `getRedis()`  [EXTRACTED]
  src/pages/api/trips/vote.ts → src/lib/redis.ts
- `GET()` --calls--> `getRedis()`  [EXTRACTED]
  src/pages/api/trips/votes.ts → src/lib/redis.ts
- `POST()` --calls--> `isVoter()`  [EXTRACTED]
  src/pages/api/trips/vote.ts → src/lib/redis.ts
- `POST()` --calls--> `verifyToken()`  [EXTRACTED]
  src/pages/api/trips/vote.ts → src/middleware.ts

## Import Cycles
- None detected.

## Communities (14 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.22
Nodes (13): getRedis(), isVoter(), Voter, VOTERS, onRequest, PUBLIC_TRIPS, sign(), verifyToken() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (9): collections, writing, dependencies, astro, @astrojs/mdx, @astrojs/rss, @astrojs/vercel, @upstash/redis (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (8): ../../layouts/Layout.astro, canonical, openSource, products, [], bar, observer, ../styles/global.css

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (12): engines, node, name, private, scripts, astro, build, dev (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (11): Footguns the harness doesn't catch, How this actually saves money, The actual delegation pattern, The actual takeaway, The brain: Claude Pro ($20/mo), The free cloud tier: Groq, Cerebras, NVIDIA NIM, The glue: Claude Code's extension model, The hardware (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (10): File Map, Starbase 2026 Trip Page Implementation Plan, Task 1: Scaffold the page shell, Task 2: Countdown timer script, Task 3: Schedule section — day cards, Task 4: Launch Watch + Camp Setup sections, Task 5: Packing list with localStorage checkboxes, Task 6: Gear to Buy section (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (10): AI-agnostic on purpose, Most second-brain content is about humans, Onboarding evolved away from itself, Structure for machines, not for you, The 6-lens research system, The actual takeaway, The `/braindump` ritual, The compounding effect (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.32
Nodes (7): clearError(), display, dots, error, keypad, render(), submit()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (6): Approach, Checkbox Persistence, Dates, Route & File, Sections (scroll order), Starbase 2026 Trip Page — Design Spec

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (5): Adding a writing post, Deployment, Development, landrycmd, Stack

### Community 10 - "Community 10"
Cohesion: 0.50
Nodes (3): exclude, extends, include

## Knowledge Gaps
- **72 isolated node(s):** `name`, `version`, `private`, `type`, `node` (+67 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `../../layouts/Layout.astro` connect `Community 2` to `Community 0`, `Community 1`, `Community 7`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _72 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._