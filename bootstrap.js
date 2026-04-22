var DOIDedupImportPlugin;

function log(msg) {
  Zotero.debug("DOI Dedup Import: " + msg);
}

function install() {
  log("Installed");
}

async function startup({ id, version, rootURI }) {
  log(`Starting ${version}`);
  Services.scriptloader.loadSubScript(rootURI + "doi-dedup-import-plugin.js");
  DOIDedupImportPlugin.init({ id, version, rootURI });
  DOIDedupImportPlugin.addToAllWindows();
}

function onMainWindowLoad({ window }) {
  DOIDedupImportPlugin.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  DOIDedupImportPlugin.removeFromWindow(window);
}

function shutdown() {
  log("Shutting down");
  if (DOIDedupImportPlugin) {
    DOIDedupImportPlugin.removeFromAllWindows();
    DOIDedupImportPlugin = undefined;
  }
}

function uninstall() {
  log("Uninstalled");
}
