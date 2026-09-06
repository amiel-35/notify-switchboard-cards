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
}

export interface SwitchboardSilenceTileConfig extends LovelaceCardConfig {
  type: "custom:switchboard-silence-tile";
  person?: string;
  wake_time?: string;
  title?: string;
}

export const DEFAULT_SNOOZE_MINUTES: number[] = [15, 60, 480];
export const DEFAULT_WAKE_TIME = "07:00";

/** The three states a core `alert.*` entity can be in. */
export type AlertState = "idle" | "on" | "off";
