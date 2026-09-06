import { afterEach, describe, expect, it } from "vitest";
import "../src/cards/silence-tile/switchboard-silence-tile";
import type { SwitchboardSilenceTile } from "../src/cards/silence-tile/switchboard-silence-tile";
import type { SwitchboardSilenceTileConfig } from "../src/types";
import { createFakeHass, fakeEntity } from "./fake-hass";

async function mountTile(
  config: SwitchboardSilenceTileConfig,
  hass: ReturnType<typeof createFakeHass>,
): Promise<SwitchboardSilenceTile> {
  const tile = document.createElement("switchboard-silence-tile") as SwitchboardSilenceTile;
  tile.setConfig(config);
  tile.hass = hass;
  document.body.appendChild(tile);
  await tile.updateComplete;
  return tile;
}

function buttonWithText(tile: SwitchboardSilenceTile, text: string): HTMLButtonElement | undefined {
  const buttons = Array.from(tile.shadowRoot?.querySelectorAll("button") ?? []);
  return buttons.find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
}

describe("switchboard-silence-tile states", () => {
  let tiles: SwitchboardSilenceTile[] = [];

  afterEach(() => {
    for (const tile of tiles) tile.remove();
    tiles = [];
  });

  it("prompts for configuration when no person is set", async () => {
    const hass = createFakeHass({});
    const tile = await mountTile({ type: "custom:switchboard-silence-tile", person: "" }, hass);
    tiles.push(tile);

    expect(tile.shadowRoot?.textContent).toContain("Select a person in the card configuration");
  });

  it("shows the silenced chip and snooze count for a configured person", async () => {
    const hass = createFakeHass({
      states: [
        fakeEntity("person.alice", "home", { attributes: { friendly_name: "Alice" } }),
        fakeEntity("binary_sensor.alice_silenced", "on"),
        fakeEntity("sensor.alice_active_snoozes", "2"),
        fakeEntity("sensor.alice_last_notification", "unknown"),
      ],
    });
    const tile = await mountTile(
      { type: "custom:switchboard-silence-tile", person: "person.alice" },
      hass,
    );
    tiles.push(tile);

    const text = tile.shadowRoot?.textContent ?? "";
    expect(text).toContain("Silenced");
    expect(text).toContain("2 active snoozes");
    expect(text).toContain("No notifications yet");
  });

  it("shows 'not silenced' and no active snoozes when the router entities say so", async () => {
    const hass = createFakeHass({
      states: [
        fakeEntity("person.alice", "home", { attributes: { friendly_name: "Alice" } }),
        fakeEntity("binary_sensor.alice_silenced", "off"),
        fakeEntity("sensor.alice_active_snoozes", "0"),
      ],
    });
    const tile = await mountTile(
      { type: "custom:switchboard-silence-tile", person: "person.alice" },
      hass,
    );
    tiles.push(tile);

    const text = tile.shadowRoot?.textContent ?? "";
    expect(text).toContain("Not silenced");
    expect(text).toContain("No active snoozes");
  });
});

describe("switchboard-silence-tile router service availability", () => {
  let tiles: SwitchboardSilenceTile[] = [];

  afterEach(() => {
    for (const tile of tiles) tile.remove();
    tiles = [];
  });

  it("disables silence/clear actions when the router does not yet expose them (0.1.x)", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("person.alice", "home")],
      services: {},
    });
    const tile = await mountTile(
      { type: "custom:switchboard-silence-tile", person: "person.alice" },
      hass,
    );
    tiles.push(tile);

    expect(buttonWithText(tile, "Silence 1 h")?.disabled).toBe(true);
    expect(buttonWithText(tile, "Until wake")?.disabled).toBe(true);
    expect(buttonWithText(tile, "Clear")?.disabled).toBe(true);
  });

  it("enables silence actions and calls notify_switchboard.silence once available (0.2.0+)", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("person.alice", "home")],
      services: { notify_switchboard: { silence: {}, unsnooze: {} } },
    });
    const tile = await mountTile(
      { type: "custom:switchboard-silence-tile", person: "person.alice", wake_time: "07:00" },
      hass,
    );
    tiles.push(tile);

    const silenceButton = buttonWithText(tile, "Silence 1 h");
    expect(silenceButton?.disabled).toBe(false);
    silenceButton?.click();
    await tile.updateComplete;

    expect(hass.callService).toHaveBeenCalledWith("notify_switchboard", "silence", {
      person: "person.alice",
      minutes: 60,
    });
  });

  it("clears by calling unsnooze and silence(0) when both services exist", async () => {
    const hass = createFakeHass({
      states: [fakeEntity("person.alice", "home")],
      services: { notify_switchboard: { silence: {}, unsnooze: {} } },
    });
    const tile = await mountTile(
      { type: "custom:switchboard-silence-tile", person: "person.alice" },
      hass,
    );
    tiles.push(tile);

    buttonWithText(tile, "Clear")?.click();
    await tile.updateComplete;

    expect(hass.callService).toHaveBeenCalledWith("notify_switchboard", "unsnooze", {
      person: "person.alice",
    });
    expect(hass.callService).toHaveBeenCalledWith("notify_switchboard", "silence", {
      person: "person.alice",
      minutes: 0,
    });
  });
});
