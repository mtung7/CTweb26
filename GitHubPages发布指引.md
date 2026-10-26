# GitHub Pages 发布指引（CTweb26）

> 一条命令完成：推送代码 → 开启 Pages → 等待构建 → 验证网址

**线上网址：https://mtung7.github.io/CTweb26/ 　✅ 已发布并验证通过**

---

## 一、GitHub Pages 适配检查结果（已完成）

| 检查项 | 结果 |
|---|---|
| 仓库体积 | 181MB < 1GB（Pages 上限）✓ |
| 单文件最大 | 31MB（视频）< 100MB（GitHub 硬限制）✓ |
| `index.html` 在根目录 | ✓ |
| `.nojekyll` | ✓ **本轮新增**（防止 Jekyll 干扰静态发布） |
| 资源目录完整性 | ✓ 116 张图片 **0 裂图** |
| 资源 404 | ✓ **0 个** |
| JS 错误 | ✓ **0 个** |
| 版块渲染 | ✓ home, contents, f1, design, speaking, sports, hobbies, ngo, contact |
| 六版块目录 | ✓ 三列两行，无 Football 残留 |
| 视频编码 | ✓ H.264 (mp42) + **faststart**（moov 在前，网页播放顺畅） |
| 关键资源可达性 | ✓ 视频/PDF/SVG/JSON/字体 全部 200 |
| 深链接直达 | ✓ `#f1` / `#sports` / `#ngo` **3ms 内**切到内容层 |

**结论：完全适合 GitHub Pages。**

GitHub Pages 与 Cloudflare 的关键差异：

| | Cloudflare Pages | GitHub Pages |
|---|---|---|
| 构建步骤 | 跑 `npm run build` | **不需要**，直接发布分支内容 |
| Jekyll 处理 | 无 | 默认开启 → 需 `.nojekyll` 关闭 |
| 输出目录 | 需指定 `/` | 源码分支 + 路径 `/` |
| 构建命令 | `npm run build` | 无 |

---

## 二、GitHub Pages 特有的两个坑（本项目已修复，勿回退）

### 坑 1：Range 请求会污染浏览器 HTTP 缓存

GitHub Pages 支持 `Range`，但对 `Range: bytes=0-0` 只返回 **1 字节**（HTTP 206）。
浏览器会把这份残缺响应缓存成"完整资源"，随后的 `<img>` 请求直接拿到 1 字节 → **SVG/JPEG 解码失败、显示裂图**。

- 症状：NGO 三个 logo 与 64 张 PDF 页图 `naturalWidth = 0`，但直接 `new Image()` 加载同一个 URL 却正常。
- 本项目的做法：探测文件是否存在时用 **HEAD**，**不要用 Range**（`assets/js/app.v8.js` 的 `mediaExists()`）。
- 修复前：NGO logo 裂图 + PDF 页图全部加载失败。修复后：64/64 全部正常。

### 坑 2：路由必须先于异步渲染生效

`renderAll()` 是串行异步链（要解析 64 张 PDF 页图、探测上百个图片），耗时 5–22 秒。
若把 `applyRoute()` 放在链条末尾，深链接打开时用户会先看到**首页**好几秒，甚至误以为页面坏了。

- 本项目的做法：`DOMContentLoaded` 里**先调 `applyRoute()`** 切图层，再 `renderAll()`；渲染完成后再调一次校正滚动位置。
- 修复前：`#f1` 需 5–22 秒才显示内容层。修复后：**3–818ms**。

---

## 三、准备 Token（1 分钟）

1. 打开 <https://github.com/settings/personal-access-tokens/new>
2. **Token name**：`GitHub Pages publish`
3. **Expiration**：`90 days`
4. **Repository access**：`Only select repositories` → 勾选 **CTweb26**
5. **Repository permissions** 勾选：
   - `Pages` → **Read and write**
   - `Administration` → **Read and write**
   - `Contents` → **Read and write**（用于推送代码）
