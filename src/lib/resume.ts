export type ResumeVariant = "network" | "presales";

export interface ResumeSkill {
  label: string;
  items: string;
}

export interface ResumeRole {
  role: string;
  org: string;
  period: string;
  icon: string;
  bullets: string[];
}

export interface ResumeCopy {
  headline: string;
  summary: string;
  skills: ResumeSkill[];
  experience: ResumeRole[];
}

export const EARLY_CAREER: ResumeRole[] = [
  {
    role: "Network Engineer",
    org: "AirTap Communications · Lafayette, LA",
    period: "2010 – 2011",
    icon: "rf",
    bullets: [
      "Designed IP-routed and MPLS technologies over a complex microwave infrastructure.",
      "Obtained ARIN public IP allocations and BGP ASN; implemented multihomed BGP.",
      "Operated VoIP (Cisco Call Manager / PRI), 11 GHz licensed microwave, 3.65 GHz WiMAX, and iDirect satellite systems.",
    ],
  },
  {
    role: "Network Administrator",
    org: "Vision Logistics",
    period: "2008 – 2010",
    icon: "datacenter",
    bullets: [
      "Built and supported 80 virtual servers on VMware 4.0 (Citrix, Exchange 2007, SharePoint, Windows 2008 Domain Controllers).",
      "Led the Exchange 2007 deployment and migration.",
    ],
  },
  {
    role: "Network & RF Engineer",
    org: "Skyrider Communications · West Monroe, LA",
    period: "2007 – 2008",
    icon: "rf",
    bullets: [
      "Designed and installed IP-routed networks (BGP, OSPF, Spanning Tree, VPN) for redundancy and load balancing.",
      "Deployed and maintained licensed and unlicensed wireless networks.",
    ],
  },
  {
    role: "Network & RF Engineer",
    org: "Detel Wireless · Hessmer, LA",
    period: "2005 – 2007",
    icon: "rf",
    bullets: [
      "Project manager for the Lafayette and Evangeline Parish school-district network maintenance contracts.",
      "Deployed and maintained microwave links; supported New Orleans recovery efforts.",
    ],
  },
  {
    role: "Computer Technician 2",
    org: "Iberia Parish School Board · New Iberia, LA",
    period: "2003 – 2005",
    icon: "desktop",
    bullets: [
      "Supported ~5,000 computers and 36 servers across the parish school district.",
      "Maintained computer labs running Windows 2000 Server.",
      "Upgraded servers from Windows NT to Windows 2000.",
      "Supported Novell labs running IPX/SPX networking.",
      "Resolved day-to-day desktop support tickets.",
    ],
  },
];

const coxDc: ResumeRole = {
  role: "Senior Data Center Network Engineer",
  org: "Spectrum (formerly Cox Communications) · National Data Center",
  period: "2021 – Present",
  icon: "arista",
  bullets: [
    "Led the national data center migration from legacy platforms to an Arista spine/leaf fabric across BGP, IS-IS, EVPN/VXLAN, QoS, LACP, and VRRP, spanning Arista, Juniper, and Cisco in one estate.",
    "Led the migration of 60+ routers into a new regional data center in New Orleans with zero downtime, owning architecture, cutover planning, and implementation.",
    "Designed the Infrastructure-as-Code pipeline for the Arista fabric using Ansible and YAML-based declarative configuration; wrote the standards and validation framework the broader engineering team adopted.",
    "Built an AI-driven network automation platform integrating Claude with custom MCP servers across ServiceNow, Nautobot, AWX, Forward Networks, and IPControl, replacing manual change workflows.",
    "Built a Retrieval-Augmented Generation knowledge base on Microsoft Graph API with semantic search, giving engineering and operations source-linked runbooks and change documentation.",
    "Redesigned the Firewall Rule Request workflow through process and systems analysis, reducing a critical operational backlog by 80 percent.",
    "Designed network architecture for Internet-only Wi-Fi across corporate and field offices, and solutions for Avaya SBC on Juniper spine and leaf and 5G Fixed Wireless Access deployments.",
    "Provided Tier IV escalation support for data center, backbone, and metro operations; mentored engineering and operations teams on YAML data modeling and fabric deployments.",
    "Presented the Infrastructure-as-Code pipeline and Arista CloudVision to roughly 25 engineers across the data center engineering department (March 2025), building internal buy-in for the automation standards.",
  ],
};

