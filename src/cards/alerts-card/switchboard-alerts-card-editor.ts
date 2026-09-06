import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import type { HomeAssistant, LovelaceCardConfig, LovelaceCardEditor } from "../../ha-types";
import type { SwitchboardAlertsCardConfig, TargetMap } from "../../types";
import { DEFAULT_SNOOZE_MINUTES } from "../../types";
import { sharedStyles } from "../../styles/shared-styles";
import { fireEvent } from "../../utils/fire-event";
import { t } from "../../i18n";

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseTargetMap(value: string): TargetMap {
  const map: TargetMap = {};
  for (const line of parseLines(value)) {
    const [entity, slug] = line.split(":").map((part) => part?.trim());
    if (entity && slug) {
      map[entity] = slug;
    }
  }
  return map;
}

function parseMinutes(value: string): number[] {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isFinite(num) && num > 0);
}

/**
 * Hand-rolled visual editor: plain inputs and textareas rather than
 * `ha-form`/`ha-entity-picker`, so the editor has no dependency on
 * frontend-internal elements and stays trivially testable.
 */
export class SwitchboardAlertsCardEditor extends LitElement implements LovelaceCardEditor {
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
      textarea,
      select {
        font: inherit;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
        background: var(--card-background-color, transparent);
        color: var(--primary-text-color);
        min-height: 48px;
      }

      textarea {
        min-height: 96px;
        font-family: monospace;
      }

      .checkbox-row {
        flex-direction: row;
        align-items: center;
        gap: 8px;
      }

      .checkbox-row input {
        min-height: 24px;
        min-width: 24px;
        width: 24px;
        height: 24px;
      }
    `,
  ];

  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  hass?: HomeAssistant;
  private _config?: SwitchboardAlertsCardConfig;

  setConfig(config: LovelaceCardConfig): void {
    this._config = config as SwitchboardAlertsCardConfig;
  }

  private _emit(patch: Partial<SwitchboardAlertsCardConfig>): void {
    if (!this._config) return;
    const config: SwitchboardAlertsCardConfig = { ...this._config, ...patch };
    this._config = config;
    fireEvent(this, "config-changed", { config });
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._config) {
      return nothing;
    }
    const config = this._config;

    return html`
      <div class="row">
        <label for="title">${t(this.hass, "editor.title")}</label>
        <input
          id="title"
          type="text"
          .value=${config.title ?? ""}
          @input=${(e: Event) => this._emit({ title: (e.target as HTMLInputElement).value })}
        />
      </div>

      <div class="row">
        <label for="mode">${t(this.hass, "editor.mode")}</label>
        <select
          id="mode"
          .value=${config.mode ?? "full"}
          @change=${(e: Event) =>
            this._emit({ mode: (e.target as HTMLSelectElement).value as "compact" | "full" })}
        >
          <option value="full">${t(this.hass, "editor.mode.full")}</option>
          <option value="compact">${t(this.hass, "editor.mode.compact")}</option>
        </select>
      </div>

      <div class="row checkbox-row">
        <input
          id="show_acknowledged"
          type="checkbox"
          .checked=${config.show_acknowledged ?? true}
          @change=${(e: Event) =>
            this._emit({ show_acknowledged: (e.target as HTMLInputElement).checked })}
        />
        <label for="show_acknowledged">${t(this.hass, "editor.show_acknowledged")}</label>
      </div>

      <div class="row">
        <label for="entities">${t(this.hass, "editor.entities")}</label>
        <textarea
          id="entities"
          .value=${(config.entities ?? []).join("\n")}
          @change=${(e: Event) =>
            this._emit({ entities: parseLines((e.target as HTMLTextAreaElement).value) })}
        ></textarea>
      </div>

      <div class="row">
        <label for="target_map">${t(this.hass, "editor.target_map")}</label>
        <textarea
          id="target_map"
          .value=${Object.entries(config.target_map ?? {})
            .map(([entity, slug]) => `${entity}: ${slug}`)
            .join("\n")}
          @change=${(e: Event) =>
            this._emit({ target_map: parseTargetMap((e.target as HTMLTextAreaElement).value) })}
        ></textarea>
      </div>

      <div class="row">
        <label for="snooze_minutes">${t(this.hass, "editor.snooze_minutes")}</label>
        <input
          id="snooze_minutes"
          type="text"
          .value=${(config.snooze_minutes ?? DEFAULT_SNOOZE_MINUTES).join(", ")}
          @change=${(e: Event) =>
            this._emit({ snooze_minutes: parseMinutes((e.target as HTMLInputElement).value) })}
        />
      </div>
    `;
  }
}

if (!customElements.get("switchboard-alerts-card-editor")) {
  customElements.define("switchboard-alerts-card-editor", SwitchboardAlertsCardEditor);
}
