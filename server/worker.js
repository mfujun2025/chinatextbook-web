/**
 * Cloudflare Worker - 支付宝 Vibe Pay 支付服务器
 *
 * 功能：
 *  - POST /api/createOrder  创建支付订单，返回支付宝支付跳转URL
 *  - POST /api/notify       接收支付宝异步通知，验签并更新订单状态
 *  - GET  /api/query        查询订单状态
 *  - GET  /api/download     验证支付后返回教材下载链接
 *
 * 部署到 Cloudflare Workers，使用 KV 存储订单数据。
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS 处理
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 路由
    if (url.pathname === '/api/createOrder' && method === 'POST') {
      return createOrder(request, env);
    }
    if (url.pathname === '/api/notify' && method === 'POST') {
      return handleNotify(request, env);
    }
    if (url.pathname === '/api/query' && method === 'GET') {
      return queryOrder(url, env);
    }
    if (url.pathname === '/api/download' && method === 'GET') {
      return downloadLink(url, env);
    }

    return jsonError('Not Found', 404);
  },
};

// ========== 创建订单 ==========
async function createOrder(request, env) {
  try {
    const body = await request.json();
    const { bookId, bookName, amount } = body;

    if (!bookId || !bookName || !amount) {
      return jsonError('缺少参数: bookId, bookName, amount', 400);
    }

    // 生成商户订单号
    const outTradeNo = 'CTB_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);

    // 构造支付宝请求参数
    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: amount,
      subject: bookName,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      body: `教材下载: ${bookName}`,
    };

    // 构造公共参数
    const params = {
      app_id: env.ALIPAY_APP_ID,
      method: 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: formatTimestamp(),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
      notify_url: `${new URL(request.url).origin}/api/notify`,
    };

    // 签名
    const signStr = buildSignString(params);
    const signature = await rsaSign(signStr, env.ALIPAY_PRIVATE_KEY);
    params.sign = signature;

    // 构造跳转URL
    const gateway = env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
    const payUrl = `${gateway}?${new URLSearchParams(params).toString()}`;

    // 存储订单到KV
    const orderData = {
      outTradeNo,
      bookId,
      bookName,
      amount,
      status: 'pending',
      createdAt: Date.now(),
    };

    await env.ORDERS.put(outTradeNo, JSON.stringify(orderData), { expirationTtl: 86400 });

    return jsonOk({
      order_id: outTradeNo,
      pay_url: payUrl,
      status: 'pending',
    });
  } catch (e) {
    return jsonError('创建订单失败: ' + e.message, 500);
  }
}

// ========== 处理支付宝异步通知 ==========
async function handleNotify(request, env) {
  try {
    const formData = await request.formData();
    const params = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value;
    }

    // 验签
    const sign = params.sign;
    delete params.sign;
    delete params.sign_type;

    const signStr = buildSignString(params);
    const valid = await rsaVerify(signStr, sign, env.ALIPAY_PUBLIC_KEY);

    if (!valid) {
      return new Response('failure', { status: 200 });
    }

    const { out_trade_no, trade_status, total_amount } = params;

    // 查询订单
    const orderRaw = await env.ORDERS.get(out_trade_no);
    if (!orderRaw) {
      return new Response('failure', { status: 200 });
    }

    const order = JSON.parse(orderRaw);

    // 核对金额
    if (order.amount !== parseFloat(total_amount)) {
      return new Response('failure', { status: 200 });
    }

    // 更新订单状态
    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      order.status = 'paid';
      order.paidAt = Date.now();
      await env.ORDERS.put(out_trade_no, JSON.stringify(order), { expirationTtl: 86400 });
      return new Response('success', { status: 200 });
    }

    return new Response('failure', { status: 200 });
  } catch (e) {
    return new Response('failure', { status: 200 });
  }
}

// ========== 查询订单状态 ==========
async function queryOrder(url, env) {
  const orderId = url.searchParams.get('order_id');
  if (!orderId) return jsonError('缺少order_id', 400);

  const raw = await env.ORDERS.get(orderId);
  if (!raw) return jsonError('订单不存在', 404);

  const order = JSON.parse(raw);
  return jsonOk({
    order_id: order.outTradeNo,
    status: order.status,
    book_name: order.bookName,
    amount: order.amount,
  });
}

// ========== 获取下载链接 ==========
async function downloadLink(url, env) {
  const orderId = url.searchParams.get('order_id');
  const bookId = url.searchParams.get('book_id');

  if (!orderId || !bookId) return jsonError('缺少参数', 400);

  const raw = await env.ORDERS.get(orderId);
  if (!raw) return jsonError('订单不存在', 404);

  const order = JSON.parse(raw);
  if (order.status !== 'paid') {
    return jsonError('订单未支付', 403);
  }

  if (order.bookId !== bookId) {
    return jsonError('订单与教材不匹配', 403);
  }

  // 返回教材的 raw 下载链接
  const baseUrl = env.DOWNLOAD_BASE_URL || 'https://raw.githubusercontent.com/mfujun2025/ChinaTextbook/master/';
  const downloadUrl = baseUrl + bookId;

  return jsonOk({ download_url: downloadUrl });
}

// ========== 工具函数 ==========
function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildSignString(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '' && k !== 'sign')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

async function rsaSign(message, privateKeyPem) {
  const { sign } = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(async (key) => {
    const sig = await crypto.subtle.sign(
      { name: 'RSA-PSS', saltLength: 32 },
      key,
      new TextEncoder().encode(message)
    );
    return { sign: base64ToHex(sig) };
  });
  return sign;
}

async function rsaVerify(message, signatureHex, publicKeyPem) {
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem),
      { name: 'RSA-PSS', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = hexToArrayBuffer(signatureHex);
    return crypto.subtle.verify(
      { name: 'RSA-PSS', saltLength: 32 },
      key,
      sigBytes,
      new TextEncoder().encode(message)
    );
  } catch {
    return false;
  }
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

function base64ToHex(b64) {
  const bin = atob(b64);
  let hex = '';
  for (let i = 0; i < bin.length; i++) {
    hex += bin.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

function hexToArrayBuffer(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr.buffer;
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
