// Внедрение выполняется только после нажатия значка или горячей клавиши.
const scripts = [
  "core.js",
  "dom.js",
  "adapters.js",
  "storage.js",
  "selection.js",
  "filling.js",
  "training.js",
  "panel.js",
  "content.js",
];
async function launch(tabId) {
  try {
    const [existing] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (!globalThis.__safuFiller?.instance) return false;
        globalThis.__safuFiller.instance.toggle();
        return true;
      },
    });
    if (!existing.result)
      await chrome.scripting.executeScript({ target: { tabId }, files: scripts });
    await chrome.action.setBadgeText({ tabId, text: "" });
    return { ok: true };
  } catch (error) {
    await chrome.action.setBadgeText({ tabId, text: "!" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b42318" });
    await chrome.action.setTitle({
      tabId,
      title:
        "Не удалось открыть. Используйте обычную http(s)-страницу; chrome:// и магазин Chrome недоступны. " +
        error.message,
    });
    return { ok: false, error: error.message };
  }
}
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) void launch(tab.id);
});
