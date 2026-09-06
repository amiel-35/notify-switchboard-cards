import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import type { HomeAssistant, LovelaceCard, LovelaceCardConfig } from "../../ha-types";
import type { SwitchboardSilenceTileConfig } from "../../types";
import { DEFAULT_WAKE_TIME } from "../../types";
import { sharedStyles } from "../../styles/shared-styles";
import { t } from "../../i18n";
import { formatRelativeDuration } from "../../utils/format-duration";
import { minutesUntilWakeTime } from "../../utils/wake-time";
import { hasRouterService, SWITCHBOARD_DOMAIN } from "../../utils/router-services";

const TICK_INTERVAL_MS = 30_000;

/**
 * `switchboard-silence-tile` shows one person's Notify Switchboard silence
 * state (`binary_sensor.<person>_silenced`, `sensor.<person>_active_snoozes`,
 * `sensor.<person>_last_notification`) with silence / clear controls. The
 * router services those controls call (`notify_switchboard.silence` /
 * `unsnooze`) only exist from 0.2.0 onward, so every button disables itself
 * with an explanatory tooltip when the service is not registered yet.
 */
export class SwitchboardSilenceTile extends LitElement implements LovelaceCard {
  static override styles = [
    sharedStyles,
    css`
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px 16px 0;
        font-weight: 500;
      }

      .body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .status-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .detail {
        color: var(--secondary-text-color);
        font-size: 0.9rem;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    `,
  ];

  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _now: { state: true },
  };

  hass?: HomeAssistant;
  private _config?: SwitchboardSilenceTileConfig;
  private _now = Date.now();
  private _tickHandle?: ReturnType<typeof setInterval>;

  static getConfigElement(): HTMLElement {
    return document.createElement("switchboard-silence-tile-editor");
  }

  static getStubConfig(hass?: HomeAssistant): SwitchboardSilenceTileConfig {
    const person = Object.keys(hass?.states ?? {}).find((id) => id.startsWith("person."));
    return {
      type: "custom:switchboard-silence-tile",
      person: person ?? "",
      wake_time: DEFAULT_WAKE_TIME,
    };
  }

  setConfig(config: LovelaceCardConfig): void {
    const cardConfig = config as SwitchboardSilenceTileConfig;
    if (!cardConfig || typeof cardConfig !== "object") {
      throw new Error("Invalid configuration");
    }
    this._config = { wake_time: DEFAULT_WAKE_TIME, ...cardConfig };
  }

  getCardSize(): number {
    return 3;
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

  private _objectId(): string | undefined {
    const person = this._config?.person;
    if (!person || !person.includes(".")) {
      return undefined;
    }
    return person.split(".")[1];
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config) {
      return nothing;
    }

    const title = config.title ?? t(hass, "silence.title");
    const objectId = this._objectId();

    if (!config.person || !objectId) {
      return html`
        <ha-card .header=${title}>
          <div class="body"><p class="empty-state">${t(hass, "silence.not_configured")}</p></div>
        </ha-card>
      `;
    }

    const personState = hass.states[config.person];
    const silencedEntityId = `binary_sensor.${objectId}_silenced`;
    const snoozesEntityId = `sensor.${objectId}_active_snoozes`;
    const lastNotificationEntityId = `sensor.${objectId}_last_notification`;

    const silencedState = hass.states[silencedEntityId];
    const snoozesState = hass.states[snoozesEntityId];
    const lastNotificationState = hass.states[lastNotificationEntityId];

    const headerName = personState?.attributes.friendly_name ?? config.person;
    const headerIcon = personState?.attributes.icon ?? "mdi:account";

    return html`
      <ha-card>
        <div class="header">
          <ha-icon icon=${headerIcon}></ha-icon>
          <span class="wrap-text"
            >${title !== headerName ? `${title} — ${headerName}` : title}</span
          >
        </div>
        <div class="body">
          ${
            !personState
              ? html`<p class="empty-state">${t(hass, "silence.person_missing")}</p>`
              : nothing
          }
          ${this._renderSilencedStatus(silencedState)} ${this._renderSnoozes(snoozesState)}
          ${this._renderLastNotification(lastNotificationState)} ${this._renderActions(config)}
        </div>
      </ha-card>
    `;
  }

  private _renderSilencedStatus(
    silencedState: HomeAssistant["states"][string] | undefined,
  ): TemplateResult {
    const hass = this.hass;
    let text: string;
    let chipClass: string;
    if (!silencedState) {
      text = t(hass, "silence.state.unknown");
      chipClass = "chip-neutral";
    } else if (silencedState.state === "on") {
      text = t(hass, "silence.state.silenced");
      chipClass = "chip-active";
    } else {
      text = t(hass, "silence.state.not_silenced");
      chipClass = "chip-acknowledged";
    }
    return html`
      <div class="status-row">
        <span class="chip ${chipClass}">${text}</span>
      </div>
    `;
  }

  private _renderSnoozes(
    snoozesState: HomeAssistant["states"][string] | undefined,
  ): TemplateResult {
    const hass = this.hass;
    const count = snoozesState ? Number(snoozesState.state) : 0;
    const text =
      Number.isFinite(count) && count > 0
        ? t(hass, "silence.snoozes.count", { count })
        : t(hass, "silence.snoozes.none");
    return html`<div class="detail wrap-text">${text}</div>`;
  }

  private _renderLastNotification(
    lastNotificationState: HomeAssistant["states"][string] | undefined,
  ): TemplateResult {
    const hass = this.hass;
    const state = lastNotificationState?.state;
    if (!state || state === "unknown" || state === "unavailable" || state === "none") {
      return html`<div class="detail wrap-text">${t(hass, "silence.last_notification.none")}</div>`;
    }
    const asDate = new Date(state);
    const value = Number.isNaN(asDate.getTime())
      ? state
      : formatRelativeDuration(
          state,
          hass?.locale?.language ?? hass?.language ?? "en",
          new Date(this._now),
        );
    return html`
      <div class="detail wrap-text">${t(hass, "silence.last_notification.label", { value })}</div>
    `;
  }

  private _renderActions(config: SwitchboardSilenceTileConfig): TemplateResult {
    const hass = this.hass;
    if (!hass) return html``;

    const canSilence = hasRouterService(hass, "silence");
    const canUnsnooze = hasRouterService(hass, "unsnooze");
    const canClear = canSilence || canUnsnooze;
    const wakeTime = config.wake_time ?? DEFAULT_WAKE_TIME;
    const wakeMinutes = minutesUntilWakeTime(wakeTime);
    const tooltip = t(hass, "silence.service_unavailable");

    return html`
      <div class="actions">
        <button
          class="action-button touch-target"
          type="button"
          aria-label="${t(hass, "silence.action.silence_1h")}"
          title=${canSilence ? nothing : tooltip}
          ?disabled=${!canSilence}
          @click=${() => this._silence(60)}
        >
          ${t(hass, "silence.action.silence_1h")}
        </button>
        <button
          class="action-button touch-target"
          type="button"
          aria-label="${t(hass, "silence.action.until_wake")}"
          title=${canSilence && wakeMinutes !== null ? nothing : tooltip}
          ?disabled=${!canSilence || wakeMinutes === null}
          @click=${() => wakeMinutes !== null && this._silence(wakeMinutes)}
        >
          ${t(hass, "silence.action.until_wake")}
        </button>
        <button
          class="action-button touch-target"
          type="button"
          aria-label="${t(hass, "silence.action.clear")}"
          title=${canClear ? nothing : tooltip}
          ?disabled=${!canClear}
          @click=${() => this._clear()}
        >
          ${t(hass, "silence.action.clear")}
        </button>
      </div>
    `;
  }

  private async _silence(minutes: number): Promise<void> {
    const hass = this.hass;
    const person = this._config?.person;
    if (!hass || !person || !hasRouterService(hass, "silence")) return;
    await hass.callService(SWITCHBOARD_DOMAIN, "silence", { person, minutes });
  }

  private async _clear(): Promise<void> {
    const hass = this.hass;
    const person = this._config?.person;
    if (!hass || !person) return;
    if (hasRouterService(hass, "unsnooze")) {
      await hass.callService(SWITCHBOARD_DOMAIN, "unsnooze", { person });
    }
    if (hasRouterService(hass, "silence")) {
      await hass.callService(SWITCHBOARD_DOMAIN, "silence", { person, minutes: 0 });
    }
  }
}

if (!customElements.get("switchboard-silence-tile")) {
  customElements.define("switchboard-silence-tile", SwitchboardSilenceTile);
}
