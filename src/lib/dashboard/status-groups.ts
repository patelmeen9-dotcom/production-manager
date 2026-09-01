import type { DisplayStatus } from "@/lib/production/engine";

export type StatusGroup = "delayed" | "getting_delayed" | "on_time" | "not_started" | "completed" | "total";

export const STATUS_GROUP_STATUSES: Record<Exclude<StatusGroup, "total">, DisplayStatus[]> = {
  delayed: ["DELAYED", "START_DELAYED"],
  getting_delayed: ["GETTING_DELAYED", "START_WARNING"],
  on_time: ["ON_TIME"],
  not_started: ["NOT_STARTED"],
  completed: ["COMPLETED"],
};

export function parseStatusGroup(value: string | undefined): StatusGroup | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "delayed" || value === "getting_delayed" || value === "on_time" || value === "not_started" || value === "completed" || value === "total") {
    return value;
  }
  return undefined;
}

export function matchesStatusGroup(status: DisplayStatus, group: StatusGroup | undefined): boolean {
  if (!group || group === "total") {
    return true;
  }
  return STATUS_GROUP_STATUSES[group].includes(status);
}

/** Worst-first ordering for live tracking (existing engine statuses). */
export const STATUS_SEVERITY: Record<DisplayStatus, number> = {
  DELAYED: 0,
  START_DELAYED: 1,
  GETTING_DELAYED: 2,
  START_WARNING: 3,
  NOT_STARTED: 4,
  ON_TIME: 5,
  COMPLETED: 6,
  ON_HOLD: 7,
  CANCELLED: 8,
};

export function buildDashboardQuery(
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined | null>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
