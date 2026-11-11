# XMax IR 1.1.0 — 公司服务器部署与验收

运行架构：访客 → 公司域名 HTTPS/Nginx → 本机 Node.js → 公司持久磁盘。日常运行不连接 Vercel；旧站只在一次性迁移时使用。股价/SEC 仍需服务器访问 Finnhub、data.sec.gov、www.sec.gov；走势图使用 TradingView。不能将“脱离 Vercel”理解成所有市场数据也都离线提供。

## 1. 交付物与服务器要求

- 正式交付：`xmax-ir-1.1.0.tar.gz` 和 `SHA256SUMS`。压缩包带锁定的纯 JavaScript 依赖、本站字体、DOMPurify 与许可证，无需在目标机下载 npm 包。
- Linux + systemd + Nginx；**Node.js >=22.12.0，建议公司维护的 Node 22/24 LTS**。不要使用旧版 Node 18。
- 程序：`/opt/xmax-ir`，只读；数据：`/var/lib/xmax-ir`，运行用户可写。上传、CMS、迁移清单及备份均位于数据目录。
- 外部流量只开放80/443，Node只监听127.0.0.1:3000。DNS `ir.xmax.com` 指向公司入口，Nginx不得将 `/api/`、`/news/`、`/files/` 代理到个人托管平台。
- 本包不含 `.env`、密码、行情密钥、旧站数据或私人审查材料。

## 2. 首次安装（切流量前完成）

以 Ubuntu/Debian 为例，先按公司标准安装 Node、Nginx、公司证书并确认 `node -v`、`nginx -v`。公司证书需覆盖 `ir.xmax.com`。以下命令在交付包所在目录执行：

```bash
sha256sum -c SHA256SUMS
sudo useradd --system --home /opt/xmax-ir --shell /usr/sbin/nologin xmaxir
sudo install -d -m 755 /opt/xmax-ir
sudo install -d -o xmaxir -g xmaxir -m 750 /var/lib/xmax-ir
# 先查看归档，确认只有 xmax-ir-1.1.0/ 这一层
tar -tzf xmax-ir-1.1.0.tar.gz | head
sudo tar -xzf xmax-ir-1.1.0.tar.gz --strip-components=1 -C /opt/xmax-ir --no-same-owner
sudo chown -R root:root /opt/xmax-ir
sudo install -o root -g xmaxir -m 640 /opt/xmax-ir/.env.example /opt/xmax-ir/.env
```

注意：`.env.example` 在归档中随部署目录提供；**后续升级不要覆盖已有 `.env`**。用户已存在时跳过 useradd。使用 Node 版本管理器时，systemd 可能找不到其 PATH；应安装系统级 Node 或将服务的 ExecStart 改成已验证的绝对路径。

配置环境变量：

```bash
# 生成24字节随机密码（48位十六进制）；通过公司安全渠道保管和交接
openssl rand -hex 24
sudoedit /opt/xmax-ir/.env
sudo chown root:xmaxir /opt/xmax-ir/.env
sudo chmod 640 /opt/xmax-ir/.env
```

必填：

| 项目 | 值 / 要求 |
|---|---|
| HOST / PORT | `127.0.0.1` / `3000` |
| SITE_URL | `https://ir.xmax.com` |
| STORAGE_DIR | `/var/lib/xmax-ir`，不要放到public中 |
| ADMIN_PASSWORD | 使用上面新生成的随机密码，至少24位；不要使用示例或测试密码 |
| QUOTE_API_KEY | 使用单独安全交接的 Finnhub 密钥；不要写进网页、Nginx或工单公开附件 |
| SEC_UA | `XMax Inc. Investor Relations IR@XMax.com` |
| UPLOAD_MAX_MB | 默认200 |
| UPLOAD_TIMEOUT_SECONDS | 默认900；调整时同步调整 Nginx 超时 |
| GNW_RSS | 可选，经公司开通的新闻全文RSS |
| MIGRATE_FILE_HOST | 可选，仅迁移使用；默认匹配 `blob.vercel-storage.com` 及其子域，其他旧文件主机用逗号分隔精确指定 |

