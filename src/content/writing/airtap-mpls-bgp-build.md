---
title: "The MPLS network I built at AirTap"
description: "In 2010 and 2011 I was the only network engineer at AirTap in Lafayette. I built the MPLS and multi-protocol BGP network, put every customer in its own VRF, and carried Gulf traffic from microwave onto Time Warner and AT&T."
date: 2026-10-15
draft: true
tags: [mpls, bgp, airtap, microwave]
---

In 2010 I went to work as a network engineer at AirTap Communications in Lafayette, Louisiana. I was there through 2011. I was the only network engineer. One other engineer handled wireless. The routed network was mine: the design, the build, and the call when it broke.

The customers were not all in town. A lot of the traffic started offshore, on rigs in the Gulf of Mexico, and it had to end in that customer's own data center as that customer's traffic. Between those two points it crossed microwave, then our routers, then someone else's fiber. Keeping those customers apart, on shared routers, was the actual product.

## The routers and the table

I designed and built the MPLS network, and I built it with multi-protocol BGP. Single-handed. There was no second network engineer to split the design with. I drew it, I specified the hardware around it, and I turned it up.

The routers already in the network were not going to carry MPLS and the full BGP table. I upgraded every one of them to a Cisco 7200. Every router had to be a 7200 before the design was real. How many that was: NEEDS NUMBER.

The 7200s were the core everything else hung on. They held the full BGP table. They ran MPLS. A customer VRF terminated there, and a customer VRF left from there toward wherever that customer actually lived.

I went to ARIN for our own public IP space and our own BGP ASN. The prefix length: NEEDS NUMBER. The ASN: NEEDS NUMBER. They were ours, announced by us, which is the part that mattered. Borrowed space would have left the multihoming story dependent on someone else's aggregate.

BGP was multihomed through two egress points. One provider having a bad day was not supposed to take the customers off the internet. Both exits were in use. That was the availability design.

## One VRF per customer

Every customer had its own VRF. That was the rule. It was not a feature I turned on for the complicated accounts.

A VRF is a separate routing table on a shared router. One customer's routes sit in one table. The next customer's routes sit in another. They can reuse the same private addresses and never see each other. AirTap was carrying companies that had nothing to do with each other. Separation was the service. A shared table with access lists on top would have been a promise. A VRF is a table.

MPLS was how a VRF on one 7200 showed up as the same VRF on the next 7200. Multi-protocol BGP carried the customer routes between our routers and kept each set attached to its own table. A route did not get to wander into the global table and hope an access list caught it.

EIGRP did the other half. Inside a customer's VRF, EIGRP moved that customer's routes between the AirTap edge and the customer's own routers. BGP across our core kept the VRFs distinct from each other. EIGRP at the edge kept a customer's interior routes inside that customer's table. A route learned in one VRF had no path into the next VRF unless someone built one on purpose. I wanted a leak to look like a mistake in the config, not like the default behavior of one big table.

Customers also wanted the same VRF in their own data center. I extended it. The handoff was whatever MPLS connection that customer could actually buy. I did not get to pick a single circuit type and make every customer match it. The VRF still had to arrive as that VRF. How many customers, and how many of those extensions: NEEDS NUMBER.

## From a rig to the fiber

The path starts offshore. A site on a Gulf rig sent traffic over point-to-point microwave. The microwave landed on the 7200s. From the 7200s the traffic crossed Time Warner and AT&T fiber MPLS. The VRFs stayed separated on the far side of that fiber, same as they were on our routers.

That is the path. Rig, point-to-point microwave, 7200, Time Warner and AT&T fiber MPLS. Capacity on that path: NEEDS NUMBER. How many rigs: NEEDS NUMBER.

The scale I can point at is the planning map. Site points on that map: NEEDS NUMBER. Point-to-point links on that map: NEEDS NUMBER. How many of those points were a paying customer on a given day: NEEDS NUMBER.

## What sat around the core

The routed core was my job. It was not the whole company. The other engineer handled wireless, and that plant is what fed the VRFs.

Licensed microwave at 11 GHz carried the point-to-point shots. Where the design called for a sector instead of a shot, the plan was 3.65 GHz WiMAX. Channel count: NEEDS NUMBER. Sites that microwave and WiMAX were not going to reach came in on iDirect satellite. His day was the radios. My day was the routed core. The two met at the 7200s. A VRF did not care whether the last hop had been a microwave shot, a WiMAX sector, or a satellite link. It cared that the routes landed in the right table, and that they stayed there.

Voice rode the same network. Cisco Call Manager, with PRI where we handed off to the phone company. I operated it along with the rest of the routed side. Station count: NEEDS NUMBER. Trunk count: NEEDS NUMBER.

## A year, one engineer

A year is a short time to design a network and also be the person who answers when it fails. The constraint helped. With nobody to hand the MPLS design to, the design had to be one I could operate alone, at night, without a second person who remembered why a VRF existed.

One VRF per customer. Two egresses. A 7200 everywhere the core needed MPLS and the full BGP table. BGP between our routers, EIGRP inside the customer, and a microwave shot when the customer was on a rig in the Gulf. Public address space and an ASN from ARIN, so the multihoming was ours.

The drawing of that network is the lab at [/lab/airtap-mpls/](/lab/airtap-mpls/).

Brady
