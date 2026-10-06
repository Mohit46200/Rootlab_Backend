import "dotenv/config";
import express from "express";
import cors from "cors";

const { CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV = "sandbox", FRONTEND_URL = "http://localhost:5173", PORT = 4000 } = process.env;
const BASE = CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
const PRICE = 5; // rupees per method (the server decides the amount, never the browser)
const VALID = ["bisection", "newton", "regula", "iterative", "secant"];

const headers = {
  "Content-Type": "application/json",
  "x-api-version": "2023-08-01",
  "x-client-id": CASHFREE_APP_ID,
  "x-client-secret": CASHFREE_SECRET_KEY,
};

const app = express();
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// 1) Create a Cashfree order
app.post("/api/create-order", async (req, res) => {
  try {
    const { methods, phone } = req.body;
    const chosen = [...new Set(methods)].filter((m) => VALID.includes(m));
    if (!chosen.length) return res.status(400).json({ error: "No valid methods selected" });
    if (!/^\d{10}$/.test(phone || "")) return res.status(400).json({ error: "Enter a valid 10-digit phone number" });

    const orderId = "order_" + Date.now() + Math.floor(Math.random() * 1000);
    const r = await fetch(BASE + "/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        order_id: orderId,
        order_amount: chosen.length * PRICE,
        order_currency: "INR",
        customer_details: { customer_id: "cust_" + phone, customer_phone: phone },
        order_meta: { return_url: `${FRONTEND_URL}/?order_id={order_id}` },
        order_note: chosen.join(","),
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || "Cashfree error" });
    res.json({ order_id: data.order_id, payment_session_id: data.payment_session_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2) Verify the order status with Cashfree before the PDF is generated
app.get("/api/verify/:orderId", async (req, res) => {
  try {
    const r = await fetch(`${BASE}/orders/${encodeURIComponent(req.params.orderId)}`, { headers });
    const data = await r.json();
    res.json({ order_status: data.order_status, order_id: data.order_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`RootLab server on http://localhost:${PORT} (${CASHFREE_ENV})`));
