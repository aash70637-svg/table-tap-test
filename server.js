const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const QRCode = require("qrcode");

const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const ordersFile = path.join(dataDir, "orders.json");

const menu = [
  { id: 101, category: "Appetizers", name: "Crispy French Fries", price: 120, dietary: "Veg" },
  { id: 102, category: "Mains", name: "Paneer Butter Masala", price: 280, dietary: "Veg" },
  { id: 103, category: "Mains", name: "Chicken Tikka Masala", price: 320, dietary: "Non-Veg" }
];

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, "[]", "utf8");

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ordersFile, "utf8")); }
  catch { return []; }
}

function writeOrders(orders) {
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), "utf8");
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml" };
  fs.readFile(filePath, (err, contents) => {
    if (err) return json(res, 404, { error: "Page not found" });
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(contents);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
  });
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/menu") return json(res, 200, menu);
  if (req.method === "GET" && url.pathname === "/api/orders") return json(res, 200, readOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const body = await readBody(req);
    const table = Number(body.table);
    const requestedItems = Array.isArray(body.items) ? body.items : [];
    if (!Number.isInteger(table) || table < 1 || table > 100) return json(res, 400, { error: "A valid table number is required." });
    if (!requestedItems.length) return json(res, 400, { error: "Choose at least one item." });

    const items = [];
    for (const requested of requestedItems) {
      const item = menu.find(entry => entry.id === Number(requested.id));
      const quantity = Number(requested.quantity);
      if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return json(res, 400, { error: "One or more order items are invalid." });
      items.push({ ...item, quantity, note: String(requested.note || "").slice(0, 160), lineTotal: item.price * quantity });
    }
    const orders = readOrders();
    const order = { id: createId(), table, items, total: items.reduce((sum, item) => sum + item.lineTotal, 0), status: "New", paymentStatus: "Pay offline", createdAt: new Date().toISOString() };
    orders.push(order);
    writeOrders(orders);
    return json(res, 201, order);
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (req.method === "PATCH" && orderMatch) {
    const body = await readBody(req);
    const allowedStatuses = ["New", "Preparing", "Ready", "Served", "Paid"];
    if (!allowedStatuses.includes(body.status)) return json(res, 400, { error: "Invalid order status." });
    const orders = readOrders();
    const order = orders.find(entry => entry.id === orderMatch[1]);
    if (!order) return json(res, 404, { error: "Order not found." });
    order.status = body.status;
    if (body.status === "Paid") order.paymentStatus = "Paid offline";
    writeOrders(orders);
    return json(res, 200, order);
  }

  if (req.method === "GET" && url.pathname === "/api/qr") {
    const table = Number(url.searchParams.get("table"));
    if (!Number.isInteger(table) || table < 1 || table > 100) return json(res, 400, { error: "A valid table number is required." });
    const host = req.headers.host || `localhost:${port}`;
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const orderUrl = `${protocol}://${host}/?table=${table}`;
    const svg = await QRCode.toString(orderUrl, { type: "svg", margin: 1, color: { dark: "#16261D", light: "#FFFFFF" } });
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
    return res.end(svg);
  }

  return json(res, 404, { error: "Unknown request" });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const resolved = path.resolve(publicDir, `.${pathname}`);
    if (!resolved.startsWith(publicDir)) return json(res, 403, { error: "Forbidden" });
    return sendFile(res, resolved);
  } catch (error) {
    return json(res, 500, { error: error.message || "Something went wrong." });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Restaurant ordering app is running at http://localhost:${port}`);
  console.log(`Staff dashboard: http://localhost:${port}/staff.html`);
});
