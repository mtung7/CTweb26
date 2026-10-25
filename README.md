# Carey Tong — 个人作品网站

面向海外大学招生评审的个人展示网站。纯静态站点，无构建步骤、无依赖、双击 `index.html` 即可打开。

---

## 快速开始

**方式一：直接打开**
双击 `index.html`。所有功能可用（浏览器出于安全限制，不允许 `file://` 下 `fetch` 本地 JSON，此时会自动使用内置的备用内容；用本地服务器体验更完整）。

**方式二：本地服务器（推荐）**
```bash
cd site
python3 -m http.server 8899
# 浏览器打开 http://127.0.0.1:8899
```

**方式三：发布上线**
整个 `site/` 目录是纯静态文件，拖到 Netlify / Vercel / GitHub Pages / 任何静态托管即可，无需任何配置。

---

## 网站结构（两层）

### 第一层 — Homepage（`#home` / `#contents`）
只包含两样东西：**个人总体介绍**和**目录**。

- 顶栏只显示姓名、身份和 "CONTENTS ↓" 引导，不放任何版块链接——目录是唯一入口
- 首屏：姓名、标语、身份、总体介绍、三项关键数据、头像
- **目录紧贴首屏**：紧接在个人介绍下方，六张卡片排成两行三列，点击区域收紧，每张带缩略图 + 编号 + 名称 + 一句话说明 + 关键词标签
- 点击任意卡片 → 进入第二层对应版块

### 第二层 — 六大版块
顶部常驻**版块切换栏**：左侧「← Contents」返回目录，右侧六个版块互相切换（当前版块高亮），无需退回首页。

| 版块 | 锚点 | 内容 |
|---|---|---|
| 01 F1 in School | `#f1` | **Documents 面板**（5 份作品集全文在线预览 + 下载）、三个子版块：**Gallery**（18 张照片 + 灯箱）、**Portfolios**（5 份 PDF 卡片）、**Timeline**（时间轴） |
| 02 Sports | `#sports` | 游泳 / 赛艇（均为专业训练）+ 运动哲学 |
| 03 Public Speaking | `#speaking` | **演讲视频**（Rotary Melbourne Youth Public Speaking Competition Finals，竖屏播放器）+ 演讲卡片 + 经验总结 |
| 04 Graphic Design | `#design` | 6 个设计项目 + 车辆渲染图 |
| 05 Hobbies | `#hobbies` | 滑雪 / 冲浪 / 乐高 |
| 06 NGO | `#ngo` | 援助项目，每个项目三栏：项目 logo / 我的自我介绍 / 项目照片 |

### 每张照片都有说明栏
所有照片统一使用「图 + 下方说明栏」结构，说明栏永远可见、永远可编辑：

- **图库**（`f1.gallery.items`）——`src` / `caption` 说明 / `meta` 标签
- **运动 / 爱好卡片**（`sports.cards[].images[]`、`hobbies.cards[].images[]`）——`src` / `caption` / `meta`
- **演讲卡片**（`speaking.cards[].images[]`）——同上
- **NGO 项目**——`ngo.projects[].logo` 项目 logo、`ngo.projects[].images[]` 项目照片
- **目录缩略图**（`contents.items[].thumb`）
- **设计配图**（`design.items[].media`）
- **作品集封面**（`f1.portfolios.items[].cover`）

图片之间留有宽松间距（网格间距 40–76px），不会排得过满。

URL 直接访问 `#f1` / `#sports` / `#speaking` / `#design` / `#hobbies` / `#ngo` 可直达对应版块；`#f1-portfolios` 等子锚点可直达 F1 的某个子版块。

### 5 份 PDF：全文在线预览 + 下载
F1 版块的 **Documents 面板**逐行列出 5 份作品集。每份文档的**全部页面都以图片形式直接铺在标题下面**——访客无需点击任何按钮就能从头读到尾（图片懒加载，滚到哪页加载哪页）：

