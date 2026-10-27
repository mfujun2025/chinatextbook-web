/**
 * Cloudflare Worker - Vibe Pay 支付服务器
 *
 * 功能：
 *  - POST /api/createOrder  创建支付订单
 *  - POST /api/callback      接收支付回调
 *  - GET  /api/order/:id     查询订单状态
 *  - GET  /api/download      验证后返回下载链接
 *
 * 部署：
 *  1. 在 Cloudflare 注册并获取 API Token
 *  2. 创建 Worker，粘贴本文件
 *  3. 在 Worker 设置中绑定 KV 或 DO（用于存储订单状态）
 *  4. 配置环境变量：
 *     VIBE_APP_ID       - Vibe Pay 应用 ID
 *     VIBE_APP_SECRET   - Vibe Pay 应用密钥
 *     VIBE_BASE_URL     - Vibe Pay API 地址（默认 https://api.vibepay.cn）
 *
 * 使用：
 *  前端调用 POST /api/createOrder 创建订单，返回支付链接
 *  Vibe Pay 支付完成后回调 POST /api/callback
 *  前端轮询 GET /api/order/:id 确认支付状态
 *  支付成功后调用 GET /api/download?book=xxx 获取下载链接
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 路由
    if (url.pathname === '/api/createOrder' && method === 'POST') {
      return createOrder(request, env, corsHeaders);
    }
    if (url.pathname === '/api/callback' && method === 'POST') {
      return handleCallback(request, env, corsHeaders);
    }
    if (url.pathname.startsWith('/api/order/') && method === 'GET') {
      return queryOrder(url, env, corsHeaders);
    }
    if (url.pathname === '/api/download' && method === 'GET') {
      return downloadLink(url, env, corsHeaders);
    }

    return jsonResponse({ error: 'Not Found' }, 404, corsHeaders);
  },
};

// ---------- 创建订单 ----------
async function createOrder(request, env, headers) {
  try {
    const body = await request.json();
    const { bookId, bookName, amount } = body;

    if (!bookId || !bookName || !amount) {
      return jsonResponse({ error: '缺少参数' }, 400, headers);
    }

    const orderId = 'ORD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);

    // 调用 Vibe Pay API 创建订单
    // TODO: 替换为实际的 Vibe Pay API 调用
    const payload = {
      app_id: env.VIBE_APP_ID,
      order_id: orderId,
      product_id: bookId,
      amount: amount,
      title: bookName,
      notify_url: `${new URL(request.url).origin}/api/callback`,
    };

    // const resp = await fetch(`${env.VIBE_BASE_URL || 'https://api.vibepay.cn'}/v1/orders`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${env.VIBE_APP_SECRET}`,
    //   },
    //   body: JSON.stringify(payload),
    // });
    // const data = await resp.json();

    // 暂时返回模拟支付链接（需替换为真实 API）
    const payUrl = `https://pay.vibepay.cn/pay/${orderId}`;

    return jsonResponse({
      order_id: orderId,
      pay_url: payUrl,
      status: 'pending',
    }, 200, headers);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500, headers);
  }
}

// ---------- 支付回调 ----------
async function handleCallback(request, env, headers) {
  try {
    const body = await request.json();
    const { order_id, status, amount, sign } = body;

    // TODO: 验签
    // const expectedSign = signData(body, env.VIBE_APP_SECRET);
    // if (sign !== expectedSign) {
    //   return jsonResponse({ error: '验签失败' }, 400, headers);
    // }

    if (status === 'paid' || status === 'success') {
      // TODO: 更新订单状态到 KV/DO
      return jsonResponse({ success: true, message: '已确认收款' }, 200, headers);
    }

    return jsonResponse({ success: false, message: '未确认收款' }, 200, headers);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500, headers);
  }
}

// ---------- 查询订单 ----------
async function queryOrder(url, env, headers) {
  const orderId = url.pathname.split('/').pop();

  // TODO: 从 KV/DO 查询订单状态
  // const order = await env.ORDERS.get(orderId);

  // 暂时返回模拟状态
  return jsonResponse({
    order_id: orderId,
    status: 'pending', // pending / paid / refunded
  }, 200, headers);
}

// ---------- 下载链接 ----------
async function downloadLink(url, env, headers) {
  const bookId = url.searchParams.get('book');
  const orderId = url.searchParams.get('order');

  if (!bookId || !orderId) {
    return jsonResponse({ error: '缺少参数' }, 400, headers);
  }

  // TODO: 验证订单已支付
  // const order = await env.ORDERS.get(orderId);
  // if (!order || order.status !== 'paid') {
  //   return jsonResponse({ error: '未支付或订单不存在' }, 403, headers);
  // }

  // TODO: 返回实际下载链接（从 catalog.json 查询）
  const downloadUrl = `https://raw.githubusercontent.com/mfujun2025/ChinaTextbook/master/${bookId}`;

  return jsonResponse({
    download_url: downloadUrl,
    expires_in: 3600,
  }, 200, headers);
}

// ---------- 工具函数 ----------
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function signData(data, secret) {
  // TODO: 实现 Vibe Pay 签名算法
  const sorted = Object.keys(data).sort();
  const str = sorted.map(k => k + '=' + data[k]).join('&') + '&key=' + secret;
  // return crypto-js.MD5(str).toString().toUpperCase();
  return '';
}
