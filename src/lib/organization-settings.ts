/**
 * Organization-level configurable thresholds.
 * Defaults match PRODUCTION_SAAS_RULES.md §§7 and 21.
 *
 * Do not duplicate these numbers in UI or API routes.
 */
export type OrganizationSettings = {
  /** Elapsed days after effective start before a not-started order is a warning. */
  startDelayWarningDays: number;
  /** Elapsed days after effective start before a not-started order is critical/delayed start. */
  startDelayCriticalDays: number;
  /**
   * When production has started: if estimated completion is after due date
   * but due date has not yet passed, treat as GETTING_DELAYED when the
   * estimated overrun is at least this many days. Documented default for Phase 8.
   */
  gettingDelayedLeadDays: number;
};

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  startDelayWarningDays: 2,
  startDelayCriticalDays: 5,
  gettingDelayedLeadDays: 3,
};

export function parseOrganizationSettings(value: unknown): OrganizationSettings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    startDelayWarningDays: numberOrDefault(record.startDelayWarningDays, DEFAULT_ORGANIZATION_SETTINGS.startDelayWarningDays),
    startDelayCriticalDays: numberOrDefault(
      record.startDelayCriticalDays,
      DEFAULT_ORGANIZATION_SETTINGS.startDelayCriticalDays,
    ),
    gettingDelayedLeadDays: numberOrDefault(record.gettingDelayedLeadDays, DEFAULT_ORGANIZATION_SETTINGS.gettingDelayedLeadDays),
  };
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
