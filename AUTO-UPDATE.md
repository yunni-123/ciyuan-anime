# 自动更新与 Cloudflare 数据托管

固定入口：https://ciyuan-access-ba1021.pages.dev/preview/

资料更新在 GitHub Actions 上运行，无需电脑、ChatGPT 或新的 Cloudflare API 密钥。

- 每天 UTC 00:17（北京时间 08:17）：刷新日漫目录、剧集元数据、制作公告及缺集对照。
- 每周一 UTC 00:47（北京时间 08:47）：刷新 Bangumi 热度排序的 2010—2026 年各年前 50，并重算覆盖情况。
- 手动运行工作流时默认同时更新两类数据。

GitHub 计划任务可能排队延迟，不保证准点。年度榜必须全部 17 年、每年 50 条通过检查才覆盖旧版本；失败保留之前的完整快照。各资源接口失败时保留旧条目及目录，并记录提供方检查结果。

公开资料保存在 docs/；轻量初始目录及按需作品资料保存在 cloudflare-data/。两者在同一个提交内发布。Cloudflare Pages 的 `_worker.js` 只读取此公开仓库的固定 JSON 路径，不接收任意上游地址，不代理或保存视频，不携带访问者凭据。

浏览器只请求 Cloudflare 同域数据，GitHub 的取数在 Cloudflare 上执行。边缘与上游缓存约 5 分钟，更新传播可能延后数分钟；上游暂不可达时回退到最后部署的静态快照，显示原始时间，不伪造更新成功。

页面样式与播放器保持在 cloudflare-template/；数据更新不需要重新上传整个 Cloudflare 网站。只修改页面或边缘处理代码时才需通过已有 Wrangler 登录重新部署：

    node tools/build-cloudflare-data.mjs docs cloudflare-data
    node tools/build-cloudflare.mjs docs cloudflare-dist
    wrangler pages deploy cloudflare-dist --project-name ciyuan-access-ba1021 --branch main

构建 Cloudflare 时设置 CIYUAN_AUTOMATION_ENABLED=true，表示仓库定时更新已配置。该变量没有凭据内容。Cloudflare 仍使用现有免费方案，没有启用付费套餐；Functions 有免费额度限制。静态页面和视频不会通过该数据函数。

检查：`node --test tools/update-pipeline.test.mjs`。状态：`/preview/update-status.json`，云端运行记录：https://github.com/yunni-123/ciyuan-anime/actions/workflows/publish.yml。
