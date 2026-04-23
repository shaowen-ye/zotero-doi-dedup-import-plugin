# AI-Driven Literature Discovery & Zotero Import Workflow

This document details the fully integrated "AI ↔ Zotero" workflow for literature discovery, evaluation, and deduplicated ingestion. It connects LLM capabilities (via the authoritative Scopus database) directly to personal Zotero libraries with a zero-friction, one-click copy-paste process.

---

## 1. Core Architecture & Components

The ecosystem relies on the collaboration of two distinct tools—one on the AI Agent side and one on the Zotero GUI side:

### A. The AI Agent Skill (`scopus-literature`)
- **Location:** AI CLI / Agent environments (e.g., Cursor, Claude, Antigravity)
- **Function:** Queries the Elsevier Scopus API to retrieve accurate, non-hallucinated DOIs and full abstracts.
- **Workflow:** The AI reads the retrieved abstracts, evaluates their relevance to the user's current research manuscript, and organizes them into strict qualitative categories (`CRITICAL`, `HIGH`, `MODERATE`).
- **Standardized Output:** The agent is rigidly prompted to output a single, nicely formatted plain-text block of DOIs at the end of its analysis.

### B. The Zotero Plugin (`zotero-doi-dedup-import-plugin`)
- **Location:** Zotero 7/8/9 Client (overrides the native "Magic Wand" lookup tool)
- **Function:** Parses multiline text, automatically deduplicates against the user's existing local library (by matching DOIs and titles), and executes bulk scraping via Zotero's translation layer.
- **Relevance Tagging:** Automatically parses the AI's `CRITICAL`/`HIGH`/`MODERATE` headers and maps them directly to Zotero item tags (e.g., `relevance:critical`).

---

## 2. The Step-by-Step Workflow

### Step 1: User Prompt
The user issues a natural language query specifying their research need.
> **User:** "我要检索几篇关于湖泊禁渔导致营养级解耦的最新文献，用来支撑我的手稿机制。"

### Step 2: AI Retrieval & Systematic Analysis
1. The AI calls the `scopus-literature` skill to hit the Scopus API.
2. It fetches metadata and full abstracts using targeted boolean queries (e.g., `TITLE-ABS-KEY("fishing ban" AND "reservoir")`).
3. The AI reads the abstracts and compares them against the user's actual manuscript context.
4. The AI synthesizes a literature review report explaining *why* each paper is useful.

### Step 3: AI Output Formatting
At the end of its report, the AI generates the "Zotero Import Block":
```text
CRITICAL
10.1016/j.ecolind.2022.109434
10.1111/1365-2664.14491

HIGH
10.1016/j.ecolind.2023.111343

MODERATE
10.1016/j.ecolind.2023.111019
```

### Step 4: The Handoff
1. The user clicks **Copy** on the AI's generated text block.
2. In Zotero, the user selects their target project folder.
3. The user clicks the **Magic Wand** 🪄 (Add Item(s) by Identifier) and pastes the entire text block, then hits Enter.

### Step 5: Plugin Execution (Zero-Duplicate Ingestion)
The `zotero-doi-dedup-import-plugin` takes over:
- It cross-references every DOI against the `doiIndex` of the local Zotero library.
- **If missing:** It scrapes the metadata (and PDF if configured) via Zotero Translator.
- **If existing:** It skips the redundant download, merely linking the existing item to the current active folder.
- **Tagging:** It assigns `relevance:critical`, `relevance:high`, or `relevance:moderate` tags to both new and existing entries based on the AI's evaluation.

---

## 3. Key Advantages

- **Zero Hallucination:** The AI only outputs genuine DOIs that were literally returned by the Scopus API. It cannot invent fake citations.
- **Zero Friction:** Eliminates the tedious process of downloading `.ris` files, importing them, generating tags, and manually sorting out duplicates.
- **AI-Guided Priority:** Research is natively organized. Instead of a monolithic folder of 30 papers, your Zotero library immediately reflects the cognitive triage (Critical vs. Moderate) performed by the LLM. 
- **Graceful Degradation:** If the plugin fails or is uninstalled, Zotero's native Magic Wand still interprets the raw DOIs (ignoring the text headers) without crashing.
