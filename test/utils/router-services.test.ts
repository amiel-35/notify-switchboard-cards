import { describe, expect, it } from "vitest";
import {
  hasRouterService,
  resolveAlertTarget,
  resolveTargetSlug,
} from "../../src/utils/router-services";
import { readRoutingTable } from "../../src/utils/routing-table";
import { DEFAULT_SNOOZE_MINUTES, ROUTING_TABLE_ENTITY } from "../../src/types";
import { createFakeHass, fakeEntity } from "../fake-hass";

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

describe("resolveAlertTarget", () => {
  const table = readRoutingTable(
    createFakeHass({
      states: [
        fakeEntity(ROUTING_TABLE_ENTITY, "2", {
          attributes: {
            targets: [
              {
                slug: "leak",
                alert_entity: "alert.leak_kitchen",
                snooze_minutes: [10, 30],
                allow_acknowledge: true,
                audience: [],
              },
              {
                slug: "doorbell",
                alert_entity: "alert.doorbell",
                snooze_minutes: [5],
                allow_acknowledge: false,
                audience: [],
              },
            ],
            persons: [],
          },
        }),
      ],
    }),
  );

  it("derives the slug from the routing table when no target_map is configured", () => {
    const resolved = resolveAlertTarget("alert.leak_kitchen", {}, table);
    expect(resolved.slug).toBe("leak");
    expect(resolved.source).toBe("routing_table");
  });

  it("derives that target's own snooze durations", () => {
    expect(resolveAlertTarget("alert.leak_kitchen", {}, table).snoozeMinutes).toEqual([10, 30]);
    expect(resolveAlertTarget("alert.doorbell", {}, table).snoozeMinutes).toEqual([5]);
  });

  it("derives allow_acknowledge, defaulting to allowed when unstated", () => {
    expect(resolveAlertTarget("alert.leak_kitchen", {}, table).allowAcknowledge).toBe(true);
    expect(resolveAlertTarget("alert.doorbell", {}, table).allowAcknowledge).toBe(false);
    expect(resolveAlertTarget("alert.unmapped", {}, table).allowAcknowledge).toBe(true);
  });

  it("lets the card's own options override the routing table", () => {
    const resolved = resolveAlertTarget(
      "alert.leak_kitchen",
      { targetMap: { "alert.leak_kitchen": "doorbell" }, snoozeMinutes: [45] },
      table,
    );
    expect(resolved.slug).toBe("doorbell");
    expect(resolved.source).toBe("config");
    expect(resolved.snoozeMinutes).toEqual([45]);
    // The overridden slug still carries that target's own permission.
    expect(resolved.allowAcknowledge).toBe(false);
  });

  it("behaves exactly like 0.1.x with no routing table", () => {
    expect(resolveAlertTarget("alert.leak_kitchen", {}, undefined)).toEqual({
      slug: undefined,
      source: "none",
      allowAcknowledge: true,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    });
    expect(
      resolveAlertTarget(
        "alert.leak_kitchen",
        { targetMap: { "alert.leak_kitchen": "leak" } },
        undefined,
      ),
    ).toEqual({
      slug: "leak",
      source: "config",
      allowAcknowledge: true,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    });
  });

  it("falls back to the built-in durations for a target the table does not name", () => {
    expect(resolveAlertTarget("alert.unmapped", {}, table).snoozeMinutes).toEqual(
      DEFAULT_SNOOZE_MINUTES,
    );
  });
});
