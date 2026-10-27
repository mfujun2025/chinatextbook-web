# 中国教材库 (ChinaTextbook Web)

收录小学、初中、高中、大学各版本 PDF 教材的在线浏览与付费下载网站。

## 功能

- 📚 按学段、学科、版本、年级四级筛选
- 🔍 实时搜索（书名、学科、版本、年级）
- 📄 书籍详情弹窗（显示大小、分片状态）
- 🛒 付费下载（支付宝 Vibe Pay 收款）
- 📊 统计：637 本教材、7 个学段、24 个学科

## 技术栈

- 纯静态 HTML/CSS/JS，无构建步骤
- 前端：GitHub Pages 托管静态文件
- 支付：Cloudflare Worker（`server/worker.js`）调用支付宝 Vibe Pay API
- 数据：`data/catalog.json`（637 条教材目录）+ `data/pricing.json`（定价方案）

## 目录结构

```
├── index.html              # 首页（浏览、筛选、搜索）
├── pay.html                # 购买页（选择方案、支付宝支付）
├── success.html            # 支付成功页（验证后下载）
├── download.html           # 下载页（备用）
├── data/
│   ├── catalog.json        # 书籍目录数据（637 条）
│   └── pricing.json        # 定价方案
├── server/
│   └── worker.js           # 支付宝支付服务器（Cloudflare Worker）
├── scripts/
│   ├── fetch_tree.py       # 抓取仓库目录树
│   ├── gen_catalog.py      # 生成书籍目录
│   ├── fetch_sizes.py      # 获取文件大小
│   └── merge_sizes.py      # 合并大小到目录
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Pages 部署
```

## 部署

### 1. GitHub Pages（前端）

在仓库 Settings → Pages 中选择 "main 分支 / 根目录"，保存后约 1-2 分钟生效。
访问地址：`https://mfujun2025.github.io/chinatextbook-web/`

### 2. Cloudflare Worker（支付服务）

```bash
# 安装 wrangler
npm install -g wrangler

# 登录
wrangler login

# 创建 KV 命名空间
wrangler kv namespace create ORDERS

# 部署 Worker
wrangler deploy server/worker.js
```

部署后配置环境变量（在 Cloudflare Dashboard → Worker → Settings → Variables）：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| ALIPAY_APP_ID | 应用 AppId | `2019091767145019` |
| ALIPAY_PRIVATE_KEY | 应用私钥（PKCS8, Base64） | `MIIEvQIBADANB...` |
| ALIPAY_PUBLIC_KEY | 支付宝公钥（Base64） | `MIIBIjANBg...` |
| ALIPAY_GATEWAY | 网关地址 | `https://openapi.alipay.com/gateway.do` |
| DOWNLOAD_BASE_URL | 教材下载基础URL | `https://raw.githubusercontent.com/mfujun2025/ChinaTextbook/master/` |

然后在 Worker 设置中绑定 KV 命名空间 `ORDERS`。

### 3. 配置前端

在 `pay.html` 和 `success.html` 中修改 `WORKER_URL` 为你的 Worker 实际地址：
```javascript
const WORKER_URL = 'https://你的worker名.你的子域.workers.dev';
```

## 数据更新

当上游 ChinaTextbook 仓库有新教材时，重新运行：

```bash
python scripts/fetch_tree.py
python scripts/gen_catalog.py
python scripts/fetch_sizes.py
python scripts/merge_sizes.py
git add data/catalog.json
git commit -m "update: sync catalog"
git push
```

## Vibe Pay 接入

1. 访问 [aipay.alipay.com](https://aipay.alipay.com) 申请 Vibe Pay
2. 完成签约入驻，获取 AppId、应用私钥、支付宝公钥
3. 按上述步骤部署 Cloudflare Worker 并配置环境变量
4. 前端配置 WORKER_URL

## 版权说明

教材版权归原作者及出版社所有。本站仅提供教材索引与下载链接，仅供学习交流使用。

## License

MIT
