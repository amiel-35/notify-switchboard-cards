import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import type { HassEntity, HomeAssistant, LovelaceCard, LovelaceCardConfig } from "../../ha-types";
import type { SwitchboardAlertsCardConfig } from "../../types";
import { DEFAULT_SNOOZE_MINUTES } from "../../types";
import { sharedStyles } from "../../styles/shared-styles";
import { t } from "../../i18n";
import { formatRelativeDuration } from "../../utils/format-duration";
import { hasRouterService, resolveTargetSlug } from "../../utils/router-services";

const TICK_INTERVAL_MS = 30_000;

interface AlertRow {
  entityId: string;
  stateObj: HassEntity | undefined;
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
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 16px;
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: start;
      }

      .badge-title {
        flex: 1;
        font-weight: 500;
      }

      .badge-count {
        min-width: 24px;
        justify-content: center;
      }

      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 16px;
      }

      .dialog {
        background: var(--card-background-color, white);
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

  setConfig(config: LovelaceCardConfig): void {
    const cardConfig = config as SwitchboardAlertsCardConfig;
    if (!cardConfig || typeof cardConfig !== "object") {
      throw new Error("Invalid configuration");
    }
    this._config = {
      mode: "full",
      show_acknowledged: true,
      snooze_minutes: DEFAULT_SNOOZE_MINUTES,
      ...cardConfig,
    };
  }

  getCardSize(): number {
    if (this._config?.mode === "compact") {
      return 1;
    }
    return Math.max(1, this._rows().length + 1);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._tickHandle = setInterval(() => {
      this._now = Date.now();
    }, TICK_INTERVAL_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._tickHandle) {
      clearInterval(this._tickHandle);
      this._tickHandle = undefined;
    }
  }

  private _entityIds(): string[] {
    if (this._config?.entities?.length) {
      return this._config.entities;
    }
    return Object.keys(this.hass?.states ?? {}).filter((id) => id.startsWith("alert."));
  }

  private _rows(): AlertRow[] {
    if (!this.hass) {
      return [];
    }
    const showAcknowledged = this._config?.show_acknowledged ?? true;
    return this._entityIds()
      .map((entityId) => ({ entityId, stateObj: this.hass?.states[entityId] }))
      .filter((row) => {
        if (!row.stateObj) {
          return true; // surfaced as a "missing entity" row
        }
        if (row.stateObj.state === "idle") {
          return false;
        }
        if (row.stateObj.state === "off" && !showAcknowledged) {
          return false;
        }
        return true;
      });
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
      </ha-card>
    `;
  }

  private _counts(rows: AlertRow[]): { active: number; acknowledged: number } {
    let active = 0;
    let acknowledged = 0;
    for (const row of rows) {
      if (row.stateObj?.state === "on") {
        active += 1;
      } else if (row.stateObj?.state === "off") {
        acknowledged += 1;
      }
    }
    return { active, acknowledged };
  }

  private _renderBadge(rows: AlertRow[], title: string): TemplateResult {
    const { active, acknowledged } = this._counts(rows);
    const label = t(this.hass, "alerts.badge.label", { active, acknowledged });
    return html`
      <ha-card>
        <button
          class="badge touch-target"
          type="button"
          aria-haspopup="dialog"
          aria-label="${title}: ${label}"
          @click=${this._openDialog}
        >
          <span class="badge-title wrap-text">${title}</span>
          <span class="badge-count chip ${active > 0 ? "chip-active" : "chip-neutral"}">
            ${active}
          </span>
          ${
            acknowledged > 0
              ? html`<span class="badge-count chip chip-acknowledged">${acknowledged}</span>`
              : nothing
          }
        </button>
      </ha-card>
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
    this._lastFocused?.focus();
  };

  private _onDialogKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      this._closeDialog();
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

  private _renderRow(row: AlertRow): TemplateResult {
    const hass = this.hass;
    if (!hass) {
      return html``;
    }
    const { entityId, stateObj } = row;

    if (!stateObj) {
      return html`
        <li class="alert-row">
          <span class="wrap-text">${t(hass, "alerts.entity_missing", { entity: entityId })}</span>
        </li>
      `;
    }

    const name = stateObj.attributes.friendly_name ?? entityId;
    const icon =
      stateObj.attributes.icon ??
      (stateObj.state === "on" ? "mdi:alert-circle" : "mdi:alert-circle-check-outline");
    const isActive = stateObj.state === "on";
    const since = formatRelativeDuration(
      stateObj.last_changed,
      hass.locale?.language ?? hass.language ?? "en",
      new Date(this._now),
    );
    const slug = resolveTargetSlug(entityId, this._config?.target_map);
    const canSnooze = Boolean(slug) && hasRouterService(hass, "snooze");
    const snoozeMinutes = this._config?.snooze_minutes ?? DEFAULT_SNOOZE_MINUTES;

    return html`
      <li class="alert-row">
        <ha-icon class="alert-icon" icon=${icon}></ha-icon>
        <div class="alert-main">
          <div class="alert-name wrap-text">${name}</div>
          <div class="alert-meta">
            <span class="chip ${isActive ? "chip-active" : "chip-acknowledged"}">
              ${isActive ? t(hass, "alerts.state.active") : t(hass, "alerts.state.acknowledged")}
            </span>
            <span class="alert-since wrap-text">${since}</span>
          </div>
        </div>
        <div class="alert-actions">
          ${
            isActive
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
          ${
            canSnooze
              ? html`
                  <div class="snooze-menu">
                    <details>
                      <summary
                        class="action-button touch-target"
                        role="button"
                        aria-label="${t(hass, "alerts.action.snooze")}"
                      >
                        ${t(hass, "alerts.action.snooze")}
                      </summary>
                      <div class="snooze-options">
                        ${snoozeMinutes.map(
                          (minutes) => html`
                            <button
                              class="action-button touch-target"
                              type="button"
                              @click=${() => this._snooze(slug as string, minutes)}
                            >
                              ${t(hass, "alerts.action.snooze_minutes", { minutes })}
                            </button>
                          `,
                        )}
                      </div>
                    </details>
                  </div>
                `
              : nothing
          }
        </div>
      </li>
    `;
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

  private async _snooze(slug: string, minutes: number): Promise<void> {
    if (!this.hass) return;
    await this.hass.callService("notify_switchboard", "snooze", { target: slug, minutes });
  }
}

if (!customElements.get("switchboard-alerts-card")) {
  customElements.define("switchboard-alerts-card", SwitchboardAlertsCard);
}
