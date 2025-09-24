require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fetch = require("node-fetch");
const cron = require("node-cron");

const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: "https://reminder-dun.vercel.app" // frontend ka live URL
}));

// ----------------- OneSignal Config -----------------
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// ----------------- Manual Notification -----------------
app.post("/send", async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ error: "Title and message are required" });

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        contents: { en: message },
        headings: { en: title }
      })
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// ----------------- Automatic Notification (Every 2 hours) -----------------
cron.schedule("0 */2 * * *", async () => {
  console.log("Sending automatic reminder every 2 hours...");

  try {
    await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        contents: { en: "Hey Saba 💧 Time to drink water!" },
        headings: { en: "Hydration Reminder" }
      })
    });

    console.log("Automatic notification sent successfully ✅");
  } catch (error) {
    console.error("Auto notification error:", error);
  }
});

// ----------------- Health Check -----------------
app.get("/", (req, res) => {
  res.send("OneSignal Push Notification Backend is running ✅");
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));