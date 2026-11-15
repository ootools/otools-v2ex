# 第三方声明

本插件随 `dist/` 分发的产物包含以下第三方代码：

## Vue

- 项目：https://github.com/vuejs/core
- 版本：3.5.x
- 许可证：MIT
- 用途：插件前端框架（运行时打包进 `dist/assets/*.js`）

## otools-plugin-sdk

- 来源：OTools 宿主仓 `vendor/otools-plugin-sdk`（本仓库 `vendor/` 下为快照，见 `vendor/sdk-source.json`）
- 许可证：Apache-2.0（见 `vendor/otools-plugin-sdk/LICENSE`）
- 用途：跨运行时桥接，仅使用 `otools-plugin-sdk/runtime` 的 `invoke` / `openExternal` / `isOtoolsPluginRuntime`

## V2EX API

插件通过 V2EX 官方 1.0 API 读取公开数据，不包含 V2EX 的商标、图标或任何站点资源；
节点与主题内容版权归 V2EX 及对应作者所有。
