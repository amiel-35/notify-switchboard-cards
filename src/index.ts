import "./cards/alerts-card/switchboard-alerts-card";
import "./cards/alerts-card/switchboard-alerts-card-editor";
import "./cards/silence-tile/switchboard-silence-tile";
import "./cards/silence-tile/switchboard-silence-tile-editor";
import type { CustomCardEntry } from "./ha-types";

const CARDS: CustomCardEntry[] = [
  {
    type: "switchboard-alerts-card",
    name: "Notify Switchboard — Alerts",
    description:
      "Lists alert.* entities routed through Notify Switchboard, with acknowledge and snooze actions.",
    preview: true,
    documentationURL: "https://github.com/amiel-35/notify-switchboard-cards",
  },
  {
    type: "switchboard-silence-tile",
    name: "Notify Switchboard — Silence tile",
    description: "Shows and controls one person's Notify Switchboard silence and snooze state.",
    preview: true,
    documentationURL: "https://github.com/amiel-35/notify-switchboard-cards",
  },
];

window.customCards = window.customCards || [];
window.customCards.push(...CARDS);

export { SwitchboardAlertsCard } from "./cards/alerts-card/switchboard-alerts-card";
export { SwitchboardAlertsCardEditor } from "./cards/alerts-card/switchboard-alerts-card-editor";
export { SwitchboardSilenceTile } from "./cards/silence-tile/switchboard-silence-tile";
export { SwitchboardSilenceTileEditor } from "./cards/silence-tile/switchboard-silence-tile-editor";
