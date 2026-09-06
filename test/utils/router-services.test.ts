import { describe, expect, it } from "vitest";
import { hasRouterService, resolveTargetSlug } from "../../src/utils/router-services";
import { createFakeHass } from "../fake-hass";

describe("hasRouterService", () => {
  it("returns false when the notify_switchboard domain is absent", () => {
    const hass = createFakeHass({ services: {} });
    expect(hasRouterService(hass, "acknowledge")).toBe(false);
  });

  it("returns false when the domain exists but the service does not (0.1.x)", () => {
    const hass = createFakeHass({ services: { notify_switchboard: {} } });
    expect(hasRouterService(hass, "snooze")).toBe(false);
  });

  it("returns true once the router registers the service (0.2.0+)", () => {
    const hass = createFakeHass({ services: { notify_switchboard: { snooze: {} } } });
    expect(hasRouterService(hass, "snooze")).toBe(true);
  });
});

describe("resolveTargetSlug", () => {
  it("returns the mapped slug", () => {
    expect(resolveTargetSlug("alert.leak", { "alert.leak": "leak" })).toBe("leak");
  });

  it("returns undefined when unmapped", () => {
    expect(resolveTargetSlug("alert.leak", {})).toBeUndefined();
    expect(resolveTargetSlug("alert.leak", undefined)).toBeUndefined();
  });
});
