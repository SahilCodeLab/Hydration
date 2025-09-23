const express = require("express");
const webpush = require("web-push");
const bodyParser = require("body-parser");
const cors = require("cors");
const fetch = require("node-fetch");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ----------------- VAPID Keys -----------------
const publicVapidKey = process.env.PUBLIC_VAPID_KEY || "APNA_PUBLIC_KEY_YAHA";
const privateVapidKey = process.env.PRIVATE_VAPID_KEY || "APNA_PRIVATE_KEY_YAHA";

webpush.setVapidDetails(
  "mailto:sahil@example.com",
  publicVapidKey,
  privateVapidKey
);

// ----------------- Subscriptions Store -----------------
let subscriptions = [];

// ----------------- Save Subscription -----------------
app.post("/subscribe", (req, res) => {
  const subscription = req.body;

  // Duplicate check
  const exists = subscriptions.find(sub => sub.endpoint === subscription.endpoint);
  if (!exists) subscriptions.push(subscription);

  res.status(201).json({ message: "Subscribed!" });
});

// ----------------- Manual Notification -----------------
app.post("/send", async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ error: "Title & message required" });

  const payload = JSON.stringify({ title, body: message });

  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(err));
  });

  res.json({ message: "Notification sent to all subscribers!" });
});

// ----------------- Automatic Notification (2 hrs) -----------------
cron.schedule("0 */2 * * *", async () => {
  console.log("Generating automatic message with Gemini...");

  // Gemini API call - replace with your actual API setup
  const geminiMessage = await getGeminiMessage();

  const payload = JSON.stringify({
    title: "Sahil Reminder",
    body: geminiMessage
  });

  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(err));
  });
});

// ----------------- Gemini API Call (Mock) -----------------
async function getGeminiMessage() {
  // Tum apni Gemini 2.0 Flash API call yaha karoge
  // Filhal simple mock message
  return "Hey Saba, ab paani pee lo 💧";
}

// ----------------- Health Check -----------------
app.get("/", (req, res) => {
  res.send("Push Notification Backend is running ✅");
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
