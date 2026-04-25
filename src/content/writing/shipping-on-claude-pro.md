---
title: "Shipping software on a $20/month Claude Pro plan, a Mac mini, and a stack of free APIs"
description: "What you can actually build when the Claude Code harness orchestrates a 32GB Mac mini, free cloud models, and the Pro plan — without an API budget."
date: 2026-04-25
tags: [ai, claude-code, local-llm, workflow]
---

I've shipped four production apps this year — a personal AI assistant, an algorithmic trading platform, a peptide-tracking mobile app, and a runbook-first ops framework — and my entire AI bill is **$20/month**.

That's the Claude Pro plan. No API tokens. No OpenAI. No paid Cursor. The trick is letting Claude Code be the *orchestrator*, not the worker. The actual lifting gets handed off to a Mac mini running local models and a half-dozen free-tier cloud APIs that nobody bothers to use because they aren't OpenAI.

Here's the actual setup.

## The hardware

One Mac mini, 32GB of unified memory, sitting on my desk. That's it. No GPU. No homelab. No K8s cluster.

The Mac mini matters because Apple Silicon's unified memory means a 32B-parameter coding model fits in RAM and runs at usable speeds — something that would cost you $2K+ in NVIDIA hardware to match. With [Ollama now built on MLX](https://ollama.com/blog/mlx) on Apple Silicon, the same machine that's running my IDE is also serving inference for background jobs.

## The brain: Claude Pro ($20/mo)

[Claude Code on the Pro plan](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan) gives you Sonnet 4.6 and Opus 4.6 with a session-based usage limit (resets every 5 hours) and a weekly cap. Both are shared across the Claude.ai web app and Claude Code, so you have to be deliberate about where you spend tokens.

I run Claude Code inside VS Code via the [official extension](https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development) (Cmd+Esc to open). It sees my open tabs, selections, and diagnostics automatically. I don't pay for Cursor. I don't pay for Copilot.

The Pro plan is enough to ship if — and only if — you stop using Claude for things Claude shouldn't be doing.

## What Claude Pro is for vs. what gets delegated

The single biggest mistake people make: using the most expensive model in their stack for tasks that don't need it.

**Claude Pro (Sonnet/Opus) gets used for:**
- Architecture decisions and system design
- Reading a codebase and reasoning about a non-trivial change
- Multi-step refactors that span 5+ files
- Code review with judgment calls (security, perf, readability)
- The hard parts of debugging — where the bug spans process boundaries

**Everything else gets delegated.** Boilerplate generation, doc summarization, log triage, test fixture writing, narrative reports, image-OCR, sentiment scoring on news headlines, daily digests — none of these need a frontier model. They need *a* model.

This is where the Mac mini and the free APIs earn their keep.

## The local workhorse: Mac mini + Qwen3-Coder