- 每行含编号、标题、页数、文件大小、作者、是否本人主笔（My section 标记）
- 页面右下角有页码角标（如 `05 / 12`）
- 面板头部有 5 个跳转按钮（01 Engineering → 05 Car Renders），且在滚动阅读时**吸顶常驻**，随时可以跳到另一份文档
- 每行右侧仍保留 **Preview**（站内全屏 PDF 查看器）和 **Download**（直接下载，文件名已语义化，如 `Carey-Tong-2024-Enterprise-Portfolio.pdf`）

预览图片由 `tools/pdf-pages.js` 从 PDF 逐页渲染生成（PDFKit 栅格化 + sips 压缩到 1400px 宽 JPEG），存放在 `assets/img/pdf/<文档名>/01.jpg …`，每份文档的页面清单记录在 `content.json` 的 `f1.portfolios.items[].pageImages` 数组里。**替换 PDF 后需要重跑一次该工具**，页面预览才会更新。

下方 Portfolios 子版块的卡片中提供 Preview / Download 按钮，编辑模式下还有 Replace file。

---

## 如何修改内容

### 方式 A：直接编辑 `assets/data/content.json`（推荐给熟悉文本编辑器的人）

这是**唯一的内容源文件**。所有标题、正文、图片路径、时间轴、卡片都在里面。改完保存，刷新浏览器即可。

```jsonc
{
  "profile": { "name": "Carey Tong", "email": "..." },
  "hero":    { "lede": "首页总体介绍段落…" },
  "contents": {                       // ← 第一层的目录
    "kicker": "Contents",
    "title": "Six sections",
    "lede": "目录引导语…",
    "items": [
      { "id": "f1", "index": "01", "label": "F1 in School", "title": "…", "blurb": "…",
        "meta": ["12 photographs"], "thumb": "图片路径" }
    ]
  },
  "f1": {
    "gallery":    { "items": [ { "src": "图片路径", "caption": "说明", "meta": "标签" } ] },
    "portfolios": { "items": [ { "title": "...", "file": "PDF路径", "download": "下载文件名",
                                "cover": "封面图路径", "pages": 11, "size": "4.4 MB" } ] },
    "timeline":   { "items": [ { "year": "2024", "title": "...", "text": "..." } ] }
  }
}
```

> `contents.items` 的 `id` 必须与第二层版块的锚点一致（`f1` / `sports` / `speaking` / `design` / `hobbies` / `ngo`），否则点击目录不会跳转。新增版块时同时在 `index.html` 里加一个 `data-section="xxx"` 的 `<section>`，并在 `app.js` 的 `SECTION_IDS` 里登记该 id。

### 方式 B：浏览器内编辑（推荐给不熟悉代码的人）

> **编辑模式是唯一的修改入口。** 未进入编辑模式时（即访客看到的正式页面），所有图片、PDF、视频位都不可点击上传，空照片位只显示中性的 "Photo coming soon" 占位，"Replace file" 按钮直接隐藏——页面是只读的。

1. 点击右上角 **Edit** 按钮（或按键盘 `E`）进入编辑模式
2. 页面上**所有正文文字变成可点击编辑**，改完即时生效（共 216 处可编辑字段）
3. **点击任意图片** → 选择本地文件即可替换
4. **点击 "Replace file"** → 上传新的 PDF 替换对应作品集文档
5. **点击视频位 ▶** → 上传 MP4
6. 点 **"+ Add ..."** 按钮可新增项目（照片 / 作品集 / 时间轴 / 设计项目 / 演讲 / 运动 / 爱好 / NGO 项目）
7. 鼠标悬停在任意卡片上会出现 **✕ Remove** 按钮，可删除该条目；单张照片右上角的 **✕** 只删这张照片
8. 点 **Save** 保存到浏览器（刷新不丢）

#### 让修改永久生效（重要）

浏览器里的修改保存在本机，**不会自动写回文件**。要永久保存并随网站上线，用这个流程：

