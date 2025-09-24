require('dotenv').config();
const express = require("express");
const webpush = require("web-push");
const bodyParser = require("body-parser");
const cors = require("cors");
const fetch = require("node-fetch");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.json());

// ✅ CORS updated for Vercel frontend
app.use(cors({ origin: 'https://reminder-dun.vercel.app' }));

// ----------------- VAPID Keys -----------------
const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

webpush.setVapidDetails(
  "mailto:sahil@example.com",
  publicVapidKey,
  privateVapidKey
);

// ----------------- Subscriptions -----------------
let subscriptions = [];

// ----------------- Subscribe Endpoint -----------------
app.post("/subscribe", (req, res) => {
  const subscription = req.body;
  if (!subscriptions.find(sub => sub.endpoint === subscription.endpoint)) {
    subscriptions.push(subscription);
  }
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

// ----------------- Automatic Notification (Cron 2 hrs) -----------------
cron.schedule("0 */2 * * *", async () => {
  console.log("Generating automatic message with Gemini...");

  const geminiMessage = await getGeminiMessage();

  const payload = JSON.stringify({
    title: "Sahil Reminder",
    body: geminiMessage
  });

  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(err => console.error(err));
  });
});

// ----------------- Gemini API Call -----------------
async function getGeminiMessage() {
  const apiKey = process.env.GEMINI_API_KEY;
  if(!apiKey) return "Hey Saba, ab paani pee lo 💧";

  // Replace below with actual Gemini API call if needed
  // const response = await fetch("GEMINI_API_URL", { headers: { Authorization: `Bearer ${apiKey}` } });
  // const data = await response.json();
  // return data.message;

  return "Hey Saba, ab paani pee lo 💧"; // Temporary mock
}

// ----------------- Health Check -----------------
app.get("/", (req, res) => {
  res.send("Push Notification Backend is running ✅");
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));