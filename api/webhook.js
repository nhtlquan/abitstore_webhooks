const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const STATUS_MAP = {
  "AutoCreated": { name: "KHÁCH MỚI", color: "#00a65a" },
  "Chochuyenkhoan": { name: "CHỜ CHUYỂN KHOẢN", color: "#efb71a" },
  "Chonhaphang": { name: "CHỜ NHẬP HÀNG", color: "#efb71a" },
  "Choship": { name: "CHỜ SHIP", color: "#efb71a" },
  "Huyvandon": { name: "HUỶ VẬN ĐƠN", color: "#d52609" },
  "Yeucauhuy": { name: "KHÁCH - YÊU CẦU HỦY", color: "#d52609" },
  "Thanhcong": { name: "THÀNH CÔNG", color: "#243ae0" },
  "Dadoisoat": { name: "ĐÃ ĐỐI SOÁT", color: "#044284" },
  "Daphatthanhcong": { name: "PHÁT THÀNH CÔNG", color: "#3dbcb3" },
  "Dathutien": { name: "ĐÃ THU TIỀN", color: "#3dbcb3" },
  "Deleted": { name: "ĐÃ XOÁ ĐƠN", color: "#d52609" },
  "Donhoatoc": { name: "ĐƠN HỎA TỐC ⚡", color: "#eb6b43" }
};

function formatVND(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + " đ";
}

function parseProducts(products) {
  if (!products) return [];
  if (Array.isArray(products)) return products;
  if (typeof products === "string") {
    try {
      const parsed = JSON.parse(products);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function statusIcon(hex) {
  const h = String(hex || "").toLowerCase();
  // Compact monochrome-style symbols; avoids oversized emoji while keeping visual cues.
  if (h === "#d52609") return "●";
  if (h === "#efb71a") return "◐";
  if (h === "#00a65a" || h === "#77ab5c") return "●";
  if (h === "#3dbcb3" || h === "#2e96f7" || h === "#243ae0" || h === "#044284") return "●";
  if (h === "#9e55a4" || h === "#8e44ad" || h === "#452b87") return "●";
  return "•";
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(d);

  const get = type => parts.find(p => p.type === type)?.value || "";
  return `${get("hour")}:${get("minute")} - ${get("day")}/${get("month")}/${get("year")}`;
}

function buildCaption(body, products) {
  const status = STATUS_MAP[body.invoice_status] || {
    name: String(body.invoice_status || "KHÔNG RÕ").toUpperCase(),
    color: "#737373"
  };

  const shop = body.order_source_name || body.ecom_username || body.channel || "Không rõ";
  const orderId = body.name || body.eoi_order_id || body.invoice_no || "";

  // Block 1: status, shop, order number.
  let caption = `${statusIcon(status.color)} <b>${escapeHtml(status.name)}</b>\n`;
  caption += `⌂ Shop: ${escapeHtml(shop)}\n`;
  if (orderId) caption += `# Mã đơn: ${escapeHtml(orderId)}\n`;

  // Block 2: receiver.
  caption += `\n`;
  if (body.receiver || body.phone_number || body.address) {
    caption += `@ Người nhận: ${escapeHtml(body.receiver || "")}`;
    if (body.phone_number) caption += ` - ${escapeHtml(body.phone_number)}`;
    if (body.address) caption += ` (${escapeHtml(body.address)})`;
    caption += `\n`;
  }

  // Block 3: products + money.
  caption += `\n`;
  if (products.length) {
    for (const p of products) {
      const productName = p.item_name || p.model_name || p.item_sku || "Không rõ sản phẩm";
      caption += `› ${escapeHtml(productName)}\n`;
    }
  } else {
    caption += `› Không có dữ liệu sản phẩm\n`;
  }

  if (body.total !== undefined && body.total !== null) {
    caption += `₫ KH Trả: ${formatVND(body.total)}\n`;
  }
  if (body.ecom_doanhso !== undefined && body.ecom_doanhso !== null) {
    caption += `↗ Doanh thu: ${formatVND(body.ecom_doanhso)}\n`;
  }

  const dateTime = formatDateTime(body.created_at || body.updated_at || body.invoice_date);
  if (dateTime) caption += `\n◷ ${escapeHtml(dateTime)}`;

  return caption;
}

async function telegramRequest(method, payload) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Telegram error ${response.status}: ${text}`);
  return JSON.parse(text);
}

async function sendOnePush(body) {
  const products = parseProducts(body.products);
  const caption = buildCaption(body, products);
  const imageUrl = products[0]?.image_info?.image_url;

  // Exactly one Telegram push. Prefer one photo message containing all order details.
  if (imageUrl && caption.length <= 1024) {
    await telegramRequest("sendPhoto", {
      chat_id: TELEGRAM_CHAT_ID,
      photo: imageUrl,
      caption,
      parse_mode: "HTML"
    });
    return;
  }

  await telegramRequest("sendMessage", {
    chat_id: TELEGRAM_CHAT_ID,
    text: caption.slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "AbitStore Webhook -> Telegram", version: "7.1" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    await sendOnePush(req.body ?? {});
    return res.status(200).json({ ok: true, telegram: "sent", pushes: 1 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
