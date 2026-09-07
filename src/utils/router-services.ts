import type { HomeAssistant } from "../ha-types";
import type { TargetMap } from "../types";
import { DEFAULT_SNOOZE_MINUTES } from "../types";
import { targetBySlug, targetForAlert, type RoutingTable } from "./routing-table";

export const SWITCHBOARD_DOMAIN = "notify_switchboard";

export type RouterServiceName = "acknowledge" | "snooze" | "silence" | "unsnooze" | "unsilence";

/**
 * The router services (`notify_switchboard.acknowledge` / `snooze` /
 * `silence` / `unsnooze` / `unsilence`) only land in Notify Switchboard
 * 0.2.0. Cards must
 * keep working against 0.1.x by checking `hass.services` before calling
 * them and degrading to the native `alert.*` actions instead.
 */
export function hasRouterService(hass: HomeAssistant, service: RouterServiceName): boolean {
  return Boolean(hass.services?.[SWITCHBOARD_DOMAIN]?.[service]);
}

/**
 * Resolves the Notify Switchboard target slug for an `alert.*` entity from
 * the card's configured `target_map` (e.g. `{ "alert.leak": "leak" }`).
 * Returns `undefined` when the entity is not mapped, in which case only
 * the native `alert.turn_off` / `alert.turn_on` actions are safe to use.
 */
export function resolveTargetSlug(
  entityId: string,
  targetMap: TargetMap | undefined,
): string | undefined {
  return targetMap?.[entityId];
}

/**
 * What the alerts card needs to know about one alert row's target, from
 * both sources at once: the card's own `target_map` / `snooze_minutes`
 * options and, since router 0.7.0, `sensor.switchboard_routing_table`.
 *
 * The user's options always win — they are overrides, not a fallback —
 * and everything they leave unset is derived from the table. With no
 * table (router below 0.7.0, or the entity `unavailable`) this collapses
 * to exactly the 0.1.x behaviour: the slug comes from `target_map` or
 * nowhere.
 */
export interface ResolvedAlertTarget {
  slug: string | undefined;
  /** Where the slug came from — reported in the UI, not just diagnostics. */
  source: "config" | "routing_table" | "none";
  /**
   * `false` only when the routing table says this target refuses
   * acknowledgement, in which case `notify_switchboard.acknowledge` would
   * refuse the call and the card uses `alert.turn_off` instead.
   */
  allowAcknowledge: boolean;
  /** The durations to offer, options first, then the target's, then the default. */
  snoozeMinutes: number[];
}

export function resolveAlertTarget(
  entityId: string,
  options: {
    targetMap?: TargetMap;
    snoozeMinutes?: number[];
  },
  table: RoutingTable | undefined,
): ResolvedAlertTarget {
  const configured = resolveTargetSlug(entityId, options.targetMap);
  const derived = targetForAlert(table, entityId);
  const slug = configured ?? derived?.slug;
  const row = configured ? (targetBySlug(table, configured) ?? derived) : derived;

  const snoozeMinutes =
    options.snoozeMinutes && options.snoozeMinutes.length > 0
      ? options.snoozeMinutes
      : row?.snoozeMinutes && row.snoozeMinutes.length > 0
        ? row.snoozeMinutes
        : DEFAULT_SNOOZE_MINUTES;

  return {
    slug,
    source: configured ? "config" : derived ? "routing_table" : "none",
    allowAcknowledge: row?.allowAcknowledge !== false,
    snoozeMinutes,
  };
}
