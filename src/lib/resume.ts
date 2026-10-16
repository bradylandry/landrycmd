import {
  loadDisclosedRole as readDisclosedRole,
  type DisclosedRole,
  type DisclosedRoleCopy,
} from "./private-config.mjs";

export type { DisclosedRole, DisclosedRoleCopy };
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

const employer = "Charter/Spectrum (formerly Cox Communications)";

const fabricMigration =
  "Led the national data center migration from legacy platforms to an Arista spine/leaf fabric across BGP, IS-IS, EVPN/VXLAN, QoS, LACP, and VRRP, spanning Arista, Juniper, and Cisco in one estate.";
const regionalCutover =
  "Led the migration of 60+ routers into a new regional data center in New Orleans with zero downtime, owning architecture, cutover planning, and implementation.";
const iacScale =
  "Ran Infrastructure-as-Code for 440+ devices across 29 sites, cutting deploy time from 4–8 hours to 15–30 minutes with zero automation-caused incidents.";
const aiPlatform =
  "Built the AI network-operations platform: 28 MCP servers, about 573 tools, 44 agents, and 31 skills. Authored 23 of the shipping agents, including the firewall review and design agents.";
const firewallReview =
  "Built the firewall-request review: backlog from 200 to about 40, and review time from 30–60 minutes to 3–5 minutes.";
const runbookGenerator =
  "Built an Ansible runbook generator that replaced hand-written per-market procedures. Hours saved per deployment: NEEDS NUMBER.";
const automationLineage =
  "Eleven-year automation lineage: a spreadsheet config generator in 2014, Ansible in 2019–20, a runbook generator in 2021, and the MCP platform in 2025.";
const ragKnowledge =
  "Built a Retrieval-Augmented Generation knowledge base on Microsoft Graph API with semantic search, giving engineering and operations source-linked runbooks and change documentation.";
const officeAccess =
  "Designed network architecture for Internet-only Wi-Fi across corporate and field offices, and solutions for Avaya SBC on Juniper spine and leaf and 5G Fixed Wireless Access deployments.";
const mentoring =
  "Provided Tier IV escalation support for data center, backbone, and metro operations; mentored engineering and operations teams on YAML data modeling and fabric deployments.";
const iacPresentation =
  "Presented the Infrastructure-as-Code pipeline and Arista CloudVision to roughly 25 engineers across the data center engineering department (March 2025), building internal buy-in for the automation standards.";
const deviceOnboarding =
  "Wrote Python and Ansible automation to streamline device onboarding into the network inventory system, keeping it in sync with the IaC inventory through large-scale data center migrations.";
const loadTesting =
  "Led code testing on Juniper QFX using the IXIA platform for packet generation and validation of network performance under load.";

const coxDc: ResumeRole = {
  role: "Senior Data Center Network Engineer",
  org: `${employer} · National Data Center`,
  period: "2021 – Present",
  icon: "arista",
  bullets: [
    fabricMigration,
    regionalCutover,
    iacScale,
    aiPlatform,
    firewallReview,
    runbookGenerator,
    automationLineage,
    ragKnowledge,
    officeAccess,
    mentoring,
    iacPresentation,
  ],
};

const coxBackbone: ResumeRole = {
  role: "Senior Backbone Network Engineer",
  org: employer,
  period: "2018 – 2021",
  icon: "mx2020",
  bullets: [
    "Supported Juniper backbone routers on the national IP backbone running BGP, IS-IS, LDP, VRRP, QoS, and RSVP.",
    "Owned the carrier-grade NAT deployment program across about 17 markets.",
    "Wrote the statements of work and procedures for 5 national peering centers.",
    "Led code upgrades across every Juniper MX router on the national IP backbone, and Cisco NCS upgrades across all regional caching centers.",
    "Deployed Juniper PTX10k and Cisco Nexus switches across regional data centers, plus MPC9 line cards in Juniper MX2010 chassis.",
    "Co-authored the Ansible automation standards for the national IP backbone and developed playbooks generating configurations to functional standards.",
    "Ran failover testing of national backbone routers and switches; provided Tier IV escalation support for backbone operations.",
  ],
};

const coxSenior: ResumeRole = {
  role: "Senior Network Engineer",
  org: employer,
  period: "2012 – 2018",
  icon: "asr9k",
  bullets: [
    "Led the OSPF to IS-IS migration for 4 markets (87 CMTS) inside an 18-market, 536-CMTS program.",
    "Wrote the switch-replacement procedures for NEEDS NUMBER markets.",
    "Designed a capacity-first metro ring collapse for two markets.",
    "Developed an election-based Layer 2 and Layer 3 migration method: zero traffic lost, and rollback is one priority change.",
    "Cut voice over in under 3 seconds per VLAN with zero dropped calls.",
    "Led re-IP and standardization projects across multiple markets.",
    "Led multiple teams through 7609 to ASR 9k and ASR 9k to Nexus 9k migrations; deployed Cisco NCS 5k routers.",
  ],
};