```bash
cd /opt/xmax-ir
sudo -u xmaxir npm run check
sudo cp deploy/xmax-ir.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now xmax-ir
sudo systemctl status xmax-ir
curl --fail http://127.0.0.1:3000/healthz
```

`npm run check` 失败时先修复，不要切流量。检查依赖、Node、必填配置、存储权限、CMS JSON 和迁移锁。生产模式缺配置会直接拒绝启动。健康响应需有 `ok:true`、`storage:true`、`version:"1.1.0"`。健康检查不验证真实外部数据。

## 3. Nginx、域名与外部访问

```bash
sudo cp deploy/nginx-ir.xmax.com.conf /etc/nginx/sites-available/ir.xmax.com.conf
# 编辑证书路径。核对当前已存在的 server_name，避免同名虚拟主机冲突。
sudoedit /etc/nginx/sites-available/ir.xmax.com.conf
sudo ln -s /etc/nginx/sites-available/ir.xmax.com.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

示例 `location /` 将所有路径传给本机 Node；不要只部署 public 静态目录，不要对 API 用 `try_files ... =404`，也不要在 Nginx 缓存 API。不要重复添加已存在的软链接。

迁移切流量前，可通过公司测试入口，或在检查工作站临时 hosts/`curl --resolve ir.xmax.com:443:公司IP` 指向公司服务器；保持正式域名和TLS校验。不要为了测试关闭证书验证。DNS变更应安排回滚与旧站保留窗口。

### 3.1 没有测试服务器：在现有服务器并行验收

无需另购测试服务器。先由运维确认现有操作系统、入口软件、可用端口和资源；本包示例适用于 Linux + systemd + Nginx。使用宝塔等面板时应在已有 `ir.xmax.com` 站点中调整，避免生成重复虚拟主机。

1. 保留现有官网、旧 IR 和 DNS；备份旧 IR 的入口配置、程序和内容。新版使用独立程序目录、服务用户、持久数据目录和空闲回环端口，不能覆盖主站的 PHP/数据库或直接覆盖旧 IR。若3000端口已占用，必须同步修改 `.env` 与 Nginx `proxy_pass`。
2. 完成本 README 的预检和迁移演练；冻结旧后台后，在新版数据目录执行正式迁移，再启动新版。服务重启后再次检查文件与后台内容。新版准备期间旧站继续面向公众服务。
3. 在服务器先运行第5节的 `--local` 验证；另外逐一检查 `/api/quote`、`/api/filings`、`/api/financials`、`/api/news`，确认返回有效业务数据，抽查新闻正文。`--local` 本身不会验收真实上游。
4. 若需要切换前浏览器验收，由运维配置仅允许指定验收来源访问的预览入口。若公司前面有 CDN/LB，必须先确认实际客户端地址，不能把代理节点地址误作验收者地址。预览使用有效HTTPS证书，完成后撤销临时规则。不要为预览开放Node端口到公网。
5. **hosts只改变域名到IP的解析。旧IR与新版位于同一个IP、同一个443入口时，仅改hosts不会切换到新版。** 不具备小范围预览条件时，在约定维护窗口调整 IR 的入口，并准备立即恢复旧配置；切换后运行完整 `verify` 和人工验收，通过后再宣布完成。
6. 对公众切换的范围仅为 IR。主站 Investor Relations 入口最终应指向 `https://ir.xmax.com/`，若当前已正确则无需修改。IR 的 `/api/`、`/news/`、`/files/` 以及首页必须一起交给新版 Node，不能只上传静态页面。

操作结束请交回：完整验收输出、迁移数量与文件校验结果、主站跳转及IR新闻/文件截图、重启后内容保留结果、备份位置和恢复旧入口的方法。输出中不要包含密码和密钥。无需把本机预览地址 `127.0.0.1:3100` 写入主站或正式配置。

## 4. 旧数据迁移（先演练，再正式执行）

