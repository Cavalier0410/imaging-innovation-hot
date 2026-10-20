# Digest cron Worker

Cloudflare Worker 的 Cron Trigger，在 **03:00 / 09:00 UTC（11:00 / 17:00 Asia/Shanghai）** 调用 GitHub 的
`workflow_dispatch`，绕开 GitHub Actions 自带的定时延迟。

## 需要的两个 secret

| 名称 | 说明 |
|---|---|
| `GITHUB_TOKEN` | fine-grained PAT，只授权本仓库，权限 `Actions: Read and write`。建议有效期 1 年，到期前更换。 |
| `TRIGGER_KEY` | 任意随机字符串，用于手动测试 `GET /?key=...`，不配置则禁用 HTTP 触发。 |

## 部署

```bash
cd cloudflare/digest-cron
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put TRIGGER_KEY
```

## 手动测试

```bash
curl "https://imaging-digest-cron.<你的子域>.workers.dev/?key=<TRIGGER_KEY>"
```

返回 200 后，GitHub 的 Actions 里会出现一次 `Feishu digest` 的 `workflow_dispatch` 运行。

## 维护

- GitHub token 到期前重新生成并 `npx wrangler secret put GITHUB_TOKEN` 覆盖即可，Worker 代码不用动。
- 改推送时间只改 `wrangler.toml` 里的 `crons`，重新 `npx wrangler deploy`。
