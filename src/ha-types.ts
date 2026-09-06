/**
 * Minimal, hand-written Home Assistant frontend types.
 *
 * We deliberately avoid depending on `custom-card-helpers` (a community
 * package that lags behind frontend releases and pulls in a lot of surface
 * we do not use). Only the subset of the `hass` object and Lovelace
 * contracts that these cards actually touch is declared here.
 */

export interface HassEntityContext {
  id: string;
  parent_id?: string | null;
  user_id?: string | null;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    icon?: string;
  };
  last_changed: string;
  last_updated: string;
  context?: HassEntityContext;
}

export interface HassLocale {
  language: string;
  number_format?: string;
  time_format?: string;
}

/** A Home Assistant service, keyed by domain then service name. */
export type HassServices = Record<string, Record<string, unknown>>;

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  services: HassServices;
  locale?: HassLocale;
  /** Older frontends only expose a flat language code. */
  language?: string;
  callService: (
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ) => Promise<unknown>;
}

/** Base shape shared by every Lovelace card config. */
export interface LovelaceCardConfig {
  type: string;
  view_layout?: unknown;
  [key: string]: unknown;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  isPanel?: boolean;
  editMode?: boolean;
  getCardSize: () => number | Promise<number>;
  setConfig: (config: LovelaceCardConfig) => void;
}

export interface LovelaceCardEditor extends HTMLElement {
  hass?: HomeAssistant;
  setConfig: (config: LovelaceCardConfig) => void;
}

export interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
  documentationURL?: string;
}

declare global {
  interface Window {
    customCards: CustomCardEntry[];
  }

  interface HTMLElementTagNameMap {
    "switchboard-alerts-card": LovelaceCard;
    "switchboard-silence-tile": LovelaceCard;
  }
}
