# 中国教材库 (ChinaTextbook Web)

收录小学、初中、高中、大学各版本 PDF 教材的在线浏览与下载网站。

## 功能

- 📚 按学段、学科、版本、年级四级筛选
- 🔍 实时搜索（书名、学科、版本、年级）
- 📄 书籍详情弹窗（显示大小、分片状态、下载入口）
- ⬇️ 直接下载 PDF（走 raw.githubusercontent.com 直链）
- 📊 统计：637 本教材、7 个学段、24 个学科

## 技术栈

- 纯静态 HTML/CSS/JS，无构建步骤
- 数据存储：GitHub Pages 托管静态文件 + `data/catalog.json` 目录数据
- 支付：Vibe Pay（支付宝 AI 付）— 需服务端，部署在 Cloudflare Workers

## 目录结构

```
├── index.html              # 首页（浏览、筛选、搜索）
├── download.html           # 下载页
├── data/
│   └── catalog.json        # 书籍目录数据（637 条）
├── server/
│   └── worker.js           # Vibe Pay 支付服务器（Cloudflare Worker）
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

```bash
git init
git add .
git commit -m "init: ChinaTextbook Web"
git branch -M main
git remote add origin https://github.com/mfujun2025/chinatextbook-web.git
git push -u origin main
```

在仓库 Settings → Pages 中选择 "GitHub Actions" 作为源。
部署后访问 `https://mfujun2025.github.io/chinatextbook-web/`。

### 2. Cloudflare Worker（支付服务，可选）

```bash
# 安装 wrangler
npm install -g wrangler

# 登录
wrangler login

# 部署
wrangler deploy server/worker.js

# 绑定 KV（用于存储订单状态）
wrangler kv namespace create ORDERS
wrangler kv:namespace put ORDERS
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

## Vibe Pay 集成说明

当前 `server/worker.js` 为框架代码，需替换 `TODO` 处为实际 Vibe Pay API 调用。

接入步骤：
1. 访问 [aipay.alipay.com](https://aipay.alipay.com) 申请 Vibe Pay
2. 获取 App ID 和 App Secret
3. 在 Cloudflare Worker 环境变量中配置：
   ```
   VIBE_APP_ID=your_app_id
   VIBE_APP_SECRET=your_app_secret
   VIBE_BASE_URL=https://api.vibepay.cn
   ```
4. 实现签名算法（参考 Vibe Pay 官方文档）

## 版权说明

教材版权归原作者及出版社所有。本站仅提供索引与下载链接，仅供学习交流使用。

## License

MIT
