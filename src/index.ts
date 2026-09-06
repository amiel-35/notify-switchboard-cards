import "./cards/alerts-card/switchboard-alerts-card";
import "./cards/alerts-card/switchboard-alerts-card-editor";
import "./cards/silence-tile/switchboard-silence-tile";
import "./cards/silence-tile/switchboard-silence-tile-editor";
import type { CustomCardEntry } from "./ha-types";
import { CARD_VERSION } from "./version";

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

// Version banner, so an issue report can state which build is loaded
// without digging through HACS.
console.info(
  `%c NOTIFY-SWITCHBOARD-CARDS %c ${CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: #03a9f4; background: white; font-weight: 700;",
);

export { SwitchboardAlertsCard } from "./cards/alerts-card/switchboard-alerts-card";
export { SwitchboardAlertsCardEditor } from "./cards/alerts-card/switchboard-alerts-card-editor";
export { SwitchboardSilenceTile } from "./cards/silence-tile/switchboard-silence-tile";
export { SwitchboardSilenceTileEditor } from "./cards/silence-tile/switchboard-silence-tile-editor";
