import type { LovelaceCardConfig } from "./ha-types";

/** Maps an `alert.*` entity id to the Notify Switchboard target slug that owns it. */
export type TargetMap = Record<string, string>;

export interface SwitchboardAlertsCardConfig extends LovelaceCardConfig {
  type: "custom:switchboard-alerts-card";
  entities?: string[];
  mode?: "compact" | "full";
  show_acknowledged?: boolean;
  title?: string;
  target_map?: TargetMap;
  snooze_minutes?: number[];
  /**
   * Optional `person.*` entity the snooze applies to. Notify Switchboard's
   * `snooze` service silences a target for the whole audience when no
   * person is given, so the menu says so explicitly when this is unset.
   */
  person?: string;
}

export interface SwitchboardSilenceTileConfig extends LovelaceCardConfig {
  type: "custom:switchboard-silence-tile";
  person?: string;
  wake_time?: string;
  title?: string;
}

export const DEFAULT_SNOOZE_MINUTES: number[] = [15, 60, 480];
export const DEFAULT_WAKE_TIME = "07:00";

/** Entity ids published by the router, read for the card footer when present. */
export const DROPPED_TODAY_ENTITY = "sensor.switchboard_dropped_today";
export const DELIVERY_EVENT_ENTITY = "event.switchboard_delivery";

/**
 * The states a core `alert.*` entity can be in, plus the two states every
 * Home Assistant entity can fall into when its integration is not
 * providing data. `unavailable` / `unknown` are a distinct fourth case:
 * they are emphatically *not* "acknowledged".
 */
export type AlertState = "idle" | "on" | "off" | "unavailable" | "unknown";

/** How the card classifies one configured row for display. */
export type AlertRowKind = "active" | "acknowledged" | "unavailable" | "missing";
