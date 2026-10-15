export function decodeEnvJson(value: string): string;

export function serverEnv(name: string): string;

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

export interface DisclosedRole {
  role: string;
  org: string;
  bullets: string[];
}

export interface DisclosedRoleCopy {
  network: DisclosedRole;
  presales: DisclosedRole;
}

export type ApplicationsLoad =
  | { ok: true; applications: Application[] }
  | { ok: false; reason: "missing" | "invalid" };

export function loadApplications(raw?: string): ApplicationsLoad;

export function findApplication(
  token: string,
  applications?: Application[],
): Application | undefined;

export function loadDisclosedRole(raw?: string): DisclosedRoleCopy | null;
