import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import type {
  HassEntity,
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceGridOptions,
} from "../../ha-types";
import type { AlertRowKind, SwitchboardAlertsCardConfig } from "../../types";
import { DEFAULT_SNOOZE_MINUTES, DELIVERY_EVENT_ENTITY, DROPPED_TODAY_ENTITY } from "../../types";
import { sharedStyles } from "../../styles/shared-styles";
import { t } from "../../i18n";
import { formatRelativeDuration } from "../../utils/format-duration";
import { fireEvent } from "../../utils/fire-event";
import { hasRouterService, resolveTargetSlug } from "../../utils/router-services";
import {
  validateEntityId,
  validateEntityList,
  validateMode,
  validateOptionalBoolean,
  validateOptionalString,
  validatePositiveIntegerList,
  validateStringMap,
} from "../../utils/config-validation";

const TICK_INTERVAL_MS = 30_000;
const CARD_NAME = "switchboard-alerts-card";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface AlertRow {
  entityId: string;
  stateObj: HassEntity | undefined;
  kind: AlertRowKind;
}

/** `unavailable` / `unknown` are never "acknowledged" — they are their own state. */
function classify(stateObj: HassEntity | undefined): AlertRowKind {
  if (!stateObj) return "missing";
  if (stateObj.state === "unavailable" || stateObj.state === "unknown") return "unavailable";
  if (stateObj.state === "on") return "active";
  return "acknowledged";
}

/**
 * `switchboard-alerts-card` lists core `alert.*` entities routed through
 * Notify Switchboard, with acknowledge / un-acknowledge / snooze actions.
 * It never assumes the router's 0.2.0 services exist: acknowledge falls
 * back to `alert.turn_off`, and the snooze menu only appears once both the
 * `notify_switchboard.snooze` service and the alert's target slug
 * (`target_map`) are known.
 */
