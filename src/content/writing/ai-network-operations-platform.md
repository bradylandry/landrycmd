---
title: "The network-operations platform, and where the model stops"
description: "The AI Network Operations Platform at Charter/Spectrum: 28 MCP servers, about 573 tools, 44 agents, 31 skills, and a human at the end of anything that changes the network."
date: 2026-10-15
draft: true
tags: [ai, mcp, network-operations]
---

A network question is rarely one question. Someone asks whether a change is safe, or why a path looks wrong, or what a request is actually touching. The facts are already in the network. They are split across the systems that hold them. Telemetry in one. The source of truth in another. The ticket in a third. Addressing in a fourth. The change record in a fifth. You read a value out of one window and type it into the next, and you do that until the question has an answer.

None of the individual lookups is hard. The day disappears in the seams. A second request lands while the first one is still spread across the tabs. A value was right when you copied it and stale by the time you used it. The procedure for the job exists, and two people running it still do it two different ways, because the procedure lives in a document or in someone's head.

I have been on that side of the work since 2011, at Charter/Spectrum (formerly Cox). Regional operations, then the national backbone, then the national data center. The consoles changed. The shape of the day did not. In 2025 I built a different seam.

## What I built

The AI Network Operations Platform is an MCP platform. Custom MCP servers sit in front of the systems engineers already use. Agents call tools on those servers. The person stops being the copy-paste layer between windows.

These are the counts I can stand behind:

- **28** MCP servers
- **about 573** tools
- **44** agents, **23** of which I authored
- **31** skills

The plugin layer is how a person actually starts the work. In that layer I authored **24 of 33** agents, including the firewall review agent and the firewall design agent. I authored **6 of 7** slash commands, and **4** skills. Three of those four skills are knowledge handbooks. The platform has **five** knowledge handbooks, and three of the five are skills I wrote.

Those agent counts are two scopes, and I am leaving them as two scopes. The platform ships 44 agents. I authored 23 of them. The plugin layer holds 33 agents. I authored 24 of those, firewall review and firewall design included. I do not have a separate figure for how the two sets overlap, so I will not publish one.

The short public account is the case study at [/work/ai-network-operations](/work/ai-network-operations). The picture of clients and agents on one side, and servers and tools on the other, is the hub at [/lab/mcp-simulator/](/lab/mcp-simulator/). This post is how I think about the split. Those pages are the thing you can click.

## Servers, tools, agents, skills

Four nouns. They are not interchangeable, and collapsing them is how you end up with a chat window pointed at production.

A **server** is one system, wrapped so an agent can call it. The categories are the ones on the case study: telemetry, source of truth, ticketing, addressing, and change records. A server owns its system. It does not own the job. Twenty-eight servers is the current surface. If a fact lives in a system we have not wrapped, the platform does not have that fact, and the agent should say so.

A **tool** is one operation with a schema. Read this object. List the records that match. Look up an address. Return a structure. About 573 tools across those 28 servers is a wide surface on purpose. The width is what keeps a job inside tools. A tool that tries to be three jobs is how an agent starts wandering, and a surface that is too narrow is how the person ends up back in the old windows, copying the one value the tool forgot. I would rather maintain a lot of small tools than a few clever ones.

An **agent** is a job with a boundary. Review this firewall request. Design this firewall change. The agent has a reason to exist, a set of tools it is allowed to use, and a definition of done. The platform has 44 of those jobs. I wrote 23 of them. The other 21 are part of the platform, and they are not mine to describe line by line. In the plugin layer the authorship is 24 of 33, and the two firewall agents are in the set I wrote. An agent is not a persona with a friendly name. It is a boundary around one job, so "done" means something you can check.

A **skill** is a procedure you can hand to an agent. The platform has 31 skills. Five of them are knowledge handbooks: the written way a job is done, so the steps on Tuesday match the steps on Friday. I wrote four skills in the plugin layer. Three of those four are among the five handbooks. A handbook is a file I can review and diff. A sentence the model invents in the moment is not a procedure, even when it sounds like one.

A **slash command** is the short door into that. Seven ship in the plugin. I wrote six. The command is not the agent. It is how a person starts the job without re-explaining it from scratch every time.

That is the design. Servers expose systems. Tools are the operations. Agents are the jobs. Skills, and the handbooks inside them, are the procedure. Slash commands are how you enter. The case study draws the first half of that in a straight line, servers to tools to agents. The missing piece on that drawing is the procedure and the person, which is the rest of this post.

## The human gate

Reading the network with a model is useful. Letting a model change the network because the prose sounded confident is a design I will not ship.

The firewall review agent is read-only. It gathers the evidence, it runs its checks, and it stops at a person. The walkthrough of that flow, including the cases where it refuses, is its own lab at [/lab/frr-review/](/lab/frr-review/). That lab stays separate from the hub. The shape is the part that belongs here: the agent prepares a case, and a person decides.

The design agent can propose a change. A person approves the proposal before anything is applied. Proposal and approval are different steps. The agent does not get to be both parties.

I hold that line for a boring reason. The value of the review is the evidence. Speed is a side effect. If the person who used to do the job stops looking at the evidence, the platform has made the network less safe and called it progress. So the agent has to show what it read and where it stopped. The person reviews a case. The case is the work product. A paragraph that says "looks fine" is not a case.

The handbooks are the other half of the same gate. Left alone, a model will invent a plausible procedure. On a production network, plausible is the wrong bar. The bar is the procedure the team already agreed to, followed the same way the next time the job shows up. Three of the skills I wrote are handbooks so the procedure is a file, not a vibe. The platform has five handbooks. I wrote three of them. The other two belong to the platform, and their contents stay in the platform.

Under both rules, the agent knows what a tool returns and nothing else. A missing fact comes back as a missing fact. I would rather see the gap than a fluent guess. A gap is something a person can go close. A guess looks like a finding, and findings are how bad changes get approved.

## Outcomes I can and cannot count

I can count the surface. I cannot put a verified number on what the platform has returned, and I will not estimate one.

- Hours a week this takes off a working engineer: NEEDS NUMBER
- People who use it on a normal day: NEEDS NUMBER
- Change in time-to-pickup across the platform: NEEDS NUMBER
- Change in failed changes across the platform: NEEDS NUMBER
- Requests the agents have taken end to end: NEEDS NUMBER

The firewall review flow has its own published before-and-after. Those numbers live on [that lab page](/lab/frr-review/). They stay there. One measured flow is not a result for the other agents, and it is not a result for the platform as a whole.

What I will claim is the part I know from doing the job. The work was already a procedure. The failure mode was a person holding too many systems in their head, and a procedure that drifted every time a new person ran it. MCP made the systems callable. Agents gave each job a boundary. Handbooks kept the procedure stable enough to review. The human at the end is the reason I am willing to put any of this in front of a production network.

The counts, on one page: the [case study](/work/ai-network-operations). The hub, moving: the [MCP lab](/lab/mcp-simulator/). The review, including where it refuses: the [firewall review](/lab/frr-review/).

Brady
