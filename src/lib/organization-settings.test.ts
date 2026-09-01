import { describe, expect, it } from "vitest";
import { DEFAULT_ORGANIZATION_SETTINGS, parseOrganizationSettings } from "@/lib/organization-settings";

describe("organization settings", () => {
  it("uses documented start-delay defaults", () => {
    expect(DEFAULT_ORGANIZATION_SETTINGS.startDelayWarningDays).toBe(2);
    expect(DEFAULT_ORGANIZATION_SETTINGS.startDelayCriticalDays).toBe(5);
  });

  it("fills missing JSON keys from defaults", () => {
    expect(parseOrganizationSettings({})).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
  });

  it("preserves stored overrides", () => {
    expect(parseOrganizationSettings({ startDelayWarningDays: 1, startDelayCriticalDays: 4, gettingDelayedLeadDays: 2 })).toEqual({
      startDelayWarningDays: 1,
      startDelayCriticalDays: 4,
      gettingDelayedLeadDays: 2,
    });
  });
});