| 按钮 | 作用 |
|---|---|
| **Export JSON** | 只下载内容 JSON（不上传了媒体时用这个） |
| **Export + media** | **同时下载内容 JSON 和所有上传的图片 / PDF / 视频** |
| **Import** | 导入之前导出的 JSON |

**「Export + media」之后要做三步：**

1. 把下载的素材文件（图片 / PDF / 视频）放进 `assets/uploads/` 目录
2. 把下载的 `carey-portfolio-content.json` 内容覆盖到 `assets/data/content.json`
3. 刷新页面——修改已永久保存，且现在可以随网站一起上线

导出的 JSON 里，图片 / PDF / 视频的路径会自动被改写成 `assets/uploads/xxx.jpg` 这样的真实相对路径，不再是浏览器内部的 `db:` 引用。JSON 的 `_meta.uploadedMedia` 字段里有一份对照清单。

> 编辑器按 `E` 键开关。改坏了点 **Reset** 即可恢复到 `content.json` 原始状态。

### 方式 C：替换素材文件（最直接）

把新文件按同名规则覆盖到对应目录即可，代码里引用的路径不变：

```
assets/img/f1/       ← F1 相关照片
assets/img/design/   ← 设计项目配图
assets/img/speaking/ ← 演讲照片
assets/img/sports/   ← 运动照片（游泳 / 赛艇）
assets/img/profile/  ← 个人头像
assets/img/ngo/      ← NGO 项目 logo 与照片（可选，也可在浏览器里上传）
assets/img/pdf/      ← 5 份作品集的逐页预览图（由 tools/pdf-pages.js 生成，勿手改）
assets/pdf/          ← 5 份作品集 PDF
assets/video/        ← 演讲视频（MP4）
```

---

## 素材清单

### `assets/pdf/`（5 份作品集）
| 文件名 | 内容 | 页数 |
|---|---|---|
| `engineering-portfolio.pdf` | 设计与工程作品集 | 11 |
| `engineering-drawings.pdf` | 工程图纸 | 21 |
| `project-management-portfolio.pdf` | 项目管理作品集 | 8 |
| `enterprise-portfolio.pdf` | 企业与商业作品集（本人主笔） | 12 |
| `car-renders.pdf` | 车辆渲染图 | 12 |

### `assets/img/`
- `profile/portrait.jpg` — 首屏头像（窗边坐姿）
- `profile/headshot.jpg` — 证件照备用
- `f1/01–20-*.jpg` — F1 活动照片 18 张（全国决赛领奖台、赛车与奔驰安全车、LUNAR 车队合影、Red Bull 车库、卡塔尔站、Van Amersfoort 交流、模型工作台、议会大厦广告牌等）
- `f1/cover-*.jpg` — 5 份 PDF 的封面页
- `design/01–08-*.jpg` — 品牌识别系统、Pit Display、创意 ROI、数字媒体、营销物料、角色 RACI、车辆渲染
- `speaking/*.jpg` — Rotary 演讲获奖、决赛合影、议会大厦演讲（两张）
- `sports/*.jpg` — 游泳 3 张、赛艇 3 张、冲浪 2 张、板球 1 张（冲浪照片同时用于 Hobbies 版块）

---

## 待补充内容

网站已预留位置，补充后立即生效：

| 位置 | 现状 | 补充方式 |
|---|---|---|
| ~~**演讲视频**~~ | ✅ 已放入（Rotary Melbourne Youth Public Speaking Competition Finals，竖屏 272×480 / 5分34秒 / 30MB） | 换片：把 MP4 放进 `assets/video/`，改 `speaking.video.src`；竖屏片文件名带 `-portrait` |
| **滑雪 / 乐高照片** | 空位，标注 "Add a photo" | 编辑模式下点击虚线框上传 |
| **NGO 三个项目** | logo、自我介绍、照片均为占位文字 | 编辑模式下点击 logo 框上传 logo、点文字改介绍、点照片框上传项目照片 |
| **简历 PDF** | "Download résumé" 按钮指向 `assets/data/resume.pdf`（尚未提供） | 放入该文件即可，或在 `content.json` 改 `hero.ctaSecondary.target` |
| **邮箱 / LinkedIn** | 占位 `carey.tong@example.com` | 修改 `content.json` 的 `profile` 与 `footer.contact` |