const coxOps: ResumeRole = {
  role: "Network Operations Engineer",
  org: employer,
  period: "2011 – 2012",
  icon: "switch",
  bullets: [
    "Delivered the DOCSIS 3.0 CMTS upgrade improving cable modem service across the market.",
    "Implemented corporate network standards for emerging technologies including L2 MPLS and IPv6.",
    "Owned problem resolution for business and residential customers.",
  ],
};

function applyDisclosure(
  role: ResumeRole,
  disclosed: boolean,
  extra: DisclosedRole | undefined,
): ResumeRole {
  if (!disclosed || !extra) return role;
  return {
    ...role,
    role: extra.role,
    org: extra.org,
    bullets: [...role.bullets, ...extra.bullets],
  };
}

function independentRole(
  disclosed: boolean,
  variant: ResumeVariant,
  overlay: DisclosedRoleCopy | null,
): ResumeRole {
  if (variant === "presales") {
    return applyDisclosure(
      {
        role: "Technical Solutions Lead",
        org: "Independent consulting practice · landrycmd",
        period: "2026 – Present",
        icon: "agent",
        bullets: [],
      },
      disclosed,
      overlay?.presales,
    );
  }

  return applyDisclosure(
    {
      role: "Independent AI & Infrastructure Engineer",
      org: "landrycmd",
      period: "2026 – Present",
      icon: "agent",
      bullets: [
        "Designed and shipped remote MCP servers on Azure Container Apps using per-user Microsoft Entra OAuth, replacing shared static API tokens with individually revocable, identity-scoped access.",
        "Built a reusable agent chassis: a common tool, authorization, and telemetry layer that new agent deployments inherit rather than reimplement.",
        "Built a retrieval layer over a Microsoft 365 document library (Graph API + semantic search), exposed to LLM clients as governed read and write tools.",
        "Wrote a static-analysis security auditor for MCP server packages that produces a capability map, risk findings, and a 0–10 score without executing the audited code.",
        "Published open-source AI infrastructure: mcp-audit, jarvis-trading-mcp, and second-brain-template.",
      ],
    },
    disclosed,
    overlay?.network,
  );
}

export function loadDisclosedRole(raw?: string): DisclosedRoleCopy | null {
  return readDisclosedRole(raw);
}

const networkDc: ResumeRole = {
  ...coxDc,
  bullets: [
    aiPlatform,
    firewallReview,
    runbookGenerator,
    iacScale,
    automationLineage,
    fabricMigration,
    regionalCutover,
    deviceOnboarding,
    loadTesting,
    ragKnowledge,
    mentoring,
    iacPresentation,
  ],
};

export function getResume(opts: {
  disclosed?: boolean;
  variant?: ResumeVariant;
  disclosedRole?: DisclosedRoleCopy | null;
}): ResumeCopy {
  const disclosed = opts.disclosed ?? false;
  const variant = opts.variant ?? "network";
  const overlay = !disclosed
    ? null
    : opts.disclosedRole !== undefined
      ? opts.disclosedRole
      : loadDisclosedRole();
  if (disclosed && !overlay) {
    throw new Error("DISCLOSED_ROLE_JSON unavailable");
  }

  if (variant === "presales") {
    return {
      headline: "Technical Sales Engineer / Network Solutions Architect",
      summary:
        "Network architect and technical consultant with 20 years designing, deploying, and operating Tier 1 service provider and enterprise infrastructure, 15 of them at Charter/Spectrum (formerly Cox Communications) across the national IP backbone, regional data centers, and metro networks. Translates customer business drivers into technical solutions: runs discovery, presents and demonstrates to engineering and executive stakeholders, and produces the scoped deliverables that move an opportunity to a decision. Deep multivendor experience across Cisco, Juniper, Arista, and Palo Alto, with Infrastructure-as-Code automation and applied AI as differentiators. Known for earning technical credibility with customer architects and turning complex requirements into clear, buildable designs.",
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
            "Ansible, Python, YAML, Jinja2, Git, CloudVision (CVP)",
        },
        {
          label: "Cloud and Applied AI",
          items:
            "Azure (Container Apps, Key Vault, Managed Identity, Entra ID), Microsoft 365; LLM/RAG assistants, MCP server design, agent orchestration; Claude, Gemini, GPT, plus open-weight models via Ollama and NVIDIA NIM",
        },
      ],
      experience: [
        independentRole(disclosed, "presales", overlay),
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
      "Network engineer and architect with 20 years designing, deploying, and operating Cisco and multivendor infrastructure, 15 of them at Charter/Spectrum (formerly Cox Communications), in the national data center. Leads large-scale data center fabric design and migration across Arista, Juniper, and Cisco, and builds the Infrastructure-as-Code automation that makes those networks repeatable and reliable. Deep hands-on experience across enterprise networking, data center, and security, with applied AI and automation as differentiators. Known for turning complex requirements into clear architectures, mentoring engineering teams, and delivering zero-downtime cutovers at scale.",
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
          "Ansible, Python, YAML, Jinja2, Git, CloudVision (CVP), automated MOP generation",
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
      independentRole(disclosed, "network", overlay),
      networkDc,
      coxBackbone,
      coxSenior,
      coxOps,
    ],
  };
}
