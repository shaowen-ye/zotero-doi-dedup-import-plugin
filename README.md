# Zotero DOI Dedup Import Plugin / Zotero DOI 去重导入插件

![DOI Dedup Import logo](icons/icon-128.png)

Zotero DOI Dedup Import 是一个扩展 Zotero “通过标识符添加条目”弹窗的插件。它面向经常批量导入 DOI、从 AI 或数据库复制 DOI 列表、并且希望避免重复文献条目的 Zotero 用户。

本仓库 fork 自 [huanongfish/zotero-doi-dedup-import-plugin](https://github.com/huanongfish/zotero-doi-dedup-import-plugin)，并在此基础上继续扩展多行 DOI 输入、全库 DOI / 标题去重、复用已有条目标识、相关性标签和保守跳过等功能。

这个插件的重点不是替代 Zotero 的文献抓取能力，而是在 Zotero 原生魔术棒入口前后增加一层去重、复用和整理逻辑。

## 主要功能

### 接管 Zotero 魔术棒导入入口

插件直接扩展 Zotero 工具栏中的“通过标识符添加条目”入口，也就是 `输入 ISBN、DOI、PMID、arXiv ID...` 的原生弹窗。安装后，你仍然使用熟悉的魔术棒按钮，但 DOI 输入框会被展开为更适合批量粘贴的多行文本框。

对于非 DOI 输入，例如 ISBN、PMID 或 arXiv ID，插件会保守地交回 Zotero 原生逻辑处理。当前增强功能主要面向 DOI。

### 多行 DOI 与正文 DOI 提取

插件支持每行一个 DOI，也支持从整段文本中自动提取 DOI。`https://doi.org/...`、`doi:10.xxxx/...`、普通正文里的 DOI，以及带分隔符的结构化 DOI 行都可以被识别。

如果同一个 DOI 在输入内容中重复出现，插件只保留一次，并在导入完成摘要里提示输入中重复 DOI 的数量。

### 全库 DOI 去重与复用已有条目

导入前，插件会扫描当前目标文库中的顶层普通文献条目，建立 DOI 索引和标题索引。若输入 DOI 已经存在，插件不会重复抓取或新建条目，而是复用已有条目。

如果你在 Zotero 左侧选中了目标文件夹，复用的已有条目会被加入该文件夹；如果该条目本来就在目标文件夹中，则不会重复操作。

### 标题与元数据辅助去重

有些旧条目可能缺少标准 DOI 字段，但标题、年份和作者信息与待导入 DOI 对应的元数据一致。对于这类情况，插件会先通过 DOI 预读元数据，再用标题、年份和作者作为辅助证据判断是否复用已有条目。

如果库内存在同标题条目，但元数据不足以安全判断是否重复，插件会保守跳过导入，避免贸然制造重复条目。

### 复用条目标识

对被复用的已有条目，插件会在标题前添加 `♻️ ` 标记；新导入条目不会添加该标记。这样你可以在 Zotero 条目列表中快速看出哪些条目是本次导入流程中复用的旧条目。

如果条目标题已经带有该标记，插件不会重复添加。

### 相关性标签

插件可以读取 `CRITICAL`、`HIGH`、`MODERATE`、`LOW` 等相关性分组，并自动写入 Zotero 标签：

- `relevance:critical`
- `relevance:high`
- `relevance:moderate`
- `relevance:low`

这适合与 AI 文献检索、Scopus / Web of Science 检索结果整理、或人工筛选后的 DOI 列表配合使用。已有不同 `relevance:*` 标签时，插件会替换为本次输入中更明确的相关性标签。

### 导入后重复回收

少数 DOI translator 可能在抓取后才暴露完整元数据。插件会在新条目导入后再次检查是否与库内已有条目重复；如果确认重复，会复用已有条目，并把刚导入的重复条目移入 Zotero 回收站。

这个操作不会永久删除条目。

## 快速使用

1. 在 Zotero 左侧选择目标文库或目标文件夹
2. 点击工具栏魔术棒按钮：`通过标识符添加条目`
3. 粘贴 DOI 列表、含 DOI 的正文，或按相关性分组的 DOI 块
4. 按 Enter 开始导入；需要换行时使用 `Shift + Enter`
5. 查看导入完成摘要，确认复用、新导入、跳过和失败情况

## 输入格式

### 普通 DOI 列表

```text
10.1038/nature13022
https://doi.org/10.1126/science.adn0769
paper: 10.1016/j.scitotenv.2022.156509
The classic paper is doi:10.1038/nature13022 and another is 10.1126/science.adn0769.
```

### 相关性分组

```text
CRITICAL
10.1007/s11160-025-09985-0
10.7541/2025.2024.0288

HIGH
10.1038/s41586-024-08375-z
10.1126/science.abf0861

MODERATE
10.1111/brv.13137
```

### 行内相关性

```text
10.1038/s41586-024-08375-z, HIGH
10.1111/brv.13137<TAB>MODERATE
```

也支持中文相关性词，例如 `核心`、`关键`、`高相关`、`中相关`、`低相关`。

## 去重与导入规则

### DOI 命中

如果库内已有同 DOI 条目，插件直接复用已有条目，并根据当前目标文件夹执行加入 collection、添加相关性标签和标题标记等操作。

### 标题元数据命中

如果 DOI 字段没有命中，但 DOI 预读元数据与库内已有条目的标题、年份和作者信息吻合，插件会复用已有条目。

### 保守跳过

如果只发现同标题条目，但缺少足够年份或作者信息来安全判断是否重复，插件会跳过导入，并在摘要中列出原因。

### 新导入

只有在确认库内没有可复用条目时，插件才调用 Zotero translator 抓取并导入新条目。默认只导入元数据，不抓取附件。

### 导入后回收重复

新导入完成后，插件会再次检查是否与已有条目重复。如果确认重复，刚导入的条目会被移入 Zotero 回收站，已有条目会被保留并复用。

## 行为边界

- 当前优先支持 DOI 去重导入
- ISBN、PMID、arXiv ID 等非 DOI 输入会继续走 Zotero 原生逻辑
- 默认不抓附件，只导入元数据
- 复用已有条目时可能会修改标题，添加 `♻️ ` 前缀
- 复用或新导入条目时可能会添加或更新 `relevance:*` 标签
- 复用已有条目时可能会把它加入当前选中的目标文件夹
- 导入后确认重复的新条目只会移入 Zotero 回收站，不会永久删除
- 对元数据不足的疑似重复条目，插件倾向于跳过，而不是冒险新建重复条目

## 设置说明

当前版本没有图形化设置页，核心行为在源码 `doi-dedup-import-plugin.js` 的 `config` 中定义：

- `saveAttachments: false`：默认不抓取附件
- `showSummaryForSingleSuccessfulImport: false`：单条成功导入时默认不弹摘要
- `relevanceTagPrefix: "relevance:"`：相关性标签前缀
- `markReusedTitles: true`：复用已有条目时添加标题标记
- `reusedTitlePrefix: "♻️ "`：复用条目的标题前缀

## Logo

插件内置一个“DOI 文献卡片 + 去重复用循环箭头 + 魔术棒星光”的图标，用来表达通过 DOI 导入文献、识别已有条目并复用、避免重复导入的功能。

## 安装

1. 在 Zotero 中打开 `工具 -> 插件`
2. 点击右上角齿轮
3. 选择 `Install Add-on From File...`
4. 选择构建好的 `.xpi`
5. 重启 Zotero

安装文件：

- `dist/zotero-doi-dedup-import-plugin-1.2.5.xpi`

## 构建 XPI

在插件目录运行：

```bash
bash build.sh
```

构建产物会出现在：

- `dist/zotero-doi-dedup-import-plugin-1.2.5.xpi`

## 从源码开发加载

根据 Zotero 官方开发文档：

1. 关闭 Zotero
2. 在 Zotero profile 的 `extensions/` 目录中创建一个文本文件，文件名使用插件 id：
   - `doi-dedup-import@plugin.local`
3. 这个文本文件的内容写成插件源码目录绝对路径：
   - `/path/to/zotero-doi-dedup-import-plugin`
4. 按官方文档删除 profile 中 `prefs.js` 里的：
   - `extensions.lastAppBuildId`
   - `extensions.lastAppVersion`
5. 重新启动 Zotero

官方参考：

- [Zotero Plugin Development](https://www.zotero.org/support/dev/client_coding/plugin_development)
- [Official Zotero lookup.js](https://github.com/zotero/zotero/blob/master/chrome/content/zotero/lookup.js)

## 兼容性

- Zotero 7、8、9

当前 manifest 明确标记为兼容 Zotero `7.0` 到 `9.*`。
