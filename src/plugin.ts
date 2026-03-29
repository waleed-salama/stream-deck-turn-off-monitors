import streamDeck from "@elgato/streamdeck";

import { ReinitializeDisplay } from "./actions/reinitialize-display";
import { TurnOffDisplays } from "./actions/turn-off-displays";

/**
 * Plugin bootstrap.
 *
 * Stream Deck loads this module as the backend entry point declared in the
 * plugin manifest. Its only job is to configure logging, register actions,
 * and open the WebSocket connection back to the Stream Deck host app.
 */
streamDeck.logger.setLevel(process.env.ROLLUP_WATCH ? "debug" : "info");

streamDeck.actions.registerAction(new TurnOffDisplays());
streamDeck.actions.registerAction(new ReinitializeDisplay());

streamDeck.connect();
