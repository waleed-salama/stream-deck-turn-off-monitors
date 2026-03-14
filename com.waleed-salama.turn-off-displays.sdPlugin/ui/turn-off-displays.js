const manageAudioInput = document.getElementById("manageAudioWhileAway");

let websocket;
let propertyInspectorUuid = "";
let actionUuid = "";
let actionContext = "";
let settings = normalizeSettings({});

function normalizeSettings(value) {
  const manageAudioWhileAway = value.manageAudioWhileAway === true || value.manageAudioWhileLocked === true;

  return {
    manageAudioWhileAway,
  };
}

function render(nextSettings) {
  settings = normalizeSettings(nextSettings);
  manageAudioInput.checked = settings.manageAudioWhileAway;
}

function persistSettings() {
  render({
    manageAudioWhileAway: manageAudioInput.checked,
  });

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

manageAudioInput.addEventListener("change", persistSettings);

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
        uuid,
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
    }
  });
};
