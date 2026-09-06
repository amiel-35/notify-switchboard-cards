import { afterEach, describe, expect, it } from "vitest";
import "../src/cards/alerts-card/switchboard-alerts-card";
import type { SwitchboardAlertsCard } from "../src/cards/alerts-card/switchboard-alerts-card";
import type { SwitchboardAlertsCardConfig } from "../src/types";
import { createFakeHass, fakeEntity } from "./fake-hass";

async function mountCard(
  config: SwitchboardAlertsCardConfig,
  hass: ReturnType<typeof createFakeHass>,
): Promise<SwitchboardAlertsCard> {
  const card = document.createElement("switchboard-alerts-card") as SwitchboardAlertsCard;
  card.setConfig(config);
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

function buttonWithText(card: SwitchboardAlertsCard, text: string): HTMLButtonElement | undefined {
  const buttons = Array.from(card.shadowRoot?.querySelectorAll("button") ?? []);
  return buttons.find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
}

describe("switchboard-alerts-card rendering", () => {
  let cards: SwitchboardAlertsCard[] = [];

  afterEach(() => {
    for (const card of cards) card.remove();
    cards = [];
  });

  it("shows the empty state when every alert is idle", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("alert.leak", "idle")],
    });
    const card = await mountCard({ type: "custom:switchboard-alerts-card", mode: "full" }, hass);
    cards.push(card);

    const html = card.shadowRoot?.innerHTML ?? "";
    expect(html).toContain("No active alerts");
  });

  it("lists active and acknowledged alerts, hiding idle ones", async () => {
    const hass = createFakeHass({
      states: [
        fakeEntity("alert.leak", "on", { attributes: { friendly_name: "Leak" } }),
        fakeEntity("alert.door", "off", { attributes: { friendly_name: "Door" } }),
        fakeEntity("alert.calm", "idle", { attributes: { friendly_name: "Calm" } }),
      ],
    });
    const card = await mountCard(
      { type: "custom:switchboard-alerts-card", mode: "full", show_acknowledged: true },
      hass,
    );
    cards.push(card);

    const rows = card.shadowRoot?.querySelectorAll(".alert-row");
    expect(rows?.length).toBe(2);
    const html = card.shadowRoot?.innerHTML ?? "";
    expect(html).toContain("Leak");
    expect(html).toContain("Door");
    expect(html).not.toContain("Calm");
  });

  it("hides acknowledged alerts when show_acknowledged is false", async () => {
    const hass = createFakeHass({
      states: [
        fakeEntity("alert.leak", "on", { attributes: { friendly_name: "Leak" } }),
        fakeEntity("alert.door", "off", { attributes: { friendly_name: "Door" } }),
      ],
    });
    const card = await mountCard(
      { type: "custom:switchboard-alerts-card", mode: "full", show_acknowledged: false },
      hass,
    );
    cards.push(card);

    const rows = card.shadowRoot?.querySelectorAll(".alert-row");
    expect(rows?.length).toBe(1);
    expect(card.shadowRoot?.innerHTML).toContain("Leak");
  });

  it("shows active and acknowledged counts on the compact badge", async () => {
    const hass = createFakeHass({
      states: [
        fakeEntity("alert.leak", "on"),
        fakeEntity("alert.door", "on"),
        fakeEntity("alert.fountain", "off"),
      ],
    });
    const card = await mountCard({ type: "custom:switchboard-alerts-card", mode: "compact" }, hass);
    cards.push(card);

    const counts = Array.from(card.shadowRoot?.querySelectorAll(".badge-count") ?? []).map((el) =>
      el.textContent?.trim(),
    );
    expect(counts).toEqual(["2", "1"]);
  });

  it("opens a dialog listing alerts when the compact badge is activated", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("alert.leak", "on", { attributes: { friendly_name: "Leak" } })],
    });
    const card = await mountCard({ type: "custom:switchboard-alerts-card", mode: "compact" }, hass);
    cards.push(card);

    expect(card.shadowRoot?.querySelector('[role="dialog"]')).toBeNull();

    card.shadowRoot?.querySelector<HTMLButtonElement>(".badge")?.click();
    await card.updateComplete;

    const dialog = card.shadowRoot?.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Leak");
  });
});