**前置条件：旧站 `/api/docs?fresh=1`、`/api/newscms?fresh=1` 能返回正确 JSON；旧文件能下载。** 如果旧站超时、被关闭或权限不通，不要空着上线。先请旧站维护人恢复只读导出通道；不能用当前 API 返回404的公司站当作迁移来源。

### 4.1 预检与演练

```bash
cd /opt/xmax-ir
# 阅读输出的治理文件/简报/后台新闻/标题设置/待搬文件数量
sudo -u xmaxir node tools/migrate.js https://xmax-ir.vercel.app --dry-run

# 演练必须使用另一个空目录，STORAGE_DIR 环境值会优先于 .env
sudo install -d -o xmaxir -g xmaxir -m 750 /var/lib/xmax-ir-rehearsal
sudo -u xmaxir env STORAGE_DIR=/var/lib/xmax-ir-rehearsal node tools/migrate.js https://xmax-ir.vercel.app
```

`--dry-run` 不修改存储，也不下载/校验文件，仅用于验证接口结构与计划。演练才实际下载文件。比较演练清单、旧后台实际条目与可读文件。先冻结旧后台编辑，避免两个源接口读取期间内容变化。

### 4.2 正式迁移

**迁移前停止公司 Node 服务，并备份当前数据。不要在新后台先发布内容。**

```bash
sudo systemctl stop xmax-ir
sudo install -d -m 700 /var/backups/xmax-ir
IR_BACKUP_STAMP=$(date -u +%Y%m%dT%H%M%SZ)
sudo tar -C /var/lib -czf /var/backups/xmax-ir/before-migration-$IR_BACKUP_STAMP.tar.gz xmax-ir
sudo chmod 600 /var/backups/xmax-ir/before-migration-$IR_BACKUP_STAMP.tar.gz
cd /opt/xmax-ir
sudo -u xmaxir node tools/migrate.js https://xmax-ir.vercel.app
sudo -u xmaxir npm run check
sudo systemctl start xmax-ir
```

已有 CMS 时默认拒绝覆盖。只有确认备份且确需重新替换时，才由运维在命令后加 `--force`。执行完成需看到 `COMMITTED`，不能只看中间下载日志。工具具备：

- 源数据结构校验；缺字段/错误响应中止，不再用空新闻兜底。
- 文档与新闻 URL、正文链接和图片资源搬迁；清理不安全富文本。SEC、GlobeNewswire、公司官网等正常外链保留。
- URL去重及独立文件名；流式下载、超时、大小限制、SHA-256校验；发现旧托管链接残留则拒绝提交。
- 全部下载完成后提交；保留原 CMS 和原始源快照到 `STORAGE_DIR/backups/<批次>/`。
- 清单在 `STORAGE_DIR/cms/migration-manifest.json`，记录数量、文件大小、SHA-256、URL映射和被清理的正文 ID。

迁移数量只统计“后台新闻”；代码内置新闻、SEC自动新闻不属于旧 CMS 搬迁条数。正文安全清理可能去掉Word样式或危险标签；检查清单中的正文 ID 并人工确认排版与原文完整性。

**异常恢复：**普通失败会保留原CMS并退出非0；下载后未提交的独立文件可能残留，但不覆盖旧文件。若进程被强杀、停电，`.migration.lock` 会阻止启动；不要直接删锁强行上线。先核对备份与 `cms/`：若旧CMS已移到 `backups/<批次>/cms` 而新CMS未提交，应在服务停止状态恢复旧CMS；验证两份JSON后再移除锁。可直接从完整迁移前备份恢复整个数据目录；保留故障目录供检查。

## 5. 上线验收（任何必需项失败都不切生产）

```bash
cd /opt/xmax-ir
# 先验证本机应用/文件；--local 会跳过真实行情、SEC与新闻全文，不能作为上线通过依据
sudo -u xmaxir node tools/verify.js http://127.0.0.1:3000 --local
# 经正式HTTPS入口，验证真实数据、迁移文件及版本
sudo -u xmaxir node tools/verify.js https://ir.xmax.com
```

