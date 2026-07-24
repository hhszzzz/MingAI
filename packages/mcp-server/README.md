# taibu-mcp-server

TaiBu 的公共在线 MCP Server，使用 Streamable HTTP，任何网络客户端都可以直接连接，不要求 OAuth、API Key 或数据库。

## 功能

- 复用 `taibu-core` 的全部公开 MCP 工具
- 标准入口：`POST /mcp`、`GET /mcp`、`DELETE /mcp`
- `content[0].text` 返回规范文本，`structuredContent` 返回 canonical JSON
- 有状态会话和无状态客户端兼容
- Host、Origin、请求体、IP 请求频率、SSE、单 IP 会话及总会话容量保护
- 可选高德地点解析；未配置时保留 core 的原始地点处理行为

## 运行

```bash
pnpm install
pnpm -C packages/core build
pnpm -C packages/mcp-server build
pnpm -C packages/mcp-server start
```

默认监听 `127.0.0.1:3001`：

- `GET /health`
- `GET /info`
- `POST /mcp`

`/info` 的 `auth` 固定为 `none`。服务不会读取或验证 `Authorization`、`x-api-key`。

## 客户端配置

```json
{
  "mcpServers": {
    "taibu": {
      "type": "streamable-http",
      "url": "https://mcp.mingai.fun/mcp"
    }
  }
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MCP_HOST` | `127.0.0.1` | 监听地址；容器中使用 `0.0.0.0` |
| `PORT` | `3001` | 服务端口 |
| `MCP_ALLOWED_ORIGINS` | 空 | 浏览器 Origin 白名单；无 Origin 的 MCP 客户端正常放行 |
| `MCP_ALLOWED_HOSTS` | 空 | 可选 Host 白名单 |
| `MCP_MAX_SESSIONS` | `1000` | 最大活跃会话数 |
| `MCP_MAX_SESSIONS_PER_IP` | `20` | 单 IP 最大活跃会话数 |
| `MCP_SESSION_TTL_MS` | `1800000` | 会话最大生命周期 |
| `MCP_SESSION_IDLE_MS` | `600000` | 会话空闲超时 |
| `MCP_RATE_LIMIT_PER_MINUTE` | `120` | 单 IP、单 HTTP method 每分钟请求数 |
| `MCP_MAX_SSE_PER_IP` | `3` | 单 IP SSE 并发数 |
| `MCP_TRUST_PROXY` | `false` | 仅在服务位于受信反向代理后启用 |
| `MCP_REQUEST_LOG` | `false` | 输出匿名请求日志 |
| `AMAP_WEB_SERVICE_KEY` | 空 | 可选地点解析密钥 |

浏览器请求必须配置 `MCP_ALLOWED_ORIGINS`；生产环境应列出确切来源，不建议使用 `*`。这项校验是 DNS rebinding 防护，不是用户认证。

## Docker Compose

```bash
docker compose --env-file .env -f docker-compose.mcp.yml up -d --build
```

公共 MCP 容器不需要任何 Supabase、JWT 或站点账号变量。

## 包关系

- `taibu-core`：算法、工具 manifest、规范文本和 JSON
- `taibu-mcp`：本地 Stdio MCP Server
- `taibu-mcp-server`：公共 Streamable HTTP 运行时
