# 自动更新与 Cloudflare 数据托管

固定入口：https://ciyuan-access-ba1021.pages.dev/preview/

资料更新在 GitHub Actions 上运行，无需电脑、ChatGPT 或新的 Cloudflare API 密钥。

- 每天 UTC 00:17（北京时间 08:17）：刷新日漫目录、剧集元数据、制作公告及缺集对照。
- 每周一 UTC 00:47（北京时间 08:47）：刷新 Bangumi 热度排序的 2010—2026 年各年前 50，并重算覆盖情况。
- 手动运行工作流时默认同时更新两类数据。

GitHub 计划任务可能排队延迟，不保证准点。年度榜必须全部 17 年、每年 50 条通过检查才覆盖旧版本；失败保留之前的完整快照。各资源接口失败时保留旧条目及目录，并记录提供方检查结果。

2026-10-24 增加用户指定的 `www.yhdmtv.cc` 日漫目录适配器（`yh`）。只导入现有 Bangumi 日本非成人动画资料中可精确匹配标题/别名、且年份一致的条目；不执行来源脚本、不下载正片、跳过收费或需解析器的线路。公开页面中的播放地址按原页面规则读取。每日任务刷新已导入条目与最新前三页，抽查每份目录前两条线路的首集 HLS 清单；确定返回 401/403/404/410 或非 HLS 的线路不提供给播放器，网络超时保留“未验证”，清单通过不表示全片、字幕、剪辑或大陆实体手机已验证。

初次目录枚举使用 `node tools/yhdm-source.mjs --initial docs`，遵循该站 robots 允许的分类和详情路径，不调用被禁止的搜索路径。导入记录保存在 `docs/source-intake-summary.json`；`apps.fengctv.com.cn` 未取得可验证剧集接口，未冒充为有效视频源。新增来源同时接入筛选器、详情选源与收藏导入格式。

部分 CDN 拦截 GitHub 等机房 IP。出现受限状态（包括机房侧的 401/403/404）时，不把该检查位置的拒绝视为全球失效：`yhdm-last-verified.json` 保存此前实际通过首集清单检查的目录，优先保留该目录和原验证时间，并记录本次受限状态。首集 URL 未改变时仍接收同一公开列表新增的剧集，避免冻结更新；首集 URL 改变且未验证时回退原目录。没有任何既往有效证据的拒绝线路不会被当作已验证线路加入。网页不绕过来源访问控制。

公开资料保存在 docs/；轻量初始目录及按需作品资料保存在 cloudflare-data/。两者在同一个提交内发布。Cloudflare Pages 的 `_worker.js` 的资料接口只读取此公开仓库的固定 JSON 路径；另有严格限定封面图片域名及格式的图片缓存接口，不代理或保存视频，不携带访问者凭据。

浏览器只请求 Cloudflare 同域数据，GitHub 的取数在 Cloudflare 上执行。边缘与上游缓存约 5 分钟，更新传播可能延后数分钟；上游暂不可达时回退到最后部署的静态快照，显示原始时间，不伪造更新成功。

页面样式与播放器保持在 cloudflare-template/；数据更新不需要重新上传整个 Cloudflare 网站。只修改页面或边缘处理代码时才需通过已有 Wrangler 登录重新部署：

    node tools/build-cloudflare-data.mjs docs cloudflare-data
    node tools/build-cloudflare.mjs docs cloudflare-dist
    wrangler pages deploy cloudflare-dist --project-name ciyuan-access-ba1021 --branch main

构建 Cloudflare 时设置 CIYUAN_AUTOMATION_ENABLED=true，表示仓库定时更新已配置。该变量没有凭据内容。Cloudflare 仍使用现有免费方案，没有启用付费套餐；Functions 有免费额度限制。静态页面和视频不会通过该数据函数。

检查：`node --test tools/update-pipeline.test.mjs`。状态：`/preview/update-status.json`，云端运行记录：https://github.com/yunni-123/ciyuan-anime/actions/workflows/publish.yml。

2026-10-25 修复详情目录被完整搜索目录阻塞的问题。封面由同域 `/preview/cover` 缓存最多七天，只允许列出的 HTTPS 图片域名、JPEG/PNG/WebP、无重定向和凭据、每张不超过 2 MiB；不支持任意地址或视频转发。已按覆盖清单精确匹配的作品带备用 Bangumi 封面，图片错误或可见区域等待超时后尝试备用，最后才用占位图。该接口使用免费 Functions 配额，不承诺大陆线路可达。首次视频加载在尚未播放的暂停状态也受 16 秒检测限制，明确 HTTP 拒绝立即停止重试；保留原画质偏好。测试包括 `tools/loading-recovery.test.mjs`。

2026-10-25 搜索支持本机历史记录（最多 20 条，去重、单条删除、清空）及分档相关度排序：完整片名、片名包含、别名、题材相关；同档保留用户选择的人气/评分/时间排序。题材由已有简介、标签和片名归纳为少量关键词，不额外传输长简介。非空日漫查询直接检索已加载的完整目录，不再先对每个来源分页再截断，因此完整匹配不会被分页挤掉。历史记录仅存在当前浏览器。两部用户反馈作品增加三份同名同年份来源目录，尚未验证大陆手机全片播放。

2026-10-25 页面精简：移除重复追番横幅/头像入口及空的漫画、原声分类；栏目入口随当前页面和主题显示，科技桌面版只使用侧栏。首屏 home-catalog.json 只含至多 72 个真实目录条目（约 48KB），后台独立加载动漫、书目和轻小说，任一资料失败均可重试，部分失败不阻塞其他栏目。首次加载中开始的查询会随完整目录到达自动补全。筛选复用内存目录，不并行调用多个来源重复搜索；已载入完整目录不再经静态 API 重新序列化复制。离线缓存按实际带版本的脚本/样式生成，不在安装时预取完整目录，封面走 HTTP/边缘缓存，不额外写入无限增长的 Service Worker 图片缓存。
