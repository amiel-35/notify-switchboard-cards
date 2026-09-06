import type { HomeAssistant } from "../ha-types";
import type { TargetMap } from "../types";

export const SWITCHBOARD_DOMAIN = "notify_switchboard";

export type RouterServiceName = "acknowledge" | "snooze" | "silence" | "unsnooze";

/**
 * The router services (`notify_switchboard.acknowledge` / `snooze` /
 * `silence` / `unsnooze`) only land in Notify Switchboard 0.2.0. Cards must
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
