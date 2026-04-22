# Zotero DOI Dedup Import Plugin

这个插件直接接管 Zotero 自带的“魔术棒”入口：

- `通过标识符添加条目`
- 也就是工具栏里 `输入 ISBN、DOI、PMID、arXiv ID...` 的那个弹窗

工作方式：

- 你先在 Zotero 左侧选中目标文库或目标文件夹
- 点击工具栏魔术棒按钮
- 直接在原生弹窗里粘贴多条 DOI，或者粘贴含 DOI 的整段文本
- 插件会先扫描整个库里的顶层文献条目，建立 DOI 与标题索引
- 若某 DOI 已存在，则不会重复导入，而是复用已有条目
- 如果当前选中了文件夹，已有条目会被加入该文件夹
- 若 DOI 没命中，但通过 DOI 元数据预读发现库内已有同标题同元数据条目，也会复用旧条目
- 只有在确认库内不存在时，才真正执行 DOI 抓取导入
- 对同标题但元数据不足以安全排除重复的情况，插件会保守跳过，而不是冒险造重

## 构建 XPI

在插件目录运行：

```bash
bash build.sh
```

构建产物会出现在：

- `dist/zotero-doi-dedup-import-plugin-1.1.3.xpi`

## 安装

### 方式 1：安装 XPI

1. 在 Zotero 中打开 `工具 -> 插件`
2. 点击右上角齿轮
3. 选择 `Install Add-on From File...`
4. 选择构建好的 `.xpi`

### 方式 2：从源码开发加载

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

## 输入方式

这个插件默认把原生 lookup 弹窗展开成多行文本框，支持：

- 每行一个 DOI
- `https://doi.org/...`
- `doi:10.xxxx/...`
- 一整段正文里的 DOI 自动提取

例如：

```text
10.1038/nature13022
https://doi.org/10.1126/science.adn0769
paper: 10.1016/j.scitotenv.2022.156509
The classic paper is doi:10.1038/nature13022 and another is 10.1126/science.adn0769.
```

## 兼容性

- Zotero 7
- Zotero 8
- Zotero 9

## 当前行为说明

- 当前优先支持 DOI 去重；ISBN / PMID / arXiv ID 会继续走 Zotero 原生逻辑
- 当前不额外提供“自定义标签”输入框，复用已有条目时以“加入当前选中文件夹”为主
- 默认不抓附件，只导入元数据