---

## 目录结构

```
site/
├── index.html                    页面骨架
├── README.md
└── assets/
    ├── css/style.v7.css             设计系统（配色 / 排版 / 响应式）
    ├── data/content.json         ★ 内容源文件（改这里）
    ├── data/content.v7.js        自动生成的 script 兜底（双击打开时用）
    ├── data/resume.pdf           （待补充）
    ├── fonts/                    自托管字体，离线可用
    ├── img/                      图片
    ├── pdf/                      5 份作品集 PDF
    ├── uploads/                  「Export + media」导出的上传文件放这里
    ├── video/                    演讲视频（MP4）
    └── js/
        ├── store.v7.js           内容加载 / localStorage / IndexedDB
        ├── app.v7.js             渲染逻辑
        └── editor.v7.js          浏览器内编辑器
```

> **文件名带 `.v7`**：这是刻意的缓存策略。内容结构改动后，只要把版本号往前推一位（`v7` → `v8`）并同步改 `index.html` 的引用，
> 浏览器就绝无可能加载到旧文件——从根上杜绝「改了却看到旧内容」。

---

## 三道缓存防线

浏览器会把你在编辑器里的改动存进 `localStorage`，这份存档可能比网站文件旧，导致已删除的内容反复复活。
`store.v7.js` 用三层机制自动作废过期存档：

| 机制 | 键名 | 作用 |
|---|---|---|
| **内容指纹** | `carey-portfolio:content:fingerprint` | 每次保存记录「基于哪一版内容结构」。结构一变（删卡片 / 加版块），旧存档立即作废 |
| **版本号** | `carey-portfolio:content:version` | 内容 schema 版本变化时作废 |
| **文件名版本号** | `.v7` | 静态资源 URL 变化，浏览器不可能命中旧缓存 |

手动清空：在浏览器控制台执行 `localStorage.clear(); location.reload();`，或进编辑模式点 **Reset**。

---

## 设计说明

- **配色**：暖白纸感底色 `#FBFAF7` + 墨黑 `#101418` + 深海蓝 `#14395F` + 信号橙 `#C8452D`
- **字体**：Newsreader（衬线，标题/引用）+ Inter（无衬线，正文）+ JetBrains Mono（标签/编号），**全部自托管**，无外部请求，离线可用
- **风格**：留白充足、细分隔线、编号章节（01–04）、无花哨动效——学术出版物的克制感，匹配欧美大学评审习惯
- **响应式**：桌面 / 平板 / 手机三档，已适配打印（Ctrl+P 可直接导出 PDF 版式）
- **无障碍**：语义化标签、键盘导航（`E` 切换编辑、`Esc` 关闭灯箱、`←/→` 切换图片）、`prefers-reduced-motion` 支持

---

## 常见问题

**改了 content.json 但页面没变？**
硬刷新：`Cmd + Shift + R`（Mac）或 `Ctrl + F5`（Windows）。如果之前用过浏览器内编辑，浏览器里的版本会覆盖文件版本——先点 **Reset**，再刷新。

**视频/MP4 太大？**
建议压缩到 720p / H.264 / 5–10MB 以内。也可以改用 YouTube 链接，在 `content.json` 里填 `speaking.video.externalUrl`。

**上传的文件存在哪里？**
存在浏览器的 IndexedDB 里（仅本机可见，刷新不丢）。想永久保存，点 **Export JSON** 并把文件放进 `assets/` 目录；导出文件里上传项的路径会写成 `db:...`，需要手动替换为实际路径。

**想部署到线上？**
`site/` 目录直接上传即可。所有路径都是相对路径，放到子目录也能正常工作。
