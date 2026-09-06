import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import type { HomeAssistant, LovelaceCardConfig, LovelaceCardEditor } from "../../ha-types";
import type { SwitchboardSilenceTileConfig } from "../../types";
import { DEFAULT_WAKE_TIME } from "../../types";
import { sharedStyles } from "../../styles/shared-styles";
import { fireEvent } from "../../utils/fire-event";
import { t } from "../../i18n";

export class SwitchboardSilenceTileEditor extends LitElement implements LovelaceCardEditor {
  static override styles = [
    sharedStyles,
    css`
      .row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 16px;
      }

      label {
        font-weight: 500;
      }

      input,
      select {
        font: inherit;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
        background: var(--card-background-color, transparent);
        color: var(--primary-text-color);
        min-height: 48px;
      }
    `,
  ];

  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  hass?: HomeAssistant;
  private _config?: SwitchboardSilenceTileConfig;

  setConfig(config: LovelaceCardConfig): void {
    this._config = config as SwitchboardSilenceTileConfig;
  }

  private _emit(patch: Partial<SwitchboardSilenceTileConfig>): void {
    if (!this._config) return;
    const config: SwitchboardSilenceTileConfig = { ...this._config, ...patch };
    this._config = config;
    fireEvent(this, "config-changed", { config });
  }

  private _personOptions(): string[] {
    return Object.keys(this.hass?.states ?? {}).filter((id) => id.startsWith("person."));
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._config) {
      return nothing;
    }
    const config = this._config;
    const personOptions = this._personOptions();

    return html`
      <div class="row">
        <label for="person">${t(this.hass, "editor.person")}</label>
        <input
          id="person"
          type="text"
          list="switchboard-person-options"
          .value=${config.person ?? ""}
          @change=${(e: Event) => this._emit({ person: (e.target as HTMLInputElement).value })}
        />
        <datalist id="switchboard-person-options">
          ${personOptions.map((id) => html`<option value=${id}></option>`)}
        </datalist>
      </div>

      <div class="row">
        <label for="wake_time">${t(this.hass, "editor.wake_time")}</label>
        <input
          id="wake_time"
          type="time"
          .value=${config.wake_time ?? DEFAULT_WAKE_TIME}
          @change=${(e: Event) =>
            this._emit({ wake_time: (e.target as HTMLInputElement).value || DEFAULT_WAKE_TIME })}
        />
      </div>

      <div class="row">
        <label for="title">${t(this.hass, "editor.title")}</label>
        <input
          id="title"
          type="text"
          .value=${config.title ?? ""}
          @input=${(e: Event) => this._emit({ title: (e.target as HTMLInputElement).value })}
        />
      </div>
    `;
  }
}

if (!customElements.get("switchboard-silence-tile-editor")) {
  customElements.define("switchboard-silence-tile-editor", SwitchboardSilenceTileEditor);
}
