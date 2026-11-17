# V2EX

OTools 的 V2EX 浏览插件（独立仓库，与宿主 `OTools` 仓平级）：左侧节点、右侧主题列表，点击进入正文与回复。

- 数据源：V2EX 官方 API（`https://www.v2ex.com/api` 与 `https://www.v2ex.com/api/v2`），不抓取网页、不注入脚本。
- 匿名接口：`nodes/all.json`、`topics/latest.json`、`topics/hot.json`、`topics/show.json`、`replies/show.json`。
- 登录接口（API 2.0 Beta，需 Personal Access Token）：`member`、`token`、`notifications`（含 `DELETE`）、`topics/:id`、`topics/:id/replies`、`nodes/:name/topics`。
- 只读内容：不携带 Cookie、不调用发帖 / 回复 / 感谢 / 收藏接口；登录后唯一的写操作是删除自己的提醒。
- 纯前端：没有 native cdylib，网络请求走宿主 `otools_host_http_send`（V2EX 不返回 CORS 头，浏览器 fetch 会被拦）。

## 功能

- 左侧节点栏：最新 / 最热入口、最近访问、根节点分组折叠、节点搜索。
- 右侧主题列表：节点徽章、作者、相对时间、摘要、回复数；顶部搜索框可同时过滤节点与当前列表。
- 详情页：正文与回复 HTML 经白名单清洗后渲染，图片可点击查看原图，站内 `/t/<id>` 链接直接在当前窗口打开。
- 外部动作：复制原帖链接、在系统浏览器打开原帖。
- 缓存：节点 24h，列表 2–5min，详情 5min，回复 3min；请求串行并保持 180ms 间隔。
- 限流：读取响应头 `X-Rate-Limit-*`，在状态栏显示剩余额度。匿名接口默认每 IP 每小时 120 次（CDN 命中不扣额度），API 2.0 为 600 次。
- 窄面板（宽度 < 700px）下节点栏自动变抽屉，账号面板改为贴底抽屉。
- 账号：顶栏右侧入口，未登录输入 Personal Access Token，登录后显示头像与提醒数；点提醒直接跳到对应主题，可单条删除。

## 登录

V2EX 没有 OAuth，也没有账号密码登录接口，唯一的官方方式是 **Personal Access Token**（`Authorization: Bearer <token>`），
用户在 <https://www.v2ex.com/settings/tokens> 自行生成后粘贴进插件。插件全程不接触账号密码与 Cookie。

登录后能做的（API 2.0 Beta 目前的全部能力）：

| 能力 | 接口 |
| --- | --- |
| 我的资料 | `GET /api/v2/member` |
| 提醒列表 | `GET /api/v2/notifications?p=` |
| 删除提醒 | `DELETE /api/v2/notifications/:id` |
| 令牌信息（校验 / 有效期） | `GET /api/v2/token` |

**不能**：发帖、回复、感谢、收藏、关注——API 2.0 没有这些写接口，需要发帖时点「在浏览器打开」。

数据落地：token 存在插件 webview 自己的 `localStorage`（`otools-v2ex:token`），仅本机，可随时在 V2EX 后台撤销；
登出或令牌失效会自动清除。登录后主题 / 回复优先走 API 2.0，请求失败（令牌过期、接口变动）自动回退匿名 v1 接口，保证浏览不受影响。
提醒每 3 分钟轮询一次，窗口进入后台时暂停。

## 仓库结构

```
src/             Vue 3 + TS 前端（组件、API 客户端、i18n、主题令牌）
i18n/            8 语言文案（zh-CN / en-US / ja-JP / ko-KR / de-DE / ru-RU / es-ES / ar-SA）
screenshots/     市场轮播图（webp，清单写在 plugin.json）
scripts/         pack-plugin.mjs（手写 ZIP → .oplg）、verify-plugin.mjs、serve-dist.mjs、publish-market.mjs
plugin.json      插件清单（宿主读它，entry 指向 dist/index.html）
```

运行时依赖只有 `otools-plugin-sdk`（npm 包，只用 `runtime` 的 `invoke` / `openExternal`）与 `vue`。

## 开发

```bash
npm install
npm run dev          # http://127.0.0.1:6570
npm run typecheck
npm run build        # vue-tsc + vite build → dist/
npm run preview      # 静态托管 dist/（6571）
```

本地没有宿主运行时（或需要离线预览）时，访问 `?mock=1` 使用内置示例数据；`?mock=1&topic=1257265` 可直接打开示例详情。

## 打包与校验

```bash
npm run pack         # dist-pack/otools-v2ex-<version>.oplg + SHA256SUMS + meta.json
npm run verify       # 校验 ZIP 结构、CRC、entry、logo.svg、摘要清单
```

`.oplg` 是扁平 ZIP（`plugin.json` / `logo.svg` / `dist/**`），宿主插件仓库的「本地安装」可直接装。

## 发布

版本标签触发 `.github/workflows/release-plugin.yml`：

```bash
git tag -a v0.1.1 -m "V2EX 插件 v0.1.1" && git push origin v0.1.1
```

- `v<版本>` 与 `plugin.json` 的 `version` 必须一致，否则 `publish-market.mjs meta` 直接失败。
- 仓库变量 `OTOOLS_PUBLISH_MARKET=true` 时同步上架插件市场（默认 `false`：只发 GitHub Release）。
- 市场认证走 `release` environment 的 `XYCLOUD_PAT`（`AUTH_MODE=pat`），失败时只影响上架，Release 已先完成。
- 补发市场：Actions → release-plugin → `publish_market=true`、`dry_run=false`，并把 `release_tag` 填成已推的 `v<版本>`，
  复用同一个 Release，避免仓库里出现第二个指向同产物的标签。
- 本插件纯前端、无平台相关产物，因此走**单合包**（`packageMode=0` + `packageUrl`），不产出六平台分包。
- 市场截图在 `plugin.json` 里只写包内相对路径（`screenshots/xx.webp`），发布时 `publish-market.mjs` 会补成
  `raw.githubusercontent.com/<repo>/<tag>/...`：市场只认 https 图片链，Release 资产链会 302 到 octet-stream
  被 `<img>` 拒载。截图跟着 tag 走，**换图必须随新版本一起推**，否则市场仍指向旧 tag 的那几张。

## 主题

插件 webview 不加载宿主样式表，颜色令牌由 `src/styles.css` 自持：`html.dark` 切换暗色，`--v2-accent`
由 `src/theme.ts` 按宿主强调色档位写入（优先 `window.__OTOOLS_THEME__`，其次本地缓存，最后跟随系统）。
不依赖 Element Plus 的 css-vars。