脚本非0即失败。正式验收包括：首页、版本健康、真实行情、SEC列表和财务、新闻列表与最新全文、后台凭证、私有路径404、迁移后文件逐个下载校验哈希、迁移内容数量、站点地图域名。迁移数量比对应在首次后台编辑前进行。正式验收缺少迁移清单会失败；不能跳过实际迁移直接宣布上线通过。验收工具只向配置的HTTPS SITE_URL或本机回环地址发送后台凭证。工具会通过请求头使用本机 `.env` 的后台密码，不打印密码。

人工还需检查：

- 最新及历史新闻正文，中文标题、隐藏/恢复、撤销分类；抽查原文与正文附件。
- 后台新增测试新闻，上传文件、保存并重新编辑，撤销测试修改；确认前台同步且无漏条。正式数据先备份。
- 超过30秒的大文件上传、PDF/演示文稿下载；文件地址应为本站 `/files/...`。合法SEC或公司官网原文件可以保留外链。
- `systemctl restart xmax-ir` 后文件、后台内容不丢失；演练从完整备份恢复。
- 浏览器网络面板访问各栏目，确认不再请求 `*.vercel.app` 或 `*.blob.vercel-storage.com`；TradingView、SEC、Finnhub等明确列出的数据源可保留。
- 中国大陆及公司主要投资者地区的真实网络访问、手机显示、证书与公司官网IR导航。
- IT确认DNS与Nginx实际配置没有转发个人平台；行情公开展示的服务商授权、IR文案和译文由公司负责人员确认。


`verify` 失败定位：本机通过、HTTPS失败多为Nginx/证书/域名问题；本机接口也404，多为旧版本进程或仅部署了静态目录；行情503检查密钥及网络，SEC503检查出口和SEC_UA。不要靠硬编码数据判断接口正常。

## 6. 日常维护、升级与回滚

- 日志：`journalctl -u xmax-ir -n 100` / `journalctl -u xmax-ir -f`。
- 每日备份 `/var/lib/xmax-ir` 至公司备份系统，限制备份权限；CMS、文件、迁移清单一起备份。迁移源快照不应公开。
- 更新：先停服务并备份程序和数据；在新临时目录解压新版本，核对SHA；替换程序文件时保留 `.env`，不覆盖数据目录；执行 `npm run check`，启动并运行正式 `verify`。不要把新版本解压覆盖正在运行的程序。
- 回滚：停服务，恢复上一版程序及其原 `.env`；必要时恢复对应完整数据备份，确认属主权限；预检后启动、验收，再恢复流量。版本/数据需要成对保留。
- 修改密码：更新 `.env` 后重启服务。后台密码仅在当前页面内存中，刷新后重新登录；错误登录有进程内限流，建议通过公司VPN或入口规则进一步限制后台访问。
- 如公司前方另有CDN/LB，请核对真实客户端地址传递和限流策略；当前Nginx示例假设直接面对访客，并覆盖伪造的转发头。

## 7. 开发与重新打包

交付不依赖 GitHub：可直接发送 `dist/` 下的压缩包与校验文件。若使用公司私有 GitHub 仓库，部署须固定到已验收的 tag/commit，并保留回滚版本；不要在运行目录直接 `git pull` 后就视为发布完成。Git仓库不包含运行依赖时，在构建环境按锁文件执行 `npm ci --ignore-scripts` 并生成同样的发布包，再交服务器安装。密码、密钥、`.env`、上传文件、存储数据、迁移备份和私人审查资料不得提交；GitHub不是本网站的运行依赖。

```bash
npm ci --ignore-scripts
npm test
npm run release
```

`package-lock.json` 锁定依赖；发布前重新跑测试并在干净解压目录启动验收。`public/vendor/purify.min.js` 必须与锁定DOMPurify版本一致，升级依赖时同步该文件和许可证。打包脚本仅复制明确允许的文件；历史审查报告不混入生产包。测试使用临时目录和模拟外部数据，不使用正式密钥或修改线上站点。
