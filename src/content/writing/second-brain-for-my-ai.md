---
title: "I built a second brain for my AI, not for me"
description: "Most second-brain content is about notes for humans. The real leverage is treating your vault as the long-lived context layer every AI tool in your stack can read from and write back to."
date: 2026-04-27
tags: [ai, second-brain, claude-code, knowledge-management, workflow]
---

Every AI conversation starts as a stranger. You open Claude, you open Cursor, you spawn a research agent, and each time the same routine: who you are, what you're working on, what you've already tried, what you don't want to repeat. You spend the first 10% of every conversation re-laying foundation. Then the model gets useful. Then the session ends and the context evaporates.

The fix isn't a smarter model. It's a shared file.

I have a bad short-term memory. I work on a dozen projects across network automation, trading systems, mobile apps, and personal tools — and a week after making a decision I can't remember the details. What was decided. Why. What the alternatives were. I tried to fix it with OneNote — two years of meeting notes and project pages. It compensated in a narrow sense: I could find what was said in a meeting six months ago. But it died the way every PKM system dies. Maintaining the structure felt like work I wasn't paid for, and the structure was for one consumer — me. No AI could navigate it. No agent could read a project page and update it. The notes lived in OneNote and the AI tools I use every day couldn't see any of them. The real fix came when I moved to a markdown vault and gave my AI assistants permission to write back to it.

