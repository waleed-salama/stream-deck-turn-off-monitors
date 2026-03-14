import streamDeck from "@elgato/streamdeck";

import { TurnOffDisplays } from "./actions/turn-off-displays";

streamDeck.logger.setLevel(process.env.ROLLUP_WATCH ? "debug" : "info");

streamDeck.actions.registerAction(new TurnOffDisplays());

streamDeck.connect();
