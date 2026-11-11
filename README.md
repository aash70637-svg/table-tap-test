# Table & Tap restaurant ordering app

## Start the app

1. Install Node.js 18 or later.
2. In this folder, run `npm install` once.
3. Run `npm start`.
4. Open `http://localhost:3000/staff.html` on the restaurant Windows computer.
5. Open `http://localhost:3000/qr.html` to generate and print table QR cards.

For customer phones to work, connect them to the restaurant Wi-Fi and replace `localhost` in the QR links with the Windows computer's local network IP address (for example, `192.168.1.25`). The server must stay running while orders are being accepted.

## Included demo menu

- Crispy French Fries — ₹120 — Veg
- Paneer Butter Masala — ₹280 — Veg
- Chicken Tikka Masala — ₹320 — Non-Veg

Orders are stored locally in `data/orders.json`. Payment is offline; staff mark an order `Paid` after collecting payment.