const coxBackbone: ResumeRole = {
  role: "Senior Backbone Network Engineer",
  org: "Cox Communications",
  period: "2018 – 2021",
  icon: "mx2020",
  bullets: [
    "Supported Juniper backbone routers on the national IP backbone running BGP, IS-IS, LDP, VRRP, QoS, and RSVP.",
    "Led A10 Networks carrier-grade NAT deployments across every regional data center using Ansible-generated configurations.",
    "Led code upgrades across every Juniper MX router on the national IP backbone, and Cisco NCS upgrades across all regional caching centers.",
    "Deployed Juniper PTX10k and Cisco Nexus switches across regional data centers, plus MPC9 line cards in Juniper MX2010 chassis.",
    "Co-authored the Ansible automation standards for the national IP backbone and developed playbooks generating configurations to functional standards.",
    "Ran failover testing of national backbone routers and switches; provided Tier IV escalation support for backbone operations.",
  ],
};

const coxSenior: ResumeRole = {
  role: "Senior Network Engineer",
  org: "Cox Communications",
  period: "2012 – 2018",
  icon: "asr9k",
  bullets: [
    "Led the IGP conversion from OSPF to IS-IS across Greater Louisiana.",
    "Led re-IP and standardization projects across Greater Louisiana and Macon.",
    "Led multiple teams through 7609 to ASR 9k and ASR 9k to Nexus 9k migrations; deployed Cisco NCS 5k routers.",
  ],
};

const coxOps: ResumeRole = {
  role: "Network Operations Engineer",
  org: "Cox Communications",
  period: "2011 – 2012",
  icon: "switch",
  bullets: [
    "Delivered the DOCSIS 3.0 CMTS upgrade improving cable modem service across the market.",
    "Implemented corporate network standards for emerging technologies including L2 MPLS and IPv6.",
    "Owned problem resolution for Cox Business and residential customers.",
  ],
};

function independentRole(disclosed: boolean, variant: ResumeVariant): ResumeRole {
  if (variant === "presales") {
    return {
      role: disclosed
        ? "Co-Founder and Technical Solutions Lead"
        : "Technical Solutions Lead",
      org: disclosed ? "ACADIANA TEK LLC" : "Independent consulting practice · landrycmd",
      period: "2026 – Present",
      icon: "agent",
      bullets: [
        "Co-founded an AI consulting practice; led pre-sales and solutioning, translating business drivers into technology roadmaps and setting direction on what to adopt.",
        "Ran technical discovery across five organizations in four verticals: public accounting, law, wealth management, and industrial distribution.",
        "Led in-person discovery sessions with managing partners, firm principals, and the client's incumbent MSP, mapping the full environment and surfacing constraints before proposing a solution.",
        "Delivered a partner-meeting presentation on AI adoption to a CPA firm's leadership, and technical demonstrations to non-technical decision-makers.",
        "Designed solutions and produced Bills of Materials and Statements of Work with scoped deliverables, cost and labor estimates, to move opportunities to a decision.",
        "Authored the firm's proposal and contract set (MSA, SOW, NDA), routed through outside counsel for regulated clients.",
        "Built a working proof of concept against a client's order and inventory systems to de-risk the engagement before any automation commitment.",
        "Influenced technology selection and built preference for the right platforms, working alongside clients' existing IT providers rather than displacing them.",
        "Architected private LLM and RAG solutions and led enablement and training, a differentiator that complements core networking and infrastructure work.",
      ],
    };
  }

  return {
    role: disclosed
      ? "Co-Founder & Technical Solutions Lead"
      : "Independent AI & Infrastructure Engineer",
    org: disclosed ? "ACADIANA TEK LLC · landrycmd" : "landrycmd",
    period: "2026 – Present",
    icon: "agent",
    bullets: [
      "Designed and shipped remote MCP servers on Azure Container Apps using per-user Microsoft Entra OAuth, replacing shared static API tokens with individually revocable, identity-scoped access.",
      "Built a reusable agent chassis: a common tool, authorization, and telemetry layer that new agent deployments inherit rather than reimplement.",
      "Built a retrieval layer over a Microsoft 365 document library (Graph API + semantic search), exposed to LLM clients as governed read and write tools.",
      "Wrote a static-analysis security auditor for MCP server packages that produces a capability map, risk findings, and a 0–10 score without executing the audited code.",
      "Published open-source AI infrastructure: mcp-audit, jarvis-trading-mcp, and second-brain-template.",
      ...(disclosed
        ? [
            "Co-founded a two-person AI consulting practice delivering these systems to clients under contract, owning discovery, scoping, architecture, delivery, and support.",
          ]
        : []),
    ],
  };
}

const networkDc: ResumeRole = {
  ...coxDc,
  bullets: [
    ...coxDc.bullets.slice(0, 5),
    "Wrote Python and Ansible automation to streamline device onboarding into the network inventory system, keeping it in sync with the IaC inventory through large-scale data center migrations.",
    "Established Ansible automation standards and automated MOP generation, cutting deployment time and giving the operations team a repeatable playbook.",
    "Led code testing on Juniper QFX using the IXIA platform for packet generation and validation of network performance under load.",
    coxDc.bullets[7],
    coxDc.bullets[8],
  ],
};