[Qwen3-Coder-32B](https://insiderllm.com/guides/best-local-llms-mac-2026/) is the community-consensus pick for local coding work in 2026. It's got rock-solid tool calling (critical when you're embedding it in agents), a 256K context window, and — once quantized to Q4 — fits comfortably in 32GB with room left over for the rest of your machine.

I run it via Ollama (the easy path) and call it from inside Claude Code as a subagent or via a simple OpenAI-compatible HTTP wrapper. Two patterns I use it for constantly:

1. **Background loops** — my [jarvis-ops triage framework](https://github.com/bradylandry/jarvis-ops) runs monitoring checks every 60 seconds and uses the local model to investigate anomalies that don't match a known runbook entry. Free, infinite calls, no rate limit.
2. **Code generation that doesn't need to be perfect** — strategy boilerplate, test fixtures, peptide data entries. I prompt the local model first, then have Claude review the output. Two-pass: cheap generate, expensive review. The economics of that flip is what makes the whole thing work.

[Ollama now ships with MLX acceleration](https://9to5mac.com/2026/03/31/ollama-adopts-mlx-for-faster-ai-performance-on-apple-silicon-macs/) on Apple Silicon, which roughly doubles throughput on Macs vs. their previous llama.cpp backend.

## The free cloud tier: Groq, Cerebras, NVIDIA NIM

The free tiers in 2026 are *genuinely production-grade* if you stack them and route around individual rate limits.

| Provider | What it's for | Notes |
|----------|---------------|-------|
| [Groq](https://console.groq.com) | Anything where speed matters more than quality | 315 tokens/sec on Llama 3.3 70B, OpenAI-compatible endpoint, ~6K tokens/min cap |
| [Cerebras](https://cloud.cerebras.ai) | Highest throughput free tier | 60K tokens/min, 1M tokens/day on Llama 3.3 70B / Qwen3 / GPT-OSS-120B |
| [NVIDIA NIM](https://build.nvidia.com) | Model variety — 91 free endpoints incl. vision, audio, biology | DeepSeek R1, Llama 3.3, Mixtral, Grok-2-Vision (when routing image input) |
| [Google AI Studio](https://aistudio.google.com) | Long-context tasks | Gemini 2.5 Flash free tier — generous for document summarization |

I have all of these wired into different parts of my stack. My Jarvis assistant uses **DeepSeek R1 via NVIDIA NIM** for chat. Voice goes through **Gemini Live on Vertex** (which is free under GCP credits). SMS replies fall back to **Llama 3.3 on Groq** when something rate-limits. My trading platform has a **rate limiter + semaphore** in front of NVIDIA NIM so I don't get 429'd on a busy market open.

All of these speak the OpenAI Chat Completions API. Swap a base URL and an API key, and code that worked against gpt-4 last year works against any of them today.

## The glue: Claude Code's extension model

What makes Claude Code more than a chat box is its [extension surface](https://code.claude.com/docs/en/features-overview): MCP servers, subagents, skills, and hooks. This is the part most people miss.

**MCP servers** turn external systems into tools Claude can call. The ones I run for personal projects are Firestore (real-time sync for my Jarvis assistant), GCP Secret Manager (so secrets never hit disk), GitHub via the `gh` CLI, and a couple of internal ones I wrote for my trading platform. The list is a lot more interesting at work, but those servers don't ship to github — different stack, different rules.

**Subagents** spawn fresh-context workers. This is the killer feature for cost — and the cleanest way to delegate work to cheaper models, which I'll come back to in a minute. When Claude Code needs to grep a 50K-line codebase to answer a question, it dispatches a subagent that returns a ~200-token summary instead of polluting the main conversation. [Subagents don't inherit your session history](https://alexop.dev/posts/understanding-claude-code-full-stack/) — they get a clean slate, do their job, and report back.

**Hooks** fire on lifecycle events. I have a `PreToolUse` hook that blocks `git push` without my explicit confirmation — caught me twice. Another writes every tool call to a log so I can audit what an agent did at 2am. Another auto-runs tests after edits to specific paths. These run *unprompted* — they're guardrails, not features.

**Skills** are reusable workflows you invoke with `/skill-name`. I have a `/braindump` skill that takes my unstructured notes and updates the right project file in my [second-brain vault](https://github.com/bradylandry/second-brain-template). Each skill is a markdown file with a prompt — that's the whole API.

## The actual delegation pattern

Most people who try this setup stop at "I plugged a coding MCP into Claude Code and it routes to my local model." That works, but it leaves money on the table. The MCP-as-tool pattern means Claude has to wrap every delegated task as a tool call, parse the result, and re-orchestrate — three hops where one would do.

The cleaner pattern is **subagents with model overrides**. A subagent file lives at `~/.claude/agents/<name>.md` and looks like this:

```markdown
---
name: strategy-scaffold
description: Use when scaffolding a new trading strategy. Generates the
  paper_trader.py module following the existing contract.
model: kimi-k2
tools: [Read, Write, Edit, Glob, Grep, Bash]
---

You scaffold new jarvis-trading strategies. Read the project's CLAUDE.md
first — it spells out the strategy contract. Don't deviate. ...
```

Two things are happening there. First, `model: kimi-k2` routes this subagent to a different inference backend (in my case, Kimi K2 thinking on NVIDIA NIM). Second, the subagent gets its own system prompt — encoding domain knowledge that would otherwise have to be re-explained in every Claude session.

Claude Pro reads my request ("scaffold a new mean-reversion strategy"), realizes the `strategy-scaffold` subagent's description matches, and dispatches it. Kimi does the actual generation — file by file, against the project's existing patterns — and returns a one-paragraph summary. Claude reviews the summary and decides if anything else needs doing. The expensive model never reads the boilerplate; it only reads the *outcome*.

I keep my subagents in a `jarvis-ops/agents/` directory and symlink them into `~/.claude/agents/` so they sync across machines via `git pull`. The current set:

- **strategy-scaffold** (Kimi K2) — stub a new jarvis-trading strategy following the existing contract
- **monitor-scaffold** (Kimi K2) — stub a new jarvis-ops Monitor + Runbook entry
- **pytest-writer** (Kimi K2) — write pytest tests matching the project's existing patterns
- **diff-reviewer** (local Qwen3-Coder) — review `git diff` against the repo's CLAUDE.md, flag violations, never edit files
- **peptide-entry** (Kimi K2) — generate `peptides.ts` + `vendors.ts` entries from a description
- **changelog-writer** (local Gemma) — turn `git log` into release notes or PR descriptions

Notice the model split: structured generation goes to NIM (Kimi has the best instruction-following I've tested for code at the free tier), and high-volume / fast-feedback tasks go local (review every diff, every commit message — these run constantly, can't tolerate rate limits).

The whole `agents/` directory is in [bradylandry/jarvis-ops](https://github.com/bradylandry/jarvis-ops/tree/main/agents) if you want to lift the format. Each file is ~50 lines and contains everything Claude needs to dispatch correctly: when to use the agent, what model, which tools it can touch, and the project conventions it must follow.

## How this actually saves money

The mental model I use:

```text
Claude Pro (the brain)
    ├─ thinks about what to do
    ├─ delegates execution to subagents
    │      └─ subagents call: local model (free) or free cloud APIs
    ├─ uses MCP servers to read live state from real systems
    └─ uses hooks to enforce guardrails without burning tokens
```

When I sit down to ship a feature, Claude Pro reads my codebase and writes the architecture. A subagent runs the test suite (zero Claude tokens). Another generates the boilerplate against my local Qwen model. Claude Pro reviews the diff. A hook commits if tests pass. The Pro plan handled the part that needed judgment; everything else was free.

The result is that my 5-hour Claude Pro session window is almost never the bottleneck. The bottleneck is *me* deciding what to build next.

## Footguns the harness doesn't catch

The Pro-plan-orchestrated workflow is great when it works. When it breaks, you find out fast that no LLM in your stack can debug environment problems for you. A few I've collected the hard way:

**The `.env.local` poison-pill.** Run `vercel env pull` once and Vercel's CLI dumps a `.env.local` into your repo with `VERCEL=1`, `TURBO_CACHE=...`, `NX_DAEMON=...`, and a dozen other production-runtime vars. Now your *local* build runs in "I'm in CI" mode because every framework in your stack reads those vars and takes different code paths. Symptom for me on Expo: the Metro dev server stops itself silently before bundling a single file. Looks like a transformer crash. Took an agent two hours of false leads and a supervisor escape hatch to find the real cause. Fix: keep `.env.local` to `EXPO_PUBLIC_*` vars only, or delete it entirely and let `vercel build` re-fetch what it needs.

**Cross-machine drift on local-only state.** Code is in git, `node_modules/` is not, `.expo/` is not, `~/Library/Caches/` is not, your shell's environment is not. I had a peptide-app build hang on my Mac mini and ship cleanly from a different laptop with the *same git commit*. The difference was a 6-month-old `.env.local` from a long-forgotten `vercel pull` plus Node v20 vs Node v25. Three minutes to diagnose with side-by-side machines, three hours to diagnose alone. If a build that worked yesterday breaks today, the first question is: what's local-only that drifted?

**Free-tier rate limits aren't visible until they bite.** A subagent loop hitting NVIDIA NIM works fine for an hour, then 429s during market open when traffic spikes. Local models don't have rate limits but have throughput limits that look the same — your Mac mini at 100% GPU during a render won't return tokens fast. Build with circuit breakers. I have a small wrapper around every cloud API call that drops to local on a 429 and posts a one-line alert. Cost: about 30 lines of code per provider. Saves entire trading cycles from silently failing.

**The harness can't see across processes.** Claude Code dispatches a subagent, the subagent's transformer worker dies because of a Node `dlopen` mismatch, the subagent reports "no output" with no stack trace because its parent ate stderr. This is the failure mode where Claude burns tokens spelunking and finds nothing. The fix is always the same: **manually run the failing command with full env capture and `2>&1`**, paste the output back into Claude. Don't ask Claude to debug a hang — Claude sees what you see, and a hang produces nothing. Run it yourself, capture, then resume.

## What this doesn't replace

Be honest about the limits:

- **You still need an API budget for production user-facing AI.** When my trading platform makes a real decision on a real signal, it calls a paid API. I don't trust a local model to YOLO a market position. The free tiers and local models are for me — not my users.
- **Latency budgets matter.** Local models on a Mac mini are usable, not fast. If a response needs to come back in 200ms, you're paying for inference somewhere.
- **Free tiers can disappear.** Six months ago Groq's free tier was 30x looser. Six months from now Cerebras' might be locked behind a credit card. Build with portability in mind — anything OpenAI-compatible can be swapped.

## The actual takeaway

Most of what people pay $200/month in AI tooling for is solvable with one Pro plan, a $600 used Mac mini, and the discipline to route work to the cheapest model that can do it. The Claude Code harness makes that routing easy — it gives you the primitives (subagents, MCP, hooks) to compose a real system out of free parts.

You don't need a tier upgrade. You need an architecture.

— Brady
