---
title: "The same handoff, from a spreadsheet to agents"
description: "From 2014 to 2025 the tools changed: a spreadsheet config generator, Ansible, a runbook generator, then an MCP platform. The job did not. Land the national program, then hand operations something they can run."
date: 2026-10-15
draft: true
tags: [automation, network-operations, ansible, mcp]
---

The job has had the same shape since I moved into network operations in 2011. A national program exists. Someone has decided how a thing should be built, for a lot of markets at once. My work was to make that thing real in the market in front of me, and then hand it to operations in a form they could run after I had left.

I was the execution owner on the programs assigned to me. I was not always the owner of the tool that produced the config or the procedure. The tools I can date run from a spreadsheet in 2014 to an MCP platform in 2025.

## Regional network operations, 2011 to 2018

From 2011 to 2018 I was in regional network operations at Charter/Spectrum (formerly Cox). A program arrived as a standard: how the market was supposed to look, and the method for getting it there. The standard was written so it could be repeated. It still had to become config for one market, and a procedure the local team could follow at night without calling the person who wrote the method.

In 2014 the generator I had for that config was a spreadsheet. The variables for the market went into the sheet. The sheet emitted the config. Typing the same stanzas by hand is how two markets that are supposed to match end up different in the one line nobody meant to change. The sheet made the repeated parts come out the same way.

I used that sheet to land the programs I was responsible for. Execution was mine. I was not the sheet's only author, and I don't have a record of everyone else who touched it. Markets that went through it: NEEDS NUMBER. Hours it saved against hand-built config: NEEDS NUMBER.

The rest of those years was the same motion. A method comes down. I make it fit the market. I write down how to run it. I do the work with the people who will own it afterward. Then I leave. Config from the sheet drifted less than the prose I had typed around it. The prose was where the handoff broke, and that gap is what the later tools were for.

## National backbone integration, 2018 to 2021

From 2018 to 2021 I worked national backbone integration. The programs were national on purpose. A deployment had to look the same in every market it touched. My piece was still the landing: make it real on the routers it was written for, and leave operations a way to do the next one without me in the room.

Ansible arrived in that work in 2019 and 2020. I co-authored the automation standards for the national IP backbone, and I developed playbooks that generated configurations to those standards. The standards were shared. I was one of the people who wrote them, and I executed against them. I did not own the toolchain, and I did not write every playbook that ran.

A spreadsheet generated a config for the market I was sitting in. A playbook generated that config from the same source the next market would use, and the next person could run it. Operations inherited the thing that produced the config, not a description of what I had typed.

Hours saved, and defects avoided: NEEDS NUMBER.

## The runbook generator, 2021

In 2021 I built a runbook generator on top of that Ansible work. I built this one. It replaced a hand-written procedure for each market. Same program, a different document every time, half the difference intentional and half drift. Per-market facts went in. A procedure came out, and the people running the change followed that procedure instead of a local rewrite.

2021 is also when I moved into national data center sustaining, which is the job I still have. The generator was aimed at the handoff that kept slipping: the procedure, not just the config. Building it did not make me the owner of every program that could have used it. I executed the work assigned to me. Other people executed other markets, and other people owned other tools.

Hours saved per deployment: NEEDS NUMBER. Deployments that ran from a generated runbook that year: NEEDS NUMBER.

## The platform, 2025

Data center sustaining is the same motion at a different altitude. A national design has to land on real devices at real sites, and operations is who lives with the result. I own execution for the work that is mine. A lot of the standards I execute were written by other people, and a lot of the tools in the path are not mine.

In 2025 the next layer was the AI Network Operations Platform. MCP servers in front of the systems engineers already use. Tools with schemas. Agents for the jobs. Skills for the procedures. A person at the end of anything that changes the network.

The counts, and which agents I authored, are the [case study](/work/ai-network-operations). The hub is the [MCP lab](/lab/mcp-simulator/). The review flow is the [firewall review](/lab/frr-review/). What belongs in this lineage is why that shape showed up when it did.

A spreadsheet made a config repeatable if the sheet was filled in right. Ansible made a config repeatable if someone ran the playbook. A runbook generator made the procedure repeatable if the inputs were right. An agent with a handbook can walk the procedure against the live systems and show the evidence. It still stops at a person. The handoff was that operations can do the job when I am not the one holding the context.

Platform-wide impact, in hours or in incidents: NEEDS NUMBER.

## What stayed the same

In 2014 a spreadsheet emitted the config, and I worked from it. In 2019 and 2020 playbooks emitted the config from standards I co-authored. In 2021 a generator I built emitted the runbook. In 2025 agents walk the procedure and stop before they change the network.

Under all four, the job was the same. Take the national program. Make it true where it has to run. Hand operations something they can repeat. Build a tool when the handoff is the part that keeps breaking, and leave the shared tools as shared.

The test is the night it runs without me. As a number, that test is NEEDS NUMBER.

Brady