export class SwitchboardAlertsCard extends LitElement implements LovelaceCard {
  static override styles = [
    sharedStyles,
    css`
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-width: 0;
        padding: 8px 16px;
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: start;
      }

      /*
       * Title never wraps mid-word: a narrow sections column would
       * otherwise break it letter by letter ("Al / ert / es"). It gets a
       * fixed flex-basis of 0 so — unlike the chips — it contributes no
       * width to the shrink calculation and is the last thing to give up
       * space; ellipsis only kicks in once .badge-chips has already
       * shrunk to its own floor.
       */
      .badge-title {
        flex: 1 1 0;
        min-width: 24px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /*
       * Chips keep a real flex-basis (their natural content width), so
       * negative (shrinking) space is taken from them before it ever
       * touches the title.
       */
      .badge-chips {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
      }

      .badge-count {
        justify-content: center;
        flex-shrink: 0;
      }

      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: var(--dialog-scrim-color, rgba(0, 0, 0, 0.5));
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 16px;
      }

      .dialog {
        background: var(--card-background-color, var(--ha-card-background));
        color: var(--primary-text-color);
        border-radius: 12px;
        max-width: 480px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        padding: 16px;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 1.1rem;
        font-weight: 500;
        margin-bottom: 8px;
      }

      .alert-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .alert-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
      }

      .alert-row:last-child {
        border-bottom: none;
      }

      .alert-icon {
        flex-shrink: 0;
        margin-top: 4px;
      }

      .alert-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .alert-name {
        font-weight: 500;
        text-align: start;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
        color: inherit;
        text-decoration: underline;
        text-decoration-color: var(--divider-color, rgba(127, 127, 127, 0.5));
        text-underline-offset: 3px;
      }

      .alert-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .alert-since {
        color: var(--secondary-text-color);
        font-size: 0.875rem;
      }

      .alert-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
      }

      .snooze-menu summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        align-items: center;
      }

      .snooze-menu summary::-webkit-details-marker {
        display: none;
      }

      .snooze-options {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 4px;
      }

      .card-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 8px 16px 16px;
        color: var(--secondary-text-color);
        font-size: 0.8125rem;
      }
    `,
  ];

  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _dialogOpen: { state: true },
    _now: { state: true },
  };

  hass?: HomeAssistant;

  private _config?: SwitchboardAlertsCardConfig;
  private _dialogOpen = false;
  private _now = Date.now();
  private _tickHandle?: ReturnType<typeof setInterval>;
  private _lastFocused?: HTMLElement | null;

  static getConfigElement(): HTMLElement {
    return document.createElement("switchboard-alerts-card-editor");
  }

  static getStubConfig(hass?: HomeAssistant): SwitchboardAlertsCardConfig {
    const entities = Object.keys(hass?.states ?? {}).filter((id) => id.startsWith("alert."));
    return {
      type: "custom:switchboard-alerts-card",
      entities,
      mode: "full",
      show_acknowledged: true,
    };
  }

  /**
   * Validates every option up front. Lovelace turns a throw here into a
   * `hui-error-card` showing this message next to the offending YAML,
   * which is the only place a config mistake can be reported without
   * taking the whole view down.
   */
  setConfig(config: LovelaceCardConfig): void {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error(`${CARD_NAME}: configuration must be a mapping`);
    }
    const raw = config as Record<string, unknown>;

    const validated: SwitchboardAlertsCardConfig = {
      ...(config as SwitchboardAlertsCardConfig),
      mode: validateMode(CARD_NAME, "mode", raw.mode) ?? "full",
      show_acknowledged:
        validateOptionalBoolean(CARD_NAME, "show_acknowledged", raw.show_acknowledged) ?? true,
      snooze_minutes:
        validatePositiveIntegerList(CARD_NAME, "snooze_minutes", raw.snooze_minutes) ??
        DEFAULT_SNOOZE_MINUTES,
    };

    const entities = validateEntityList(CARD_NAME, "entities", raw.entities, "alert");
    if (entities === undefined) {
      delete validated.entities;
    } else {
      validated.entities = entities;
    }

    const targetMap = validateStringMap(CARD_NAME, "target_map", raw.target_map);
    if (targetMap === undefined) {
      delete validated.target_map;
    } else {
      validated.target_map = targetMap;
    }

    const person = validateEntityId(CARD_NAME, "person", raw.person, "person");
    if (person === undefined) {
      delete validated.person;
    } else {
      validated.person = person;
    }

    const title = validateOptionalString(CARD_NAME, "title", raw.title);
    if (title === undefined) {
      delete validated.title;
    } else {
      validated.title = title;
    }

    this._config = validated;
  }

  getCardSize(): number {
    if (this._config?.mode === "compact") {
      return 1;
    }
    return Math.max(1, this._rows().length + 1);
  }

  /**
   * Sizing hints for the sections layout. The compact badge needs at
   * least 3 columns' worth of width for its title (when configured) and
   * chips to sit on one line without the sections view squeezing it down
   * to a single narrow column, which is what caused the title to wrap
   * letter by letter.
   */
  getGridOptions(): LovelaceGridOptions {
    if (this._config?.mode === "compact") {
      return { rows: 1, columns: 4, min_rows: 1, min_columns: 3 };
    }
    return { rows: "auto", columns: 12, min_rows: 2, min_columns: 6 };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._tickHandle = setInterval(() => {
      // Durations ("5 minutes ago") only move while something is listed.
      // An idle dashboard must not re-render every 30 s for nothing, so
      // the tick only touches `_now` (a reactive state) when it matters.
      if (this._hasLiveDurations()) {
        this._now = Date.now();
      }
    }, TICK_INTERVAL_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._tickHandle) {
      clearInterval(this._tickHandle);
      this._tickHandle = undefined;
    }
  }

  /**
   * `hass` is replaced on every state change in the whole instance. Only
   * re-render when one of the entities this card actually reads changed
   * identity, or when something other than `hass` changed.
   */
  protected override shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size !== 1 || !changed.has("hass")) {
      return true;
    }
    const oldHass = changed.get("hass") as HomeAssistant | undefined;
    const hass = this.hass;
    if (!oldHass || !hass) {
      return true;
    }
    if (oldHass.services !== hass.services || oldHass.locale !== hass.locale) {
      return true;
    }
    const watched = new Set([
      ...this._watchedEntityIds(oldHass),
      ...this._watchedEntityIds(hass),
      DROPPED_TODAY_ENTITY,
      DELIVERY_EVENT_ENTITY,
    ]);
    for (const entityId of watched) {
      if (oldHass.states[entityId] !== hass.states[entityId]) {
        return true;
      }
    }
    return false;
  }

  private _watchedEntityIds(hass: HomeAssistant | undefined): string[] {
    if (this._config?.entities?.length) {
      return this._config.entities;
    }
    return Object.keys(hass?.states ?? {}).filter((id) => id.startsWith("alert."));
  }

  private _entityIds(): string[] {
    return this._watchedEntityIds(this.hass);
  }

  private _rows(): AlertRow[] {
    if (!this.hass) {
      return [];
    }
    const showAcknowledged = this._config?.show_acknowledged ?? true;
    return this._entityIds()
      .map((entityId) => {
        const stateObj = this.hass?.states[entityId];
        return { entityId, stateObj, kind: classify(stateObj) };
      })
      .filter((row) => {
        if (row.kind === "missing") {
          return true; // surfaced as a "missing entity" row
        }
        if (row.stateObj?.state === "idle") {
          return false;
        }
        // Unavailable rows always show: they are a fault, not an ack.
        if (row.kind === "acknowledged" && !showAcknowledged) {
          return false;
        }
        return true;
      });
  }

  private _hasLiveDurations(): boolean {
    return this._rows().some((row) => row.stateObj !== undefined);
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) {
      return nothing;
    }

    const rows = this._rows();
    const title = this._config.title ?? t(this.hass, "alerts.title");

    if (this._config.mode === "compact") {
      return html`
        ${this._renderBadge(rows, title)}
        ${this._dialogOpen ? this._renderDialog(rows, title) : nothing}
      `;
    }

    return html`
      <ha-card .header=${title}>
        <div class="card-content">${this._renderList(rows)}</div>
        ${this._renderFooter()}
      </ha-card>
    `;
  }

  private _counts(rows: AlertRow[]): {
    active: number;
    acknowledged: number;
    unavailable: number;
  } {
    let active = 0;
    let acknowledged = 0;
    let unavailable = 0;
    for (const row of rows) {
      if (row.kind === "active") active += 1;
      else if (row.kind === "acknowledged") acknowledged += 1;
      else if (row.kind === "unavailable") unavailable += 1;
    }
    return { active, acknowledged, unavailable };
  }

  private _renderBadge(rows: AlertRow[], title: string): TemplateResult {
    const { active, acknowledged, unavailable } = this._counts(rows);
    const label = t(this.hass, "alerts.badge.label", { active, acknowledged, unavailable });
    // The compact badge defaults to chips only: a title is only added back
    // once `title` is explicitly configured, since that is the one piece
    // of text a narrow sections column cannot always give enough room to.
    const showTitle = Boolean(this._config?.title);
    return html`
      <ha-card>
        <button
          class="badge touch-target"
          type="button"
          aria-haspopup="dialog"
          aria-expanded=${this._dialogOpen ? "true" : "false"}
          aria-label="${title}: ${label}"
          @click=${this._openDialog}
        >
          ${showTitle ? html`<span class="badge-title" title=${title}>${title}</span>` : nothing}
          <span class="badge-chips">
            ${this._renderBadgeChip(
              active,
              active > 0 ? "chip-active" : "chip-neutral",
              "mdi:bell-ring",
              t(this.hass, "alerts.badge.active", { count: active }),
            )}
            ${
              acknowledged > 0
                ? this._renderBadgeChip(
                    acknowledged,
                    "chip-acknowledged",
                    "mdi:check",
                    t(this.hass, "alerts.badge.acknowledged", { count: acknowledged }),
                  )
                : nothing
            }
            ${
              unavailable > 0
                ? this._renderBadgeChip(
                    unavailable,
                    "chip-unavailable",
                    "mdi:help-circle-outline",
                    t(this.hass, "alerts.badge.unavailable", { count: unavailable }),
                  )
                : nothing
            }
          </span>
        </button>
      </ha-card>
    `;
  }

  /** Count chips always pair the number with an icon: never color alone. */
  private _renderBadgeChip(
    count: number,
    chipClass: string,
    icon: string,
    label: string,
  ): TemplateResult {
    return html`
      <span class="badge-count chip ${chipClass}" role="img" aria-label=${label}>
        <ha-icon icon=${icon} aria-hidden="true"></ha-icon>${count}
      </span>
    `;
  }

  private _renderDialog(rows: AlertRow[], title: string): TemplateResult {
    return html`
      <div
        class="dialog-backdrop"
        role="presentation"
        @click=${(event: MouseEvent) => {
          if (event.target === event.currentTarget) {
            this._closeDialog();
          }
        }}
        @keydown=${this._onDialogKeydown}
      >
        <div class="dialog" role="dialog" aria-modal="true" aria-label="${title}">
          <div class="dialog-header">
            <span class="wrap-text">${title}</span>
            <button
              class="action-button touch-target"
              type="button"
              aria-label="${t(this.hass, "alerts.dialog.close")}"
              @click=${this._closeDialog}
            >
              ✕
            </button>
          </div>
          <div class="dialog-content">${this._renderList(rows)}</div>
          ${this._renderFooter()}
        </div>
      </div>
    `;
  }

  private _openDialog = (event: Event): void => {
    this._lastFocused = event.currentTarget as HTMLElement;
    this._dialogOpen = true;
    this.updateComplete.then(() => {
      const closeButton = this.renderRoot.querySelector<HTMLElement>(".dialog-header button");
      closeButton?.focus();
    });
  };

  private _closeDialog = (): void => {
    this._dialogOpen = false;
    const restore = this._lastFocused;
    this.updateComplete.then(() => {
      const badge = this.renderRoot.querySelector<HTMLElement>(".badge");
      (restore?.isConnected ? restore : badge)?.focus();
    });
  };

  /**
   * Focus trap. Escape closes and hands focus back to the badge; Tab and
   * Shift+Tab wrap around the dialog's own focusable controls so keyboard
   * users cannot tab out into the (inert) dashboard behind the scrim.
   */
  private _onDialogKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      this._closeDialog();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const dialog = this.renderRoot.querySelector<HTMLElement>(".dialog");
    if (!dialog) {
      return;
    }
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => element.getAttribute("aria-hidden") !== "true",
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    const active = (this.renderRoot as ShadowRoot).activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (!active || active === first || !dialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (!active || active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  private _renderList(rows: AlertRow[]): TemplateResult {
    if (rows.length === 0) {
      return html`<p class="empty-state">${t(this.hass, "alerts.empty")}</p>`;
    }
    return html`
      <ul class="alert-list">
        ${rows.map((row) => this._renderRow(row))}
      </ul>
    `;
  }

  /**
   * "Dropped today / last delivery" footer (routed_today is not shown yet), read from the router's own entities
   * (`sensor.switchboard_dropped_today`, `event.switchboard_delivery`).
   * Rendered only when those entities actually exist, so the card stays
   * correct against a router that does not publish them.
   */
  private _renderFooter(): TemplateResult | typeof nothing {
    const hass = this.hass;
    if (!hass) {
      return nothing;
    }
    const dropped = hass.states[DROPPED_TODAY_ENTITY];
    const delivery = hass.states[DELIVERY_EVENT_ENTITY];
    const parts: TemplateResult[] = [];

    if (dropped && dropped.state !== "unavailable" && dropped.state !== "unknown") {
      parts.push(
        html`<span class="wrap-text"
          >${t(hass, "alerts.footer.dropped", { count: dropped.state })}</span
        >`,
      );
    }
    if (delivery && delivery.state !== "unavailable" && delivery.state !== "unknown") {
      const value = formatRelativeDuration(
        delivery.state,
        hass.locale?.language ?? hass.language ?? "en",
        new Date(this._now),
      );
      if (value) {
        parts.push(
          html`<span class="wrap-text">${t(hass, "alerts.footer.last_delivery", { value })}</span>`,
        );
      }
    }
    if (parts.length === 0) {
      return nothing;
    }
    return html`<div class="card-footer">${parts}</div>`;
  }

  private _renderRow(row: AlertRow): TemplateResult {
    const hass = this.hass;
    if (!hass) {
      return html``;
    }
    const { entityId, stateObj, kind } = row;

    if (!stateObj) {
      return html`
        <li class="alert-row">
          <span class="wrap-text">${t(hass, "alerts.entity_missing", { entity: entityId })}</span>
        </li>
      `;
    }

    const name = stateObj.attributes.friendly_name ?? entityId;
    const isActive = kind === "active";
    const isUnavailable = kind === "unavailable";
    const icon = isUnavailable
      ? "mdi:help-circle-outline"
      : (stateObj.attributes.icon ??
        (isActive ? "mdi:alert-circle" : "mdi:alert-circle-check-outline"));
    const since = formatRelativeDuration(
      stateObj.last_changed,
      hass.locale?.language ?? hass.language ?? "en",
      new Date(this._now),
    );
    const slug = resolveTargetSlug(entityId, this._config?.target_map);
    const canSnooze = !isUnavailable && Boolean(slug) && hasRouterService(hass, "snooze");
    const snoozeMinutes = this._config?.snooze_minutes ?? DEFAULT_SNOOZE_MINUTES;

    let chipClass: string;
    let chipIcon: string;
    let chipText: string;
    if (isUnavailable) {
      chipClass = "chip-unavailable";
      chipIcon = "mdi:help-circle-outline";
      chipText = t(hass, "alerts.state.unavailable");
    } else if (isActive) {
      chipClass = "chip-active";
      chipIcon = "mdi:bell-ring";
      chipText = t(hass, "alerts.state.active");
    } else {
      chipClass = "chip-acknowledged";
      chipIcon = "mdi:check";
      chipText = t(hass, "alerts.state.acknowledged");
    }

    return html`
      <li class="alert-row">
        <ha-icon class="alert-icon" icon=${icon}></ha-icon>
        <div class="alert-main">
          <button
            class="alert-name wrap-text"
            type="button"
            aria-label=${t(hass, "alerts.action.more_info", { name })}
            @click=${() => this._showMoreInfo(entityId)}
          >
            ${name}
          </button>
          <div class="alert-meta">
            <span class="chip ${chipClass}">
              <ha-icon icon=${chipIcon} aria-hidden="true"></ha-icon>${chipText}
            </span>
            <span class="alert-since wrap-text">${since}</span>
          </div>
        </div>
        <div class="alert-actions">
          ${
            isUnavailable
              ? nothing
              : isActive
                ? html`
                    <button
                      class="action-button touch-target"
                      type="button"
                      @click=${() => this._acknowledge(entityId, slug)}
                    >
                      ${t(hass, "alerts.action.acknowledge")}
                    </button>
                  `
                : html`
                    <button
                      class="action-button touch-target"
                      type="button"
                      @click=${() => this._unacknowledge(entityId)}
                    >
                      ${t(hass, "alerts.action.unacknowledge")}
                    </button>
                  `
          }
          ${canSnooze ? this._renderSnoozeMenu(slug as string, snoozeMinutes) : nothing}
        </div>
      </li>
    `;
  }

  /**
   * A `<details>` disclosure, not a fake button: `<summary>` already has
   * its own role and keyboard behaviour, so overriding it with
   * `role="button"` would strip the expanded/collapsed announcement.
   */
  private _renderSnoozeMenu(slug: string, snoozeMinutes: number[]): TemplateResult {
    const hass = this.hass;
    const person = this._config?.person;
    const labelKey = person
      ? ("alerts.action.snooze_minutes" as const)
      : ("alerts.action.snooze_minutes_everyone" as const);

    return html`
      <div class="snooze-menu">
        <details
          @toggle=${(event: Event) => {
            const details = event.currentTarget as HTMLDetailsElement;
            details
              .querySelector("summary")
              ?.setAttribute("aria-expanded", details.open ? "true" : "false");
          }}
          @keydown=${this._onSnoozeKeydown}
        >
          <summary class="action-button touch-target" aria-expanded="false">
            ${t(hass, "alerts.action.snooze")}
          </summary>
          <div class="snooze-options" role="menu" aria-label=${t(hass, "alerts.action.snooze")}>
            ${snoozeMinutes.map(
              (minutes) => html`
                <button
                  class="action-button touch-target"
                  type="button"
                  role="menuitem"
                  @click=${() => this._snooze(slug, minutes)}
                >
                  ${t(hass, labelKey, { minutes })}
                </button>
              `,
            )}
          </div>
        </details>
      </div>
    `;
  }

  private _onSnoozeKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }
    const details = event.currentTarget as HTMLDetailsElement;
    if (!details.open) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    details.open = false;
    const summary = details.querySelector("summary");
    summary?.setAttribute("aria-expanded", "false");
    (summary as HTMLElement | null)?.focus();
  };

  private _showMoreInfo(entityId: string): void {
    fireEvent(this, "hass-more-info", { entityId });
  }

  private async _acknowledge(entityId: string, slug: string | undefined): Promise<void> {
    if (!this.hass) return;
    if (slug && hasRouterService(this.hass, "acknowledge")) {
      await this.hass.callService("notify_switchboard", "acknowledge", { target: slug });
      return;
    }
    await this.hass.callService("alert", "turn_off", { entity_id: entityId });
  }

  private async _unacknowledge(entityId: string): Promise<void> {
    if (!this.hass) return;
    await this.hass.callService("alert", "turn_on", { entity_id: entityId });
  }

  /**
   * Without `person`, `notify_switchboard.snooze` snoozes the target for
   * the whole audience — which is what the menu label says it will do.
   */
  private async _snooze(slug: string, minutes: number): Promise<void> {
    if (!this.hass) return;
    const person = this._config?.person;
    const data: Record<string, unknown> = { target: slug, minutes };
    if (person) {
      data.person = person;
    }
    await this.hass.callService("notify_switchboard", "snooze", data);
  }
}

if (!customElements.get("switchboard-alerts-card")) {
  customElements.define("switchboard-alerts-card", SwitchboardAlertsCard);
}
