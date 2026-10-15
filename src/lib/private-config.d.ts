export interface Application {
  token?: string;
  company: string;
  role: string;
  sent: string;
  status: "prepared" | "held" | "applied" | "rejected";
  req?: string;
  note?: string;
  url?: string;
  /** Name the firm on this application's résumé. Unlisted routes only. */
  disclosed?: boolean;
  /** Public /resume is network. Some packets use presales. */
  variant?: "network" | "presales";
}

export interface AcadianaTekRole {
  role: string;
  org: string;
  bullets: string[];
}

export interface AcadianaTekCopy {
  network: AcadianaTekRole;
  presales: AcadianaTekRole;
}

export type ApplicationsLoad =
  | { ok: true; applications: Application[] }
  | { ok: false; reason: "missing" | "invalid" };

export function loadApplications(raw?: string): ApplicationsLoad;

export function findApplication(
  token: string,
  applications?: Application[],
): Application | undefined;

export function loadAcadianaTekCopy(raw?: string): AcadianaTekCopy | null;