6. **Generate token**，复制那串 `ghp_...` 开头的字符

> 也可以用 classic token（勾一个 `repo` 权限即可），脚本两种都支持。

---

## 四、执行发布

```bash
bash /Users/michaeltong/WorkBuddy/2026-10-24-11-47-11/publish-github-pages.sh
```

脚本会提示粘贴 Token（**输入时不显示**，这是正常的），随后自动完成：

```
【1/5】验证 Token 身份
【2/5】检查仓库 CTweb26
【3/5】推送代码（首次 2-5 分钟，85MB）
【4/5】开启 Pages（branch=main, path=/, build_type=legacy）
【5/5】轮询构建状态直到 built
      → 打开最终网址，验证 HTTP 200 与页面内容
```

也可以直接带参数运行（注意安全，不推荐在共享机器上这么做）：

```bash
bash publish-github-pages.sh ghp_你的token
```

---

## 五、最终网址

```
https://mtung7.github.io/CTweb26
```

构建通常 1–2 分钟。脚本会等到状态变为 `built` 再验证。

如果脚本报 `422`，说明 Pages 功能未在该仓库启用，请手动开启：

**https://github.com/mtung7/CTweb26 → Settings → Pages**
- Source：`Deploy from a branch`
- Branch：`main`，Path：`/`
- Save

然后重跑脚本即可继续。

---

## 六、安全说明

- Token 通过一次性 `GIT_ASKPASS` 脚本传入，**不写入 git config，不留在磁盘**
- 脚本结束后临时文件立即删除
- Token 用完可在 <https://github.com/settings/tokens> 一键吊销
- 建议设置 90 天过期，到期自动失效

---

## 七、以后如何更新

```bash
cd /Users/michaeltong/WorkBuddy/2026-10-24-11-47-11/deploy
git add -A && git commit -m "描述改动" && git push origin main
```

推上去后 GitHub Pages 会自动重新构建，1–2 分钟后线上更新。

> ⚠️ 改代码时务必同时改 `site/` 和 `deploy/` 两份（`deploy/` 才是真正发布的目录）。
> 常用做法：`cp site/assets/js/app.v8.js deploy/assets/js/app.v8.js`

---

## 八、上线后回归测试

```bash
cd /Users/michaeltong/WorkBuddy/2026-10-24-11-47-11
NODE_PATH=/Users/michaeltong/.workbuddy/binaries/node/workspace/node_modules \
  /Users/michaeltong/.workbuddy/binaries/node/versions/22.12.0/bin/node \
  tools/test-live-github-pages.js
```

该脚本直接打真实公网网址，覆盖 10 组、55 项断言：首页、深链接、目录二行三列、
Sports 只剩 Swimming/Rowing、5 份 PDF 直接展开、竖屏视频、Hobbies/NGO、
Browse 只读、零裂图、Edit 模式。

---

## 九、故障排查

| 症状 | 原因 | 解决 |
|---|---|---|
| `Token 无效（HTTP 401）` | Token 过期/复制错误 | 重新生成，注意不要带空格 |
| `仓库不存在或无权访问（404）` | Token 所属账号不对，或没勾该仓库 | 确认 Token 属于 mtung7 且已勾选 CTweb26 |
| `HTTP 422` | 缺 Pages/Administration 权限 | 检查 Token 权限项 |
| 推送被拒绝 | 远端已有历史 | 脚本已带 `--force`，若手动推送请加 |
| 页面 404 | Pages 还没构建完 | 等 1–2 分钟，查看 Actions 标签页 |
| 视频不播 | 罕见 | 浏览器直开视频 URL 验证；GitHub Pages 支持 mp4 |
| 页面显示旧内容 | 浏览器缓存 | 强制刷新（Cmd+Shift+R）|
| **图片裂图（naturalWidth=0）** | **用了 Range 探测文件** | **改用 HEAD，见坑 1** |
| **深链接打开先看到首页** | **applyRoute 排在渲染链末尾** | **提前调用，见坑 2** |
