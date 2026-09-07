import { describe, expect, it } from "vitest";
import {
  normaliseWakeTime,
  personChoices,
  readRoutingTable,
  targetBySlug,
  targetForAlert,
} from "../../src/utils/routing-table";
import { ROUTING_TABLE_ENTITY } from "../../src/types";
import { createFakeHass, fakeEntity } from "../fake-hass";

/** The shape router 0.7.0 actually publishes (contract §routing table). */
function routingTableEntity(attributes: Record<string, unknown>, state = "2") {
  return fakeEntity(ROUTING_TABLE_ENTITY, state, { attributes });
}

const TARGETS = [
  {
    slug: "leak",
    name: "Water leak",
    alert_entity: "alert.leak_kitchen",
    snooze_minutes: [10, 30],
    allow_acknowledge: true,
    audience: ["person.alice", "notify.hallway_speaker"],
  },
  {
    slug: "doorbell",
    name: "Doorbell",
    alert_entity: null,
    snooze_minutes: [5],
    allow_acknowledge: false,
    audience: ["person.bob"],
  },
];

const PERSONS = [
  { entity_id: "person.alice", wake_time: "06:45:00", summary: true },
  { entity_id: "person.bob", wake_time: null, summary: false },
];

describe("readRoutingTable", () => {
  it("returns undefined when the router does not publish the entity (< 0.7.0)", () => {
    expect(readRoutingTable(createFakeHass())).toBeUndefined();
  });

  it("returns undefined while the entity is unavailable or unknown", () => {
    for (const state of ["unavailable", "unknown"]) {
      const hass = createFakeHass({
        states: [routingTableEntity({ targets: TARGETS, persons: PERSONS }, state)],
      });
      expect(readRoutingTable(hass)).toBeUndefined();
    }
  });

  it("returns undefined when neither attribute is a list", () => {
    const hass = createFakeHass({
      states: [routingTableEntity({ targets: "leak", persons: 3 })],
    });
    expect(readRoutingTable(hass)).toBeUndefined();
  });

  it("parses both closed lists, keeping null alert_entity as null", () => {
    const hass = createFakeHass({
      states: [routingTableEntity({ targets: TARGETS, persons: PERSONS })],
    });
    const table = readRoutingTable(hass);

    expect(table?.targets).toEqual([
      {
        slug: "leak",
        name: "Water leak",
        alertEntity: "alert.leak_kitchen",
        snoozeMinutes: [10, 30],
        allowAcknowledge: true,
        audience: ["person.alice", "notify.hallway_speaker"],
      },
      {
        slug: "doorbell",
        name: "Doorbell",
        alertEntity: null,
        snoozeMinutes: [5],
        allowAcknowledge: false,
        audience: ["person.bob"],
      },
    ]);
    expect(table?.persons).toEqual([
      { entityId: "person.alice", wakeTime: "06:45", summary: true },
      { entityId: "person.bob", wakeTime: null, summary: false },
    ]);
  });

  it("drops malformed rows instead of trusting them", () => {
    const hass = createFakeHass({
      states: [
        routingTableEntity({
          targets: [{ slug: "" }, "leak", null, { slug: "ok", snooze_minutes: [15, "60", 0, -5] }],
          persons: [{ entity_id: "alice" }, { wake_time: "07:00:00" }, { entity_id: "person.ok" }],
        }),
      ],
    });
    const table = readRoutingTable(hass);

    expect(table?.targets.map((target) => target.slug)).toEqual(["ok"]);
    // Only positive whole numbers survive: "60", 0 and -5 are not durations.
    expect(table?.targets[0]?.snoozeMinutes).toEqual([15]);
    expect(table?.persons.map((person) => person.entityId)).toEqual(["person.ok"]);
  });

  it("reports allow_acknowledge as undefined when the router did not say", () => {
    const hass = createFakeHass({
      states: [routingTableEntity({ targets: [{ slug: "leak" }], persons: [] })],
    });
    expect(readRoutingTable(hass)?.targets[0]?.allowAcknowledge).toBeUndefined();
  });
});

describe("normaliseWakeTime", () => {
  it("turns the router's HH:MM:SS into the HH:MM the cards use", () => {
    expect(normaliseWakeTime("07:00:00")).toBe("07:00");
    expect(normaliseWakeTime("6:45")).toBe("06:45");
    expect(normaliseWakeTime(" 23:59:59 ")).toBe("23:59");
  });

  it("returns null for anything that is not a time of day", () => {
    expect(normaliseWakeTime(null)).toBeNull();
    expect(normaliseWakeTime(700)).toBeNull();
    expect(normaliseWakeTime("24:00:00")).toBeNull();
    expect(normaliseWakeTime("07:60:00")).toBeNull();
    expect(normaliseWakeTime("morning")).toBeNull();
  });
});

describe("target lookups", () => {
  const hass = createFakeHass({
    states: [routingTableEntity({ targets: TARGETS, persons: PERSONS })],
  });
  const table = readRoutingTable(hass);

  it("finds the target that owns an alert entity", () => {
    expect(targetForAlert(table, "alert.leak_kitchen")?.slug).toBe("leak");
    expect(targetForAlert(table, "alert.unmapped")).toBeUndefined();
    expect(targetForAlert(undefined, "alert.leak_kitchen")).toBeUndefined();
  });

  it("never matches a target whose alert_entity is null", () => {
    // `null` must not be treated as "matches anything missing".
    expect(targetForAlert(table, "")).toBeUndefined();
  });

  it("finds a target by slug", () => {
    expect(targetBySlug(table, "doorbell")?.name).toBe("Doorbell");
    expect(targetBySlug(table, "nope")).toBeUndefined();
  });
});

describe("personChoices", () => {
  it("names each person from its person.* state", () => {
    const hass = createFakeHass({
      states: [
        routingTableEntity({ targets: TARGETS, persons: PERSONS }),
        fakeEntity("person.alice", "home", { attributes: { friendly_name: "Alice" } }),
      ],
    });
    expect(personChoices(readRoutingTable(hass), hass)).toEqual([
      { entityId: "person.alice", name: "Alice" },
      // Bob has no state object: offered anyway, under its entity id.
      { entityId: "person.bob", name: "person.bob" },
    ]);
  });

  it("returns an empty list without a routing table", () => {
    expect(personChoices(undefined, createFakeHass())).toEqual([]);
  });
});
