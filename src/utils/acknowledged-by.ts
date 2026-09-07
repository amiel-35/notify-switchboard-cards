/**
 * "Acknowledged by …", read from `event.switchboard_delivery`.
 *
 * Notify Switchboard 0.7.0 puts acknowledgement authorship in the
 * `acknowledged` event payload and **nowhere else** — the contract is
 * explicit about it: "No entity and no stored record exposes
 * acknowledgement authorship: the event is where it lives"
 * (docs/contract.md, §"The `acknowledged` event payload").
 *
 * A Home Assistant event entity keeps only its **last** event: the state is
 * that event's timestamp and the attributes are `event_type` plus the
 * payload. So the most a card can honestly say is who acknowledged the
 * target of the last event — and only while that last event is still an
 * `acknowledged`. Any later `routed` / `dropped` / `snoozed` replaces it,
 * and the line disappears. That is a deliberate limit, not a gap to paper
 * over: the alternative would be caching a history the router refuses to
 * publish.
 */
import type { HomeAssistant } from "../ha-types";
import { DELIVERY_EVENT_ENTITY } from "../types";

export interface Acknowledgement {
  /** The target slug the acknowledgement was for. */
  target: string;
  /** The `alert.*` that was turned off, or `null`. */
  alertEntity: string | null;
  /** The acting user resolved to a `person.*` by the router, or `null`. */
  person: string | null;
  /** The raw acting `context.user_id`, or `null`. */
  userId: string | null;
}

/** How much of a raw user id is worth showing when there is no person. */
const SHORT_USER_ID_LENGTH = 8;

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The last delivery event, but only when it is an `acknowledged` one.
 * Returns `undefined` for every other event type, for a missing or
 * `unavailable` entity (a router below 0.7.0 fires the event without
 * `person`, which simply yields `person: null`), and for a payload with no
 * target.
 */
export function lastAcknowledgement(hass: HomeAssistant | undefined): Acknowledgement | undefined {
  const stateObj = hass?.states?.[DELIVERY_EVENT_ENTITY];
  if (!stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown") {
    return undefined;
  }
  const attributes = stateObj.attributes;
  if (attributes.event_type !== "acknowledged") {
    return undefined;
  }
  const target = asStringOrNull(attributes.target);
  if (!target) {
    return undefined;
  }
  return {
    target,
    alertEntity: asStringOrNull(attributes.alert_entity),
    person: asStringOrNull(attributes.person),
    userId: asStringOrNull(attributes.user_id),
  };
}

/**
 * The name to print after "Acknowledged by". The router already resolved
 * the acting user to a `person.*` through the canonical `user_id` link, so
 * the card only has to look up that person's friendly name — it never
 * re-does the resolution itself, and it never guesses a person from a
 * `user_id`. When the router could not resolve one, the raw id is shown
 * shortened, which says "somebody, and here is the handle" without
 * claiming to know who.
 *
 * Returns `undefined` when there is nothing honest to show.
 */
export function acknowledgedByName(
  hass: HomeAssistant | undefined,
  acknowledgement: Acknowledgement | undefined,
): string | undefined {
  if (!acknowledgement) {
    return undefined;
  }
  const { person, userId } = acknowledgement;
  if (person) {
    const friendlyName = hass?.states?.[person]?.attributes.friendly_name;
    return typeof friendlyName === "string" && friendlyName !== "" ? friendlyName : person;
  }
  if (userId) {
    return userId.slice(0, SHORT_USER_ID_LENGTH);
  }
  return undefined;
}

/**
 * The name to show on one alert row, or `undefined`. The acknowledgement
 * has to be *this* row's: matched on the target slug when the card knows
 * it, and on the `alert_entity` the event carries otherwise.
 */
export function acknowledgedByForAlert(
  hass: HomeAssistant | undefined,
  alertEntityId: string,
  slug: string | undefined,
): string | undefined {
  const acknowledgement = lastAcknowledgement(hass);
  if (!acknowledgement) {
    return undefined;
  }
  const matches = slug
    ? acknowledgement.target === slug
    : acknowledgement.alertEntity === alertEntityId;
  return matches ? acknowledgedByName(hass, acknowledgement) : undefined;
}
