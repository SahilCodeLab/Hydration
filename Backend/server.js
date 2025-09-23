const express = require("express");
const webpush = require("web-push");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ----------------- VAPID Keys -----------------
// Render me Environment Variables se bhi rakh sakte ho
const publicVapidKey = process.env.PUBLIC_VAPID_KEY || "APNA_PUBLIC_KEY_YAHA";
const privateVapidKey = process.env.PRIVATE_VAPID_KEY || "APNA_PRIVATE_KEY_YAHA";

webpush.setVapidDetails(
  "mailto:sahil@example.com",
  publicVapidKey,
  privateVapidKey
);

// ----------------- Subscriptions -----------------
let subscriptions = [];

// ----------------- Save Subscription -----------------
app.post("/subscribe", (req, res) => {
  const subscription = req.body;

  // Duplicate subscription check
  const exists = subscriptions.find(sub => sub.endpoint === subscription.endpoint);
  if (!exists) subscriptions.push(subscription);

  res.status(201).json({ message: "Subscribed!" });
});

// ----------------- Manual Notification -----------------
app.post("/send", (req, res) => {
  const { title, message } = req.body;

  if (!title || !message) return res.status(400).json({ error: "Title and message required" });

  const payload = JSON.stringify({ title, body: message });

  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(err));
  });

  res.json({ message: "Notification sent to all subscribers!" });
});

// ----------------- Check Server -----------------
app.get("/", (req, res) => {
  res.send("Push Notification Backend is running ✅");
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
