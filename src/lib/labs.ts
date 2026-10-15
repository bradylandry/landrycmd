export const LAB_SLUGS = [
  "mcp-simulator",
  "frr-review",
  "migration-simulator",
  "ring-collapse",
  "airtap-mpls",
] as const;

export type LabSlug = (typeof LAB_SLUGS)[number];

export const LAB_NAMES: Record<LabSlug, string> = {
  "mcp-simulator": "MCP Integration Simulator",
  "frr-review": "Firewall Request Review",
  "migration-simulator": "Zero-Downtime Migration Simulator",
  "ring-collapse": "Ring Collapse Simulator",
  "airtap-mpls": "AirTap MPLS",
};

export function isLabSlug(value: string | null | undefined): value is LabSlug {
  return !!value && (LAB_SLUGS as readonly string[]).includes(value);
}

export function labPath(slug: LabSlug): string {
  return `/lab/${slug}/`;
}

/** Read `?lab=` from a query string. Unknown values are ignored. */
export function readLabParam(search: string): LabSlug | null {
  const value = new URLSearchParams(search).get("lab");
  return isLabSlug(value) ? value : null;
}

/**
 * Where Tab should move inside the dialog.
 * `null` means the browser's own tab order is already inside the trap.
 */
export function tabDestination(
  count: number,
  index: number,
  shift: boolean,
): number | null {
  if (count <= 0) return null;
  if (index < 0) return shift ? count - 1 : 0;
  const atStart = index === 0 && shift;
  const atEnd = index === count - 1 && !shift;
  if (!atStart && !atEnd) return null;
  return shift ? (index - 1 + count) % count : (index + 1) % count;
}
