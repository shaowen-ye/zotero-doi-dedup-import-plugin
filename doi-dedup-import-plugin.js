DOIDedupImportPlugin = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  windowStates: new WeakMap(),
  config: {
    saveAttachments: false,
    showSummaryForSingleSuccessfulImport: false,
    placeholderText: "可粘贴 DOI 或带 DOI 的纯文本\n支持 CRITICAL/HIGH/MODERATE 分组\n按 Enter 导入，Shift+Enter 换行",
    relevanceTagPrefix: "relevance:",
    markReusedTitles: true,
    reusedTitlePrefix: "♻️ ",
    lookupPanelLayoutPrefKey: "doiDedupImport.lookupPanelLayout",
    lookupPanelDefaultWidth: 560,
    lookupPanelDefaultHeight: 260,
    lookupPanelMinWidth: 420,
    lookupPanelMinHeight: 190
  },

  init({ id, version, rootURI }) {
    if (this.initialized) {
      return;
    }
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  },

  log(message) {
    Zotero.debug(`DOI Dedup Import: ${message}`);
  },

  addToAllWindows() {
    for (const window of Zotero.getMainWindows()) {
      if (!window.ZoteroPane) {
        continue;
      }
      this.addToWindow(window);
    }
  },

  removeFromAllWindows() {
    for (const window of Zotero.getMainWindows()) {
      if (!window.ZoteroPane) {
        continue;
      }
      this.removeFromWindow(window);
    }
  },

  addToWindow(window) {
    if (this.windowStates.has(window)) {
      return;
    }

    const lookup = window.Zotero_Lookup;
    if (!lookup || typeof lookup.addItemsFromIdentifier !== "function") {
      this.log("Zotero_Lookup is not available in this window");
      return;
    }

    const panel = window.document.getElementById("zotero-lookup-panel");
    const state = {
      lookup,
      panel,
      originalAddItemsFromIdentifier: lookup.addItemsFromIdentifier,
      originalPlaceholder: null,
      onPopupShown: null,
      dragHandle: null,
      resizeHandle: null
    };

    const plugin = this;
    lookup.addItemsFromIdentifier = async function (textBox, childItem, toggleProgress) {
      return plugin.handleLookupAddItemsFromIdentifier(window, state, textBox, childItem, toggleProgress);
    };

    if (panel) {
      state.onPopupShown = function (event) {
        if (event.originalTarget && event.originalTarget.id !== "zotero-lookup-panel") {
          return;
        }
        plugin.prepareLookupPanel(window, state);
      };
      panel.addEventListener("popupshown", state.onPopupShown);
    }

    this.windowStates.set(window, state);
  },

  removeFromWindow(window) {
    const state = this.windowStates.get(window);
    if (!state) {
      return;
    }

    if (state.lookup && state.originalAddItemsFromIdentifier) {
      state.lookup.addItemsFromIdentifier = state.originalAddItemsFromIdentifier;
    }

    if (state.panel && state.onPopupShown) {
      state.panel.removeEventListener("popupshown", state.onPopupShown);
    }

    this.removeLookupPanelControls(state);

    const textBox = window.document.getElementById("zotero-lookup-textbox");
    if (textBox && state.originalPlaceholder !== null) {
      if (state.originalPlaceholder) {
        textBox.setAttribute("placeholder", state.originalPlaceholder);
      } else {
        textBox.removeAttribute("placeholder");
      }
    }

    this.windowStates.delete(window);
  },

  prepareLookupPanel(window, state) {
    const textBox = window.document.getElementById("zotero-lookup-textbox");
    if (!textBox || !window.Zotero_Lookup || typeof window.Zotero_Lookup.setMultiline !== "function") {
      return;
    }

    if (state.originalPlaceholder === null) {
      state.originalPlaceholder = textBox.getAttribute("placeholder") || "";
    }

    window.Zotero_Lookup.setMultiline(true);
    textBox.setAttribute("placeholder", this.config.placeholderText);
    this.setupLookupPanelControls(window, state, textBox);
    this.applySavedLookupPanelLayout(window, state.panel, textBox);
    window.setTimeout(() => {
      try {
        textBox.focus();
      } catch (error) {
        this.log(`Failed to focus lookup textbox: ${error}`);
      }
    }, 0);
  },

  createXULElement(document, tagName) {
    if (typeof document.createXULElement === "function") {
      return document.createXULElement(tagName);
    }
    return document.createElement(tagName);
  },

  setupLookupPanelControls(window, state, textBox) {
    const panel = state.panel;
    if (!panel || state.dragHandle || state.resizeHandle) {
      return;
    }

    panel.setAttribute("data-doi-dedup-managed", "true");
    panel.style.minWidth = `${this.config.lookupPanelMinWidth}px`;
    panel.style.minHeight = `${this.config.lookupPanelMinHeight}px`;

    const document = window.document;
    const dragHandle = this.createXULElement(document, "hbox");
    dragHandle.setAttribute("class", "doi-dedup-lookup-drag-handle");
    dragHandle.setAttribute("align", "center");
    dragHandle.setAttribute("pack", "center");
    dragHandle.setAttribute("tooltiptext", "拖动移动窗口");
    dragHandle.style.cssText = [
      "min-height: 22px",
      "padding: 2px 8px",
      "cursor: move",
      "font-size: 12px",
      "font-weight: 600",
      "color: #5f6368",
      "background: rgba(0, 0, 0, 0.04)",
      "border-bottom: 1px solid rgba(0, 0, 0, 0.10)",
      "user-select: none"
    ].join(";");

    const label = this.createXULElement(document, "label");
    label.setAttribute("value", "DOI 去重导入");
    label.style.cssText = "pointer-events: none;";
    dragHandle.appendChild(label);

    const resizeHandle = this.createXULElement(document, "box");
    resizeHandle.setAttribute("class", "doi-dedup-lookup-resize-handle");
    resizeHandle.setAttribute("tooltiptext", "拖动调整大小");
    resizeHandle.style.cssText = [
      "width: 18px",
      "height: 18px",
      "align-self: flex-end",
      "cursor: nwse-resize",
      "margin: -18px 2px 2px auto",
      "position: relative",
      "z-index: 10",
      "background: linear-gradient(135deg, transparent 0 45%, rgba(0,0,0,0.25) 46% 54%, transparent 55% 100%)"
    ].join(";");

    panel.insertBefore(dragHandle, panel.firstChild);
    panel.appendChild(resizeHandle);

    dragHandle.addEventListener("mousedown", (event) => this.startLookupPanelDrag(window, state, event));
    resizeHandle.addEventListener("mousedown", (event) => this.startLookupPanelResize(window, state, textBox, event));

    state.dragHandle = dragHandle;
    state.resizeHandle = resizeHandle;
  },

  removeLookupPanelControls(state) {
    if (state.dragHandle && state.dragHandle.parentNode) {
      state.dragHandle.parentNode.removeChild(state.dragHandle);
    }
    if (state.resizeHandle && state.resizeHandle.parentNode) {
      state.resizeHandle.parentNode.removeChild(state.resizeHandle);
    }
    state.dragHandle = null;
    state.resizeHandle = null;
  },

  getLookupPanelLayout() {
    const fallback = {
      width: this.config.lookupPanelDefaultWidth,
      height: this.config.lookupPanelDefaultHeight
    };
    const value = this.getPrefJSON(this.config.lookupPanelLayoutPrefKey, fallback);
    return value && typeof value === "object" ? Object.assign({}, fallback, value) : fallback;
  },

  normalizeLookupPanelLayout(layout) {
    const width = Math.max(this.config.lookupPanelMinWidth, Math.round(Number(layout.width) || this.config.lookupPanelDefaultWidth));
    const height = Math.max(this.config.lookupPanelMinHeight, Math.round(Number(layout.height) || this.config.lookupPanelDefaultHeight));
    const normalized = { width, height };
    if (Number.isFinite(Number(layout.x)) && Number.isFinite(Number(layout.y))) {
      normalized.x = Math.round(Number(layout.x));
      normalized.y = Math.round(Number(layout.y));
    }
    return normalized;
  },

  applySavedLookupPanelLayout(window, panel, textBox) {
    if (!panel || !textBox) {
      return;
    }
    const layout = this.normalizeLookupPanelLayout(this.getLookupPanelLayout());
    this.applyLookupPanelSize(panel, textBox, layout.width, layout.height);
    if (typeof panel.moveTo === "function" && Number.isFinite(layout.x) && Number.isFinite(layout.y)) {
      window.setTimeout(() => {
        try {
          panel.moveTo(layout.x, layout.y);
        } catch (error) {
          this.log(`Unable to move lookup panel: ${error}`);
        }
      }, 0);
    }
  },

  applyLookupPanelSize(panel, textBox, width, height) {
    const normalized = this.normalizeLookupPanelLayout({ width, height });
    panel.style.width = `${normalized.width}px`;
    panel.style.minWidth = `${this.config.lookupPanelMinWidth}px`;
    panel.style.minHeight = `${this.config.lookupPanelMinHeight}px`;
    if (typeof panel.sizeTo === "function") {
      try {
        panel.sizeTo(normalized.width, normalized.height);
      } catch (error) {
        this.log(`Unable to size lookup panel: ${error}`);
      }
    }

    const textWidth = Math.max(320, normalized.width - 36);
    const textHeight = Math.max(96, normalized.height - 112);
    textBox.style.width = `${textWidth}px`;
    textBox.style.minWidth = `${textWidth}px`;
    textBox.style.height = `${textHeight}px`;
    textBox.style.minHeight = "96px";
  },

  getLookupPanelScreenRect(window, panel) {
    const rect = typeof panel.getBoundingClientRect === "function"
      ? panel.getBoundingClientRect()
      : { left: 0, top: 0, width: this.config.lookupPanelDefaultWidth, height: this.config.lookupPanelDefaultHeight };
    const boxObject = panel.boxObject || {};
    const x = Number.isFinite(panel.screenX) ? panel.screenX
      : Number.isFinite(boxObject.screenX) ? boxObject.screenX
        : Math.round((window.mozInnerScreenX || window.screenX || 0) + rect.left);
    const y = Number.isFinite(panel.screenY) ? panel.screenY
      : Number.isFinite(boxObject.screenY) ? boxObject.screenY
        : Math.round((window.mozInnerScreenY || window.screenY || 0) + rect.top);
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(rect.width || boxObject.width || this.config.lookupPanelDefaultWidth),
      height: Math.round(rect.height || boxObject.height || this.config.lookupPanelDefaultHeight)
    };
  },

  startLookupPanelDrag(window, state, event) {
    if (event.button !== 0 || !state.panel || typeof state.panel.moveTo !== "function") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const start = this.getLookupPanelScreenRect(window, state.panel);
    const startX = event.screenX;
    const startY = event.screenY;

    const onMove = (moveEvent) => {
      const x = start.x + (moveEvent.screenX - startX);
      const y = start.y + (moveEvent.screenY - startY);
      try {
        state.panel.moveTo(x, y);
      } catch (error) {
        this.log(`Unable to drag lookup panel: ${error}`);
      }
    };

    const onUp = () => {
      window.document.removeEventListener("mousemove", onMove, true);
      window.document.removeEventListener("mouseup", onUp, true);
      const current = this.getLookupPanelScreenRect(window, state.panel);
      const saved = this.normalizeLookupPanelLayout(Object.assign(this.getLookupPanelLayout(), {
        x: current.x,
        y: current.y
      }));
      this.savePrefJSON(this.config.lookupPanelLayoutPrefKey, saved);
    };

    window.document.addEventListener("mousemove", onMove, true);
    window.document.addEventListener("mouseup", onUp, true);
  },

  startLookupPanelResize(window, state, textBox, event) {
    if (event.button !== 0 || !state.panel) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const start = this.getLookupPanelScreenRect(window, state.panel);
    const startX = event.screenX;
    const startY = event.screenY;

    const onMove = (moveEvent) => {
      const width = start.width + (moveEvent.screenX - startX);
      const height = start.height + (moveEvent.screenY - startY);
      this.applyLookupPanelSize(state.panel, textBox, width, height);
    };

    const onUp = () => {
      window.document.removeEventListener("mousemove", onMove, true);
      window.document.removeEventListener("mouseup", onUp, true);
      const current = this.getLookupPanelScreenRect(window, state.panel);
      const saved = this.normalizeLookupPanelLayout(Object.assign(this.getLookupPanelLayout(), {
        width: current.width,
        height: current.height
      }));
      this.savePrefJSON(this.config.lookupPanelLayoutPrefKey, saved);
    };

    window.document.addEventListener("mousemove", onMove, true);
    window.document.addEventListener("mouseup", onUp, true);
  },

  async handleLookupAddItemsFromIdentifier(window, state, textBox, childItem, toggleProgress) {
    const original = state.originalAddItemsFromIdentifier;
    const lookup = state.lookup;

    if (childItem) {
      return original.call(lookup, textBox, childItem, toggleProgress);
    }

    const extractedIdentifiers = Zotero.Utilities.extractIdentifiers(textBox.value || "");
    if (!extractedIdentifiers.length || !extractedIdentifiers.every((entry) => !!entry.DOI)) {
      return original.call(lookup, textBox, childItem, toggleProgress);
    }

    const parsed = this.parseDOIInput(textBox.value || "");
    if (!parsed.orderedDOIs.length) {
      return original.call(lookup, textBox, childItem, toggleProgress);
    }

    const target = this.resolveLookupTarget(window);
    toggleProgress(true);

    try {
      const summary = await this.processDOIList({
        libraryID: target.libraryID,
        collectionID: target.collectionID,
        parsed
      });

      if (!summary.resultItems.length && (summary.skipped.length || summary.failed.length)) {
        this.showSummary(window, summary);
        return false;
      }

      if (this.shouldShowSummary(summary)) {
        this.showSummary(window, summary);
      }

      return summary.resultItems;
    } catch (error) {
      Zotero.logError(error);
      Zotero.alert(window, "DOI 导入失败", error && error.message ? error.message : String(error));
      return false;
    } finally {
      toggleProgress(false);
    }
  },

  resolveLookupTarget(window) {
    let libraryID = Zotero.Libraries.userLibraryID;
    let collectionID = null;

    try {
      libraryID = window.ZoteroPane.getSelectedLibraryID();
      const collection = window.ZoteroPane.getSelectedCollection();
      collectionID = collection ? collection.id : null;
    } catch (error) {
      this.log(`Unable to resolve selected library/collection: ${error}`);
    }

    return { libraryID, collectionID };
  },

  normalizeDOI(value) {
    const cleaned = Zotero.Utilities.cleanDOI((value || "").trim());
    return cleaned ? cleaned.toLowerCase() : null;
  },

  normalizeRelevanceLevel(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[：:]/g, "")
      .replace(/[_\-\s]+/g, "");

    const aliases = {
      critical: "critical",
      crit: "critical",
      核心: "critical",
      关键: "critical",
      high: "high",
      高: "high",
      高相关: "high",
      moderate: "moderate",
      medium: "moderate",
      med: "moderate",
      中: "moderate",
      中等: "moderate",
      中相关: "moderate",
      low: "low",
      低: "low",
      低相关: "low"
    };

    return aliases[normalized] || null;
  },

  getRelevancePriority(level) {
    const priorities = {
      critical: 4,
      high: 3,
      moderate: 2,
      low: 1
    };
    return priorities[level] || 0;
  },

  chooseStrongerRelevance(left, right) {
    if (!left) {
      return right || null;
    }
    if (!right) {
      return left || null;
    }
    return this.getRelevancePriority(right) > this.getRelevancePriority(left) ? right : left;
  },

  detectLineRelevance(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed) {
      return null;
    }

    const exact = this.normalizeRelevanceLevel(trimmed);
    if (exact) {
      return exact;
    }

    for (const separator of ["\t", ",", "，", ";", "；", "|"]) {
      const parts = trimmed.split(separator).map((part) => part.trim()).filter(Boolean);
      if (parts.length !== 2) {
        continue;
      }
      const left = this.normalizeRelevanceLevel(parts[0]);
      const right = this.normalizeRelevanceLevel(parts[1]);
      if (left) {
        return left;
      }
      if (right) {
        return right;
      }
    }

    return null;
  },

  extractDOIsFromText(rawText) {
    const identifiers = Zotero.Utilities.extractIdentifiers(rawText || "")
      .filter((entry) => entry.DOI)
      .map((entry) => entry.DOI);

    if (identifiers.length) {
      return identifiers;
    }

    const matches = [];
    const doiRE = /\b(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/ig;
    let match;
    while ((match = doiRE.exec(rawText || ""))) {
      matches.push(match[1]);
    }
    return matches;
  },

  parseDOIInput(rawText) {
    const lines = String(rawText || "").split(/\r?\n/);
    const orderedEntries = [];
    const orderedDOIs = [];
    const duplicateInputDOIs = [];
    const seen = new Map();
    const relevanceCounts = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0
    };
    let extractedCount = 0;
    let currentRelevance = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const lineDOIs = this.extractDOIsFromText(line);
      const lineRelevance = this.detectLineRelevance(line);

      if (!lineDOIs.length && lineRelevance) {
        currentRelevance = lineRelevance;
        continue;
      }

      if (!lineDOIs.length) {
        continue;
      }

      const appliedRelevance = lineRelevance || currentRelevance;
      for (const candidate of lineDOIs) {
        extractedCount += 1;
        const doi = this.normalizeDOI(candidate);
        if (!doi) {
          continue;
        }

        if (seen.has(doi)) {
          duplicateInputDOIs.push(doi);
          seen.get(doi).relevance = this.chooseStrongerRelevance(seen.get(doi).relevance, appliedRelevance);
          continue;
        }

        const entry = {
          doi,
          relevance: appliedRelevance || null
        };
        seen.set(doi, entry);
        orderedEntries.push(entry);
        orderedDOIs.push(doi);
      }
    }

    for (const entry of orderedEntries) {
      if (entry.relevance && Object.prototype.hasOwnProperty.call(relevanceCounts, entry.relevance)) {
        relevanceCounts[entry.relevance] += 1;
      }
    }

    return {
      extractedCount,
      orderedEntries,
      orderedDOIs,
      duplicateInputDOIs: [...new Set(duplicateInputDOIs)],
      relevanceCounts
    };
  },

  normalizeTitle(value) {
    const stripped = Zotero.Utilities.removeDiacritics((value || "").replace(/<[^>]+>/g, " "));
    return stripped
      .toLowerCase()
      .replace(/[^0-9a-z\u4e00-\u9fff]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  },

  normalizeCreatorName(value) {
    return this.normalizeTitle(value || "");
  },

  extractYear(value) {
    const match = String(value || "").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
    return match ? match[1] : null;
  },

  getItemCreatorKeys(item) {
    const creators = typeof item.getCreators === "function" ? item.getCreators() : [];
    return creators
      .map((creator) => this.normalizeCreatorName(creator.lastName || creator.name || creator.firstName || ""))
      .filter(Boolean);
  },

  extractPreviewCreatorKeys(preview) {
    const authors = Array.isArray(preview.author) ? preview.author : [];
    return authors
      .map((author) => this.normalizeCreatorName(author.family || author.literal || author.name || author.given || ""))
      .filter(Boolean);
  },

  getItemDOIs(item) {
    const values = new Set();
    const push = (candidate) => {
      const direct = this.normalizeDOI(candidate);
      if (direct) {
        values.add(direct);
      }
      const identifiers = Zotero.Utilities.extractIdentifiers(String(candidate || "")).filter((entry) => entry.DOI);
      for (const entry of identifiers) {
        const extracted = this.normalizeDOI(entry.DOI);
        if (extracted) {
          values.add(extracted);
        }
      }
    };

    push(item.getField("DOI"));
    if (typeof item.getExtraField === "function") {
      push(item.getExtraField("DOI"));
    }
    push(item.getField("extra"));
    push(item.getField("url"));

    return [...values];
  },

  createLibraryEntry(item) {
    return {
      item,
      itemID: item.id,
      title: item.getField("title") || "",
      titleKey: this.normalizeTitle(item.getField("title") || ""),
      year: this.extractYear(item.getField("date") || ""),
      creatorKeys: this.getItemCreatorKeys(item),
      dois: this.getItemDOIs(item)
    };
  },

  addEntryToIndex(index, entry) {
    index.entries.push(entry);

    for (const doi of entry.dois) {
      if (!index.doiIndex.has(doi)) {
        index.doiIndex.set(doi, []);
      }
      index.doiIndex.get(doi).push(entry);
    }

    if (entry.titleKey) {
      if (!index.titleIndex.has(entry.titleKey)) {
        index.titleIndex.set(entry.titleKey, []);
      }
      index.titleIndex.get(entry.titleKey).push(entry);
    }
  },

  async buildLibraryIndex(libraryID) {
    const items = (await Zotero.Items.getAll(libraryID, true, false)) || [];
    const index = {
      entries: [],
      doiIndex: new Map(),
      titleIndex: new Map()
    };

    for (const item of items) {
      if (!item || !item.isRegularItem() || !item.isTopLevelItem()) {
        continue;
      }
      this.addEntryToIndex(index, this.createLibraryEntry(item));
    }

    return index;
  },

  choosePreferredExistingEntry(entries, collectionID) {
    return entries
      .slice()
      .sort((a, b) => {
        const aInTarget = collectionID && a.item.getCollections().includes(collectionID) ? 1 : 0;
        const bInTarget = collectionID && b.item.getCollections().includes(collectionID) ? 1 : 0;
        if (aInTarget !== bInTarget) {
          return bInTarget - aInTarget;
        }
        if (a.item.dateAdded !== b.item.dateAdded) {
          return String(a.item.dateAdded).localeCompare(String(b.item.dateAdded));
        }
        return a.item.id - b.item.id;
      })[0];
  },

  async ensureItemInCollection(item, collectionID) {
    if (!collectionID) {
      return "no-target-collection";
    }
    if (item.getCollections().includes(collectionID)) {
      return "already-in-collection";
    }
    item.addToCollection(collectionID);
    await item.saveTx();
    return "linked-to-collection";
  },

  getRelevanceTag(level) {
    return level ? `${this.config.relevanceTagPrefix}${level}` : null;
  },

  async ensureRelevanceTag(item, relevance) {
    if (!relevance) {
      return "no-relevance";
    }

    const targetTag = this.getRelevanceTag(relevance);
    const tags = typeof item.getTags === "function" ? item.getTags() : [];
    const currentTags = tags.map((entry) => entry.tag);
    let changed = false;
    let removedAny = false;

    for (const tag of currentTags) {
      if (tag.startsWith(this.config.relevanceTagPrefix) && tag !== targetTag) {
        item.removeTag(tag);
        changed = true;
        removedAny = true;
      }
    }

    if (!currentTags.includes(targetTag)) {
      item.addTag(targetTag);
      changed = true;
    }

    if (changed) {
      await item.saveTx();
      return removedAny ? "retagged" : "tagged";
    }

    return "already-tagged";
  },

  async ensureReusedTitleMarker(item) {
    if (!this.config.markReusedTitles) {
      return "disabled";
    }

    const prefix = this.config.reusedTitlePrefix || "";
    if (!prefix) {
      return "no-marker";
    }

    const title = item.getField("title") || "";
    if (!title) {
      return "no-title";
    }

    if (title.startsWith(prefix)) {
      return "already-marked";
    }

    item.setField("title", `${prefix}${title}`);
    await item.saveTx();
    return "title-marked";
  },

  incrementRelevanceSummary(summary, relevance, action) {
    if (!relevance) {
      return;
    }
    if (!["tagged", "retagged", "already-tagged"].includes(action)) {
      return;
    }
    summary.relevanceTaggedCount += 1;
    summary.relevanceCounts[relevance] = (summary.relevanceCounts[relevance] || 0) + 1;
  },

  async applyExistingItemActions(item, collectionID, relevance, summary) {
    const collectionAction = await this.ensureItemInCollection(item, collectionID);
    const relevanceAction = await this.ensureRelevanceTag(item, relevance);
    const titleMarkerAction = await this.ensureReusedTitleMarker(item);
    this.incrementRelevanceSummary(summary, relevance, relevanceAction);
    if (titleMarkerAction === "title-marked") {
      summary.reusedTitleMarkedCount += 1;
    } else if (titleMarkerAction === "already-marked") {
      summary.reusedTitleAlreadyMarkedCount += 1;
    }
    return { collectionAction, relevanceAction, titleMarkerAction };
  },

  async applyImportedItemActions(item, relevance, summary) {
    const relevanceAction = await this.ensureRelevanceTag(item, relevance);
    this.incrementRelevanceSummary(summary, relevance, relevanceAction);
    return relevanceAction;
  },

  async importByDOI(doi, libraryID, collectionID) {
    const translate = new Zotero.Translate.Search();
    translate.setIdentifier({ DOI: doi });

    const translators = await translate.getTranslators();
    if (!translators || !translators.length) {
      throw new Error(`没有可用的 DOI translator：${doi}`);
    }

    translate.setTranslator(translators);
    return translate.translate({
      libraryID,
      collections: collectionID ? [collectionID] : false,
      saveAttachments: this.config.saveAttachments
    });
  },

  async fetchPreviewMetadataByDOI(doi) {
    try {
      const response = await Zotero.HTTP.request(
        "GET",
        `https://doi.org/${encodeURI(doi)}`,
        {
          headers: {
            Accept: "application/vnd.citationstyles.csl+json"
          }
        }
      );
      return JSON.parse(response.responseText);
    } catch (error) {
      this.log(`DOI preview lookup failed for ${doi}: ${error}`);
      return null;
    }
  },

  createPreviewEntry(doi, preview) {
    if (!preview) {
      return null;
    }

    const title = Array.isArray(preview.title) ? preview.title[0] : preview.title;
    let year = null;

    if (preview.issued && Array.isArray(preview.issued["date-parts"]) && preview.issued["date-parts"][0]) {
      year = preview.issued["date-parts"][0][0] ? String(preview.issued["date-parts"][0][0]) : null;
    }

    return {
      doi,
      title: title || "",
      titleKey: this.normalizeTitle(title || ""),
      year: year || null,
      creatorKeys: this.extractPreviewCreatorKeys(preview)
    };
  },

  countCreatorOverlap(left, right) {
    const rightSet = new Set(right);
    let count = 0;
    for (const value of left) {
      if (rightSet.has(value)) {
        count += 1;
      }
    }
    return count;
  },

  isMetadataMatch(existingEntry, previewEntry) {
    if (!previewEntry || !previewEntry.titleKey || existingEntry.titleKey !== previewEntry.titleKey) {
      return false;
    }

    if (previewEntry.year && existingEntry.year && previewEntry.year !== existingEntry.year) {
      return false;
    }

    const previewCreators = previewEntry.creatorKeys || [];
    const existingCreators = existingEntry.creatorKeys || [];

    if (previewCreators.length && existingCreators.length) {
      if (previewCreators[0] === existingCreators[0]) {
        return true;
      }
      return previewEntry.year && existingEntry.year
        ? this.countCreatorOverlap(previewCreators, existingCreators) > 0
        : false;
    }

    return !!(previewEntry.year && existingEntry.year);
  },

  shouldSkipImportForAmbiguousTitle(previewEntry, titleCandidates) {
    if (!previewEntry || !previewEntry.titleKey || !titleCandidates.length) {
      return false;
    }

    return !previewEntry.year || !previewEntry.creatorKeys.length;
  },

  addResultItem(summary, item) {
    if (!item || summary.resultItemIDs.has(item.id)) {
      return;
    }
    summary.resultItemIDs.add(item.id);
    summary.resultItems.push(item);
  },

  summarizeExistingMatch(summary, doi, existingEntry, actions, reason, relevance) {
    summary.existing.push({
      doi,
      itemID: existingEntry.item.id,
      title: existingEntry.item.getField("title") || existingEntry.title,
      collectionAction: actions.collectionAction,
      relevanceAction: actions.relevanceAction,
      titleMarkerAction: actions.titleMarkerAction,
      reason,
      relevance: relevance || null
    });
  },

  findExistingMatchesForEntry(index, entry, doi) {
    const matches = new Map();

    const doiCandidates = new Set([doi, ...(entry.dois || [])].filter(Boolean));
    for (const doiCandidate of doiCandidates) {
      const entries = index.doiIndex.get(doiCandidate) || [];
      for (const existingEntry of entries) {
        matches.set(existingEntry.itemID, existingEntry);
      }
    }

    if (entry.titleKey) {
      const titleCandidates = index.titleIndex.get(entry.titleKey) || [];
      for (const existingEntry of titleCandidates) {
        if (this.isMetadataMatch(existingEntry, entry)) {
          matches.set(existingEntry.itemID, existingEntry);
        }
      }
    }

    return [...matches.values()];
  },

  async rollbackImportedDuplicate({ index, item, doi, collectionID, relevance, summary }) {
    const importedEntry = this.createLibraryEntry(item);
    const matches = this.findExistingMatchesForEntry(index, importedEntry, doi);
    if (!matches.length) {
      return {
        kept: true,
        entry: importedEntry
      };
    }

    const existingEntry = this.choosePreferredExistingEntry(matches, collectionID);
    const actions = await this.applyExistingItemActions(existingEntry.item, collectionID, relevance, summary);
    await Zotero.Items.trashTx([item.id]);

    summary.reconciledDuplicateImports.push({
      doi,
      importedItemID: item.id,
      importedTitle: importedEntry.title,
      keptItemID: existingEntry.itemID,
      keptTitle: existingEntry.item.getField("title") || existingEntry.title,
      relevance: relevance || null
    });
    this.summarizeExistingMatch(summary, doi, existingEntry, actions, "post-import-rollback", relevance);
    this.addResultItem(summary, existingEntry.item);

    return {
      kept: false,
      entry: existingEntry
    };
  },

  async processDOIList({ libraryID, collectionID, parsed }) {
    const index = await this.buildLibraryIndex(libraryID);
    const collection = collectionID ? Zotero.Collections.get(collectionID) : null;
    const summary = {
      libraryID,
      collectionID,
      collectionName: collection ? collection.name : "",
      extractedCount: parsed.extractedCount,
      uniqueDOIs: parsed.orderedDOIs.length,
      duplicateInputDOIs: parsed.duplicateInputDOIs,
      relevanceTaggedCount: 0,
      reusedTitleMarkedCount: 0,
      reusedTitleAlreadyMarkedCount: 0,
      relevanceCounts: {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0
      },
      existing: [],
      imported: [],
      reconciledDuplicateImports: [],
      skipped: [],
      failed: [],
      resultItems: [],
      resultItemIDs: new Set()
    };

    for (const parsedEntry of parsed.orderedEntries) {
      const doi = parsedEntry.doi;
      const relevance = parsedEntry.relevance;
      const doiMatches = index.doiIndex.get(doi) || [];
      if (doiMatches.length) {
        const existingEntry = this.choosePreferredExistingEntry(doiMatches, collectionID);
        const actions = await this.applyExistingItemActions(existingEntry.item, collectionID, relevance, summary);
        this.summarizeExistingMatch(summary, doi, existingEntry, actions, "doi", relevance);
        this.addResultItem(summary, existingEntry.item);
        continue;
      }

      const previewEntry = this.createPreviewEntry(doi, await this.fetchPreviewMetadataByDOI(doi));
      if (previewEntry && previewEntry.titleKey) {
        const titleCandidates = index.titleIndex.get(previewEntry.titleKey) || [];
        const metadataMatches = titleCandidates.filter((entry) => this.isMetadataMatch(entry, previewEntry));

        if (metadataMatches.length) {
          const existingEntry = this.choosePreferredExistingEntry(metadataMatches, collectionID);
          const actions = await this.applyExistingItemActions(existingEntry.item, collectionID, relevance, summary);
          this.summarizeExistingMatch(summary, doi, existingEntry, actions, "title-metadata", relevance);
          this.addResultItem(summary, existingEntry.item);
          continue;
        }

        if (this.shouldSkipImportForAmbiguousTitle(previewEntry, titleCandidates)) {
          summary.skipped.push({
            doi,
            title: previewEntry.title,
            reason: "库内存在同标题条目，但缺少足够元数据安全排除重复，已跳过导入"
          });
          continue;
        }
      }

      try {
        const importedItems = await this.importByDOI(doi, libraryID, collectionID);
        const regularTopLevelItems = (importedItems || []).filter(
          (item) => item && item.isRegularItem() && item.isTopLevelItem()
        );

        if (!regularTopLevelItems.length) {
          throw new Error("translator 没有返回顶层文献条目");
        }

        for (const item of regularTopLevelItems) {
          const reconciliation = await this.rollbackImportedDuplicate({
            index,
            item,
            doi,
            collectionID,
            relevance,
            summary
          });
          if (!reconciliation.kept) {
            continue;
          }

          const entry = reconciliation.entry;
          await this.applyImportedItemActions(item, relevance, summary);
          this.addEntryToIndex(index, entry);
          summary.imported.push({
            doi,
            itemID: item.id,
            title: entry.title,
            relevance: relevance || null
          });
          this.addResultItem(summary, item);
        }
      } catch (error) {
        summary.failed.push({
          doi,
          error: error && error.message ? error.message : String(error)
        });
      }
    }

    return summary;
  },

  shouldShowSummary(summary) {
    const resultCount = summary.resultItems.length;
    if (summary.failed.length || summary.skipped.length) {
      return true;
    }
    if (summary.relevanceTaggedCount) {
      return true;
    }
    if (summary.existing.length) {
      return true;
    }
    if (summary.duplicateInputDOIs.length) {
      return true;
    }
    return this.config.showSummaryForSingleSuccessfulImport ? !!resultCount : resultCount > 1;
  },

  formatSummary(summary) {
    const lines = [
      `目标位置：${summary.collectionName || "当前文库（未选中文件夹）"}`,
      `提取到 DOI：${summary.extractedCount}`,
      `唯一 DOI：${summary.uniqueDOIs}`,
      `带相关性标签：${summary.relevanceTaggedCount}`,
      `复用已有条目：${summary.existing.length}`,
      `复用条目新增标题标记：${summary.reusedTitleMarkedCount}`,
      `新导入：${summary.imported.length}`,
      `导入后回收重复：${summary.reconciledDuplicateImports.length}`,
      `保守跳过：${summary.skipped.length}`,
      `导入失败：${summary.failed.length}`,
      `输入中重复 DOI：${summary.duplicateInputDOIs.length}`
    ];

    const linked = summary.existing.filter((entry) => entry.collectionAction === "linked-to-collection").length;
    const alreadyInCollection = summary.existing.filter((entry) => entry.collectionAction === "already-in-collection").length;
    const reusedWithoutCollection = summary.existing.filter((entry) => entry.collectionAction === "no-target-collection").length;
    const alreadyMarkedTitles = summary.reusedTitleAlreadyMarkedCount || 0;

    if (summary.existing.length) {
      lines.push("");
      lines.push(`已有条目中，新增加入目标文件夹：${linked}`);
      lines.push(`已有条目中，本来就在目标文件夹：${alreadyInCollection}`);
      lines.push(`已有条目中，仅复用不移动：${reusedWithoutCollection}`);
      lines.push(`已有条目中，标题原本已有标记：${alreadyMarkedTitles}`);
    }

    const relevanceLines = [
      ["critical", "CRITICAL"],
      ["high", "HIGH"],
      ["moderate", "MODERATE"],
      ["low", "LOW"]
    ]
      .filter(([level]) => summary.relevanceCounts[level] > 0)
      .map(([level, label]) => `${label}：${summary.relevanceCounts[level]}`);

    if (relevanceLines.length) {
      lines.push("");
      lines.push("相关性标签：");
      lines.push(...relevanceLines);
    }

    if (summary.skipped.length) {
      lines.push("");
      lines.push("已跳过：");
      for (const entry of summary.skipped.slice(0, 10)) {
        lines.push(`${entry.doi} :: ${entry.reason}`);
      }
      if (summary.skipped.length > 10) {
        lines.push(`……还有 ${summary.skipped.length - 10} 条`);
      }
    }

    if (summary.failed.length) {
      lines.push("");
      lines.push("导入失败：");
      for (const entry of summary.failed.slice(0, 10)) {
        lines.push(`${entry.doi} :: ${entry.error}`);
      }
      if (summary.failed.length > 10) {
        lines.push(`……还有 ${summary.failed.length - 10} 条`);
      }
    }

    return lines.join("\n");
  },

  getPrefJSON(prefKey, fallbackValue) {
    try {
      if (typeof Zotero.Prefs.prefHasUserValue === "function"
        && !Zotero.Prefs.prefHasUserValue(prefKey)) {
        return fallbackValue;
      }

      const raw = Zotero.Prefs.get(prefKey);
      if (!raw) {
        return fallbackValue;
      }

      return JSON.parse(raw);
    } catch (error) {
      this.log(`Unable to read JSON preference ${prefKey}: ${error}`);
      return fallbackValue;
    }
  },

  savePrefJSON(prefKey, value) {
    try {
      Zotero.Prefs.set(prefKey, JSON.stringify(value));
    } catch (error) {
      this.log(`Unable to save JSON preference ${prefKey}: ${error}`);
    }
  },

  showSummary(window, summary) {
    Zotero.alert(window, "DOI 去重导入完成", this.formatSummary(summary));
  }
};
