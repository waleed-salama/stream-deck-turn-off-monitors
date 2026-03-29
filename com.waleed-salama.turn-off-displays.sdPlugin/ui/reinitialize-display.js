const betterDisplayPathInput = document.getElementById("betterDisplayPath");
const scanDisplaysButton = document.getElementById("scanDisplays");
const scanStatus = document.getElementById("scanStatus");
const displayList = document.getElementById("displayList");

const DEFAULT_BETTERDISPLAY_PATH = "/Applications/BetterDisplay.app/Contents/MacOS/BetterDisplay";

let websocket;
let propertyInspectorUuid = "";
let actionUuid = "";
let actionContext = "";
let settings = normalizeSettings({});
let availableDisplays = [];

function normalizeSettings(value) {
  return {
    betterDisplayPath: typeof value.betterDisplayPath === "string" && value.betterDisplayPath.trim().length > 0
      ? value.betterDisplayPath.trim()
      : DEFAULT_BETTERDISPLAY_PATH,
    selectedDisplayTagIds: Array.isArray(value.selectedDisplayTagIds)
      ? value.selectedDisplayTagIds.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
      : [],
  };
}

function render(nextSettings) {
  settings = normalizeSettings(nextSettings);
  betterDisplayPathInput.value = settings.betterDisplayPath;
  renderDisplayList();
}

function renderDisplayList() {
  displayList.textContent = "";

  if (availableDisplays.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No scan results yet.";
    displayList.appendChild(emptyState);
    return;
  }

  availableDisplays.forEach((display) => {
    const row = document.createElement("label");
    row.className = "display-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = settings.selectedDisplayTagIds.includes(display.tagId);
    checkbox.addEventListener("change", () => {
      const selectedDisplayTagIds = checkbox.checked
        ? [...new Set([...settings.selectedDisplayTagIds, display.tagId])]
        : settings.selectedDisplayTagIds.filter((entry) => entry !== display.tagId);

      persistSettings({
        ...settings,
        selectedDisplayTagIds,
      });
    });

    const copy = document.createElement("span");
    copy.className = "display-copy";

    const title = document.createElement("span");
    title.className = "display-title";
    title.textContent = display.name;

    const meta = document.createElement("span");
    meta.className = "display-meta";

    const details = [`tagID ${display.tagId}`];
    if (display.originalName && display.originalName !== display.name) {
      details.push(display.originalName);
    }

    meta.textContent = details.join(" · ");

    copy.appendChild(title);
    copy.appendChild(meta);
    row.appendChild(checkbox);
    row.appendChild(copy);
    displayList.appendChild(row);
  });
}

function persistSettings(nextSettings) {
  render(nextSettings);

  if (!websocket || websocket.readyState !== WebSocket.OPEN || !propertyInspectorUuid) {
    return;
  }

  websocket.send(
    JSON.stringify({
      event: "setSettings",
      context: propertyInspectorUuid,
      action: actionUuid,
      payload: settings,
    })
  );
}

function scanDisplays() {
  persistSettings({
    ...settings,
    betterDisplayPath: betterDisplayPathInput.value,
  });

  if (!websocket || websocket.readyState !== WebSocket.OPEN || !actionContext) {
    return;
  }

  scanStatus.dataset.state = "loading";
  scanStatus.textContent = "Scanning BetterDisplay displays...";

  websocket.send(
    JSON.stringify({
      event: "sendToPlugin",
      context: actionContext,
      action: actionUuid,
      payload: {
        type: "scan-displays",
        betterDisplayPath: settings.betterDisplayPath,
      },
    })
  );
}

betterDisplayPathInput.addEventListener("change", () => {
  persistSettings({
    ...settings,
    betterDisplayPath: betterDisplayPathInput.value,
  });
});

scanDisplaysButton.addEventListener("click", scanDisplays);

window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, actionInfo) => {
  const parsedActionInfo = JSON.parse(actionInfo);
  propertyInspectorUuid = uuid;
  actionUuid = parsedActionInfo.action;
  actionContext = parsedActionInfo.context;
  render(parsedActionInfo.payload?.settings || {});

  websocket = new WebSocket(`ws://127.0.0.1:${port}`);

  websocket.addEventListener("open", () => {
    websocket.send(
      JSON.stringify({
        event: registerEvent,
        uuid: propertyInspectorUuid,
      })
    );

    websocket.send(
      JSON.stringify({
        event: "getSettings",
        context: propertyInspectorUuid,
      })
    );
  });

  websocket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.event === "didReceiveSettings" && message.context === actionContext) {
      render(message.payload?.settings || {});
      return;
    }

    if (message.event === "sendToPropertyInspector" && message.context === actionContext) {
      const payload = message.payload || {};

      if (payload.type !== "display-scan-result") {
        return;
      }

      availableDisplays = Array.isArray(payload.displays) ? payload.displays : [];

      if (typeof payload.error === "string" && payload.error.length > 0) {
        scanStatus.dataset.state = "error";
        scanStatus.textContent = `Scan failed: ${payload.error}`;
      } else if (availableDisplays.length === 0) {
        scanStatus.dataset.state = "idle";
        scanStatus.textContent = "No BetterDisplay-managed displays found.";
      } else {
        scanStatus.dataset.state = "success";
        scanStatus.textContent = `Found ${availableDisplays.length} display${availableDisplays.length === 1 ? "" : "s"}.`;
      }

      renderDisplayList();
    }
  });
};