A co-worker asked for the setup recently. Sending my private vault isn't viable — it's full of my work, my family, my finances — and walking him through the structure verbally would lose 90% of the value. So I extracted the working pattern into a template, stripped the personal data out, and put it on GitHub: [`bradylandry/second-brain-template`](https://github.com/bradylandry/second-brain-template). He's the first external user.

The thesis underneath it is the part most second-brain content misses.

## Most second-brain content is about humans

Folders and tags and backlinks. Pretty graphs. Dataview queries. All of it framed as a tool for you to think with.

That framing is fine, but it's also why most second brains die. Maintaining structure for one human consumer — yourself — is exhausting. The work is real, the payoff is delayed, and you can almost always justify writing the note "later." Later doesn't come.

The reframe: **your AI tools need that structure more than you do.** A folder of markdown files with consistent conventions is the difference between an AI that re-asks you the same five questions every Monday and an AI that opens with "I see your trading project shipped the regime detector last Wednesday — what's next?"

The vault stops being a productivity system. It starts being a long-lived context layer.

## Structure for machines, not for you

Three conventions do the heavy lifting. None of them are clever.

**Semantic folders.** `daily/`, `weekly/`, `projects/`, `references/`, `inbox/`, `journal/`, `research-skill-graph/`. Each folder has a `README.md` that explains what goes there in two paragraphs. When an AI is asked "where does this go?" it reads the folder READMEs and decides — no prompt engineering required. You stop thinking about taxonomy. The taxonomy is in the repo.

**Typed frontmatter.** Every file starts with a YAML header:

```yaml
---
type: project
status: active
started: 2026-04-23
tags: [trading, infra]
---
```

This looks like bureaucratic overhead. It is the single thing that makes vault operations reliable. "Find my active projects" becomes a deterministic filter on `type: project` AND `status: active`. Without frontmatter, an AI has to guess based on folder location or filename — and guesses are wrong 10–20% of the time. Fine for low-stakes work, broken for anything you'd trust.

**Plain markdown.** No proprietary format, no database, no SDK required. `find` and `grep` are the query engine. If Obsidian dies tomorrow, your vault still works. If you switch from Claude to Gemini next year, your vault still works. You can read these files in `cat` thirty years from now.

And critically: the AI maintains all of this, not me. I don't write the YAML. I don't decide which folder a file goes in. `/braindump`, `/onboard-vault`, and any agent writing output add the right frontmatter and pick the right path because the conventions are encoded in the integration files (`CLAUDE.md`, `.cursorrules`, etc.) the AI reads on every session. The structure isn't a discipline I keep up with. It's a contract the AI honors when it writes — which is the only reason it survives past month two.

That's the setup. Folder structure plus frontmatter plus markdown. Boring on purpose.

## The `/braindump` ritual

Reading from a vault is easy. Writing *useful, structured* notes is the hard part — and the part where every PKM system loses the user. You have to decide where it goes, match the house style of the project, date it, link it, commit it. Doing that well takes ten minutes. You don't have ten minutes after a coding session.

`/braindump` is a ~50-line slash command that collapses the whole ritual into one step. After a work session I type:

```text
/braindump just finished wiring the regime detector into the trading
scheduler. covered the 2018 vol spike correctly, missed the 2020 covid
drop. added a TODO to revisit fallback signals.
```

The AI then:

1. Identifies which project file the work belongs to (or asks if ambiguous)
2. Reads that file to learn its house style — section structure, tone, bullet/prose ratio
3. Adds a new `## <Title> (YYYY-MM-DD)` section before `## Lessons Learned`, matching the style
4. Suggests a git commit (never pushes without explicit approval)

The output looks like the rest of the file because the AI read the file before writing. My project notes self-maintain. They are never stale. Years of dated context accumulate at zero ongoing effort, in a format that future-me and future-AI can both navigate.

The skill itself is short. The vault structure is what makes it work — without semantic folders and frontmatter, the AI's "which file does this go in?" step is a coin flip.

`/braindump` is the user-facing ritual that ships with the template. My personal vault goes further — git commits, Claude Code sessions, and voice calls auto-capture into dated files without me typing anything. The template stops short of that on purpose; the auto-capture wiring is opinionated about which tools you use, and not every tool I built is the one you'd want. The point of the template is the *substrate* — folder structure, frontmatter, write-permission norms — that any auto-capture mechanism can target. The real value isn't the vault. It's the auto-capture. Manual note-taking doesn't scale, and once it stops scaling the structure rots.

## Onboarding evolved away from itself

The first version of the template's onboarding skill ran a 25-minute interview — "what's your role? what are your projects? what are your values?" — and wrote the persona files from your answers. It worked. It was also unnecessary.

If you're using a tool with file-edit capabilities, the AI already has most of the context it needs. It's read your repos. It's seen your prior chats. Its system prompt has your bio. Asking 25 questions to surface information the AI already had is wasted overhead.

The current `/onboard-vault` skill drafts the persona files from existing context, then surfaces what it couldn't infer as a "fill me in" list. ~5 minutes instead of 25 on first run. The onboarding flow itself is a microcosm of the thesis: when the AI can read context, the friction collapses. Don't make the human do the work the machine can already do.

## The 6-lens research system

The vault ships with a research methodology that turned out to be too useful to leave private. Every project under `research-skill-graph/` is structured around six lenses on the same question:

- **Technical** — what do the numbers say?
- **Economic** — follow the money
- **Historical** — what patterns repeat?
- **Geopolitical** — which power dynamics shape this?
- **Contrarian** — what if the consensus is wrong?
- **First-principles** — rebuild from fundamentals

Each lens is required to disagree with the others in places. That disagreement is where the insight lives. One run through the 6 lenses produces deeper analysis than six independent chats because each lens has access to the prior lens's findings, and the synthesis step has to explicitly resolve the contradictions instead of letting the AI quietly pick whichever frame it landed on first.

I've used this for career decisions, product launches, technical bets, and one large purchase. Opinionated enough to produce consistent output, generic enough to apply to almost any question where you want real depth instead of a confident-sounding paragraph.

The template ships with one fully populated example — a research project on the ACT prep market — so a new user can see what populated 6-lens output actually looks like before scaffolding their own:

```bash
cd vault/research-skill-graph
./new-project.sh my-new-question
```

## The compounding effect

This is the part that doesn't show up on day one and is the entire reason to do this.

**Day 1:** AI advice is generic. You paste persona and project files as context, get marginally better output. Feels like overhead.

**Day 30:** `/braindump` has updated your project files twenty times. Your AI references your actual history when you ask it for advice. It says "you tried X two weeks ago and it broke for reason Y" instead of suggesting you try X.

**Day 180:** You have 5–10 completed research projects, 90 days of daily notes, dated sections across 15 active project files. Your AI is effectively a colleague who has been with you the whole time — because its context store literally covers the whole time.

**Day 365:** The advice you're getting is impossible to reproduce with prompt engineering. The value isn't in the prompt; it's in the compounded context. Your vault is a moat.

This is what "AI as augmented cognition" actually looks like in practice. Not a smarter model. A better-informed one.

## AI-agnostic on purpose

The `integrations/` folder has wrappers for [Claude Code](https://github.com/bradylandry/second-brain-template/tree/main/integrations/claude-code), Cursor, Continue.dev, OpenCode, and a generic pattern that works with ChatGPT or local Ollama. Pick one during setup and it wires up the right config file (`CLAUDE.md`, `.cursorrules`, an `AGENTS.md`, etc.) with the conventions the vault expects.

The docs cover two paths cleanly. If your AI has file-edit tools (Claude Code, Cursor, Aider, Cline), it writes files into your vault directly. If your AI is text-only (browser ChatGPT, Gemini web), it outputs each file as a markdown block and you copy-paste. Neither path is the degraded version of the other — they're documented at the same fidelity.

I run Claude Code as the primary integration because that's what I built it against. The template doesn't lock you in. The folder structure and the `/braindump` pattern are the IP — the rest is just files.

If you switch tools in six months, your vault comes with you unchanged. Move the integration file. Done.

## Why I open-sourced the structure

The vault layout is public now. The `/braindump` skill is public. The 6-lens methodology is public. None of that is the moat.

The moat is the habit of use over time, on your specific work, with your specific history. If two engineers fork this template today, in a year they have two vastly different vaults — each one uniquely useful to its owner. The setup is free; the compounded context is yours and yours alone.

That's the right thing to open-source. The structure is generic enough that giving it away costs me nothing. The value lives in the disciplined use of it, which I can't transfer to anyone, and which copying my repo doesn't get you.

The first external user is running it now. The first PR will probably tell me which docs were unclear; the second will probably suggest an integration I didn't write. That's the work I actually want help on.

## The actual takeaway

If you've tried to "organize your thoughts" in Obsidian or Notion and watched the structure rot, the problem isn't your discipline. The problem is that the structure had only one consumer — you — and you don't have time to be the librarian for your own life.

Give the vault a *second reader*: the AI you already use every day. Make the structure machine-readable. Give the AI permission to write back. The maintenance burden collapses, and what comes out the other end is a long-lived context layer that makes every AI tool in your stack noticeably better at its job.

The principle underneath is simple: leave breadcrumbs. Document the *why*, not just the *what*. Every commit message, every dated section, every project's lessons learned — that's the trail you're laying for future-you and for the AI that helps future-you. The vault makes the breadcrumbs cheap to drop. The AI follows them when it needs to.

Setup is `git clone` and a script:

```bash
git clone git@github.com:bradylandry/second-brain-template.git
cd second-brain-template
./setup.sh ~/my-vault
```

Pick your AI integration when prompted. Start running `/braindump` after work sessions. Come back in six months and check whether your AI knows what you've been working on without being told.

— Brady
