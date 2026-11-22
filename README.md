# Wabicat 信息站

轻量、无第三方运行依赖的中文信息阅读站：提供深色响应式网页、站内搜索和分页 JSON API；可选的管理员 API 支持经令牌保护的内容管理。

本项目是在取得许可后，从 [原始公开仓库](https://github.com/CanesMueu1900/wabicat-info-site) 独立复制并改进的；此仓库以全新的 Git 历史发布，不是 GitHub fork。

## 功能

- Node.js 内置模块实现静态站点和 JSON API，无需 `npm install`。
- 深色响应式页面、关键词搜索、分页加载、正文折叠和来源链接。
- API 支持按关键词查询及 limit/offset 分页。
- 写接口默认关闭；设置服务端 `ADMIN_API_KEY` 后才可写入。
- 畸形或非数组内容文件会使读写请求明确失败，不会被悄悄当作空列表覆盖。
- 内置 Node 测试覆盖分页、搜索、授权和损坏数据保护；GitHub Actions 自动运行测试。

## 运行

需要 Node.js 18 或更新版本。

```sh
npm start
```

默认监听 `0.0.0.0:3000`，可用 `PORT` 指定端口。内容默认存放于 `data/items.json`；若托管平台会清理应用目录，请设置 `DATA_FILE` 指向持久化位置。

可选 `.env` 配置示例：

```dotenv
ADMIN_API_KEY=replace-with-a-long-random-secret
DATA_FILE=/path/to/persistent/items.json
```

`.env`、`.env.*` 和内容数据文件均由 `.gitignore` 排除。用生产环境强随机密钥替换示例值；不要提交密钥或把它放进 URL、网页、日志或仓库。

## API

- `GET /api/health`：公开健康检查。
- `GET /api/items`：公开列表；可传 `q`、`limit`（1–50，默认 20）和 `offset`（默认 0）。响应包含 `items`、筛选后 `total`、`offset`、`limit`、`hasMore`。
- `POST /api/items`：新增条目。
- `PATCH /api/items/:id`、`PUT /api/items/:id`：更新条目。
- `DELETE /api/items/:id`：删除条目。

所有写入需使用 `Authorization: Bearer <ADMIN_API_KEY>`。JSON 字段为 `title`（必填，最多 180 字符）、`summary`（最多 500）、`body`（最多 12,000）、`category`（最多 60）及可选 `sourceUrl`（仅 HTTP(S)，最多 2048）。请求体上限 256 KiB。服务端生成 ID 与时间戳；文件以临时文件替换方式保存。

```sh
curl 'http://localhost:3000/api/items?limit=10&q=旅行'

curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"示例资讯","summary":"简短摘要","body":"正文","category":"新闻","sourceUrl":"https://example.com/"}'
```

## 测试

```sh
npm test
```

测试使用临时目录和仅用于测试的密钥，不会写入真实内容或需要外部服务。
