import { vi } from "vitest";
import type { HassEntity, HassServices, HomeAssistant } from "../src/ha-types";

export function fakeEntity(
  entityId: string,
  state: string,
  overrides: Partial<HassEntity> = {},
): HassEntity {
  return {
    entity_id: entityId,
    state,
    attributes: {},
    last_changed: overrides.last_changed ?? new Date().toISOString(),
    last_updated: overrides.last_updated ?? new Date().toISOString(),
    ...overrides,
  };
}

export interface FakeHassOptions {
  states?: HassEntity[];
  services?: HassServices;
  language?: string;
}

export function createFakeHass(options: FakeHassOptions = {}): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const entity of options.states ?? []) {
    states[entity.entity_id] = entity;
  }
  return {
    states,
    services: options.services ?? {},
    locale: { language: options.language ?? "en" },
    callService: vi.fn().mockResolvedValue(undefined),
  };
}
