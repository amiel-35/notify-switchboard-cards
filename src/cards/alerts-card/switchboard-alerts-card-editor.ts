import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import type {
  HaFormSchemaEntry,
  HaFormValueChangedDetail,
  HomeAssistant,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "../../ha-types";
import type { SwitchboardAlertsCardConfig } from "../../types";
import { DEFAULT_SNOOZE_MINUTES } from "../../types";
import { sharedStyles } from "../../styles/shared-styles";
import { fireEvent } from "../../utils/fire-event";
import { t, type TranslationKey } from "../../i18n";
import { isHaFormAvailable, prune } from "../../utils/editor-form";

const SNOOZE_PRESETS = ["5", "15", "30", "60", "120", "480"];

/**
 * Visual editor built on `ha-form`. `ha-form` and `ha-selector` are runtime
 * globals registered by the Home Assistant frontend — they are referenced
 * from the template, never imported, and feature-detected so the editor
 * degrades to a YAML hint anywhere the frontend is not present.
 */
export class SwitchboardAlertsCardEditor extends LitElement implements LovelaceCardEditor {
  static override styles = [
    sharedStyles,
    css`
      .fallback {
        padding: 16px;
        color: var(--secondary-text-color);
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

  private _schema(): HaFormSchemaEntry[] {
    return [
      { name: "title", selector: { text: {} } },
      { name: "entities", selector: { entity: { domain: "alert", multiple: true } } },
      {
        name: "mode",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "full", label: t(this.hass, "editor.mode.full") },
              { value: "compact", label: t(this.hass, "editor.mode.compact") },
            ],
          },
        },
      },
      { name: "show_acknowledged", selector: { boolean: {} } },
      { name: "person", selector: { entity: { domain: "person" } } },
      {
        name: "snooze_minutes",
        selector: { select: { multiple: true, custom_value: true, options: SNOOZE_PRESETS } },
      },
      { name: "target_map", selector: { object: {} } },
    ];
  }

  /** `snooze_minutes` is numbers in YAML but strings in the select selector. */
  private _data(): Record<string, unknown> {
    const config = this._config ?? ({} as SwitchboardAlertsCardConfig);
    return {
      ...config,
      snooze_minutes: (config.snooze_minutes ?? DEFAULT_SNOOZE_MINUTES).map(String),
    };
  }

  private _computeLabel = (schema: { name: string }): string =>
    t(this.hass, `editor.${schema.name}` as TranslationKey);

  private _valueChanged = (event: CustomEvent<HaFormValueChangedDetail>): void => {
    event.stopPropagation();
    const value = { ...(event.detail?.value ?? {}) };

    if ("snooze_minutes" in value) {
      const minutes = (Array.isArray(value.snooze_minutes) ? value.snooze_minutes : [])
        .map((entry) => Number(entry))
        .filter((entry) => Number.isInteger(entry) && entry > 0);
      value.snooze_minutes = minutes;
    }

    const config = prune({
      ...this._config,
      ...value,
      type: this._config?.type ?? "custom:switchboard-alerts-card",
    }) as SwitchboardAlertsCardConfig;

    this._config = config;
    fireEvent(this, "config-changed", { config });
  };

  protected override render(): TemplateResult | typeof nothing {
    if (!this._config) {
      return nothing;
    }
    if (!isHaFormAvailable()) {
      return html`<p class="fallback wrap-text">${t(this.hass, "editor.form_unavailable")}</p>`;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._data()}
        .schema=${this._schema()}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

if (!customElements.get("switchboard-alerts-card-editor")) {
  customElements.define("switchboard-alerts-card-editor", SwitchboardAlertsCardEditor);
}