export function getResume(opts: {
  disclosed?: boolean;
  variant?: ResumeVariant;
}): ResumeCopy {
  const disclosed = opts.disclosed ?? false;
  const variant = opts.variant ?? "network";

  if (variant === "presales") {
    return {
      headline: "Technical Sales Engineer / Network Solutions Architect",
      summary:
        "Network architect and technical consultant with 20 years designing, deploying, and operating Tier 1 service provider and enterprise infrastructure, 15 of them at Cox Communications across the national IP backbone, regional data centers, and metro networks. Translates customer business drivers into technical solutions: runs discovery, presents and demonstrates to engineering and executive stakeholders, and produces the scoped deliverables that move an opportunity to a decision. Deep multivendor experience across Cisco, Juniper, Arista, and Palo Alto, with Infrastructure-as-Code automation and applied AI as differentiators. Known for earning technical credibility with customer architects and turning complex requirements into clear, buildable designs.",
      skills: [
        {
          label: "IP Routing and Service Provider Networking",
          items:
            "IP routing, BGP, OSPF, IS-IS, MPLS, LDP, RSVP, IPv4/IPv6, EVPN, VXLAN, VRRP, LACP, QoS, BFD, carrier-grade NAT, mobile backhaul, metro and DCI transport",
        },
        {
          label: "Platforms",
          items:
            "Juniper Junos (MX, PTX10k, QFX), Cisco NX-OS / IOS-XR / IOS-XE (Nexus 9K, ASR 9K, NCS 5K, Catalyst), Cisco Unified Communications Manager, Arista EOS, Palo Alto PAN-OS, A10 Networks",
        },
        {
          label: "Solution Delivery and Pre-Sales",
          items:
            "Technical discovery, customer presentations and demonstrations, architecture workshops, RFI/RFP response, Bills of Materials, Statements of Work, reference architectures, cost and labor estimates",
        },
        {
          label: "Automation and Infrastructure-as-Code",
          items:
            "Ansible, Python, YAML, Jinja2, Git, AWX, CloudVision (CVP), ServiceNow, Nautobot, Forward Networks, IPControl",
        },
        {
          label: "Cloud and Applied AI",
          items:
            "Azure (Container Apps, Key Vault, Managed Identity, Entra ID), Microsoft 365; LLM/RAG assistants, MCP server design, agent orchestration; Claude, Gemini, GPT, plus open-weight models via Ollama and NVIDIA NIM",
        },
      ],
      experience: [
        independentRole(disclosed, "presales"),
        coxDc,
        coxBackbone,
        coxSenior,
        coxOps,
      ],
    };
  }

  return {
    headline: "Network Engineer / Network and Systems Architect",
    summary:
      "Network engineer and architect with 20 years designing, deploying, and operating Cisco and multivendor infrastructure, 15 of them at Cox Communications' national data center. Leads large-scale data center fabric design and migration across Arista, Juniper, and Cisco, and builds the Infrastructure-as-Code automation that makes those networks repeatable and reliable. Deep hands-on experience across enterprise networking, data center, and security, with applied AI and automation as differentiators. Known for turning complex requirements into clear architectures, mentoring engineering teams, and delivering zero-downtime cutovers at scale.",
    skills: [
      {
        label: "Networking and Routing",
        items: "BGP, OSPF, IS-IS, MPLS, LDP, RSVP, EVPN, VXLAN, VRRP, LACP, QoS, BFD",
      },
      {
        label: "Platforms",
        items:
          "Cisco NX-OS / IOS-XR / IOS-XE (Nexus 9K, ASR 9K, NCS 5K, Catalyst), Cisco Unified Communications Manager, Arista EOS, Juniper Junos, Palo Alto PAN-OS",
      },
      {
        label: "Data Center and Security",
        items:
          "Spine/leaf data center fabric, BGP EVPN/VXLAN, large-scale data center migration, firewall policy design and workflow, network segmentation, multivendor interoperability",
      },
      {
        label: "Automation and Infrastructure-as-Code",
        items:
          "Ansible, Python, YAML, Jinja2, Git, AWX, CloudVision (CVP), ServiceNow, Nautobot, Forward Networks, IPControl, automated MOP generation",
      },
      {
        label: "Cloud",
        items:
          "Azure (Container Apps, Container Registry, Key Vault, Managed Identity, Entra ID), Microsoft 365; working knowledge of AWS and Google Cloud",
      },
      {
        label: "Applied AI",
        items:
          "LLM/RAG assistants, retrieval over Microsoft Graph with semantic search, MCP server design, agent orchestration, eval-driven development; Claude, Gemini, GPT, plus open-weight models via Ollama / NVIDIA NIM",
      },
    ],
    experience: [
      independentRole(disclosed, "network"),
      networkDc,
      coxBackbone,
      coxSenior,
      coxOps,
    ],
  };
}