describe("switchboard-alerts-card acknowledge routing", () => {
  let cards: SwitchboardAlertsCard[] = [];

  afterEach(() => {
    for (const card of cards) card.remove();
    cards = [];
  });

  it("falls back to alert.turn_off when the router service is absent", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("alert.leak", "on", { attributes: { friendly_name: "Leak" } })],
      services: {},
    });
    const card = await mountCard(
      {
        type: "custom:switchboard-alerts-card",
        mode: "full",
        target_map: { "alert.leak": "leak" },
      },
      hass,
    );
    cards.push(card);

    buttonWithText(card, "Acknowledge")?.click();
    await card.updateComplete;

    expect(hass.callService).toHaveBeenCalledWith("alert", "turn_off", { entity_id: "alert.leak" });
  });

  it("calls notify_switchboard.acknowledge when the router service and slug are both available", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("alert.leak", "on", { attributes: { friendly_name: "Leak" } })],
      services: { notify_switchboard: { acknowledge: {} } },
    });
    const card = await mountCard(
      {
        type: "custom:switchboard-alerts-card",
        mode: "full",
        target_map: { "alert.leak": "leak" },
      },
      hass,
    );
    cards.push(card);

    buttonWithText(card, "Acknowledge")?.click();
    await card.updateComplete;

    expect(hass.callService).toHaveBeenCalledWith("notify_switchboard", "acknowledge", {
      target: "leak",
    });
  });

  it("still falls back to alert.turn_off when the service exists but no slug is mapped", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("alert.leak", "on", { attributes: { friendly_name: "Leak" } })],
      services: { notify_switchboard: { acknowledge: {} } },
    });
    const card = await mountCard({ type: "custom:switchboard-alerts-card", mode: "full" }, hass);
    cards.push(card);

    buttonWithText(card, "Acknowledge")?.click();
    await card.updateComplete;

    expect(hass.callService).toHaveBeenCalledWith("alert", "turn_off", { entity_id: "alert.leak" });
  });

  it("un-acknowledges via alert.turn_on regardless of router services", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("alert.leak", "off", { attributes: { friendly_name: "Leak" } })],
    });
    const card = await mountCard({ type: "custom:switchboard-alerts-card", mode: "full" }, hass);
    cards.push(card);

    buttonWithText(card, "Un-acknowledge")?.click();
    await card.updateComplete;

    expect(hass.callService).toHaveBeenCalledWith("alert", "turn_on", { entity_id: "alert.leak" });
  });

  it("only renders the snooze menu once the router service exists and the slug is known", async () => {
    const hassNoSlug = createFakeHass({
      states: [fakeEntity("alert.leak", "on")],
      services: { notify_switchboard: { snooze: {} } },
    });
    const cardNoSlug = await mountCard(
      { type: "custom:switchboard-alerts-card", mode: "full" },
      hassNoSlug,
    );
    cards.push(cardNoSlug);
    expect(cardNoSlug.shadowRoot?.querySelector(".snooze-menu")).toBeNull();

    const hassNoService = createFakeHass({
      states: [fakeEntity("alert.leak", "on")],
      services: {},
    });
    const cardNoService = await mountCard(
      {
        type: "custom:switchboard-alerts-card",
        mode: "full",
        target_map: { "alert.leak": "leak" },
      },
      hassNoService,
    );
    cards.push(cardNoService);
    expect(cardNoService.shadowRoot?.querySelector(".snooze-menu")).toBeNull();

    const hassReady = createFakeHass({
      states: [fakeEntity("alert.leak", "on")],
      services: { notify_switchboard: { snooze: {} } },
    });
    const cardReady = await mountCard(
      {
        type: "custom:switchboard-alerts-card",
        mode: "full",
        target_map: { "alert.leak": "leak" },
      },
      hassReady,
    );
    cards.push(cardReady);
    expect(cardReady.shadowRoot?.querySelector(".snooze-menu")).not.toBeNull();
  });
});
