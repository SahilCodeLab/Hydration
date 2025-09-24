require('dotenv').config();
const express = require("express");
const fetch = require("node-fetch");
const cron = require("node-cron");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: 'https://reminder-dun.vercel.app' })); // Your frontend URL

const ONE_SIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// Manual Notification Endpoint
app.post("/send", async (req, res) => {
  const { title, message } = req.body;
  if(!title || !message) return res.status(400).json({ error: "Title & message required" });

  await sendOneSignalNotification(title, message);
  res.json({ message: "Notification sent!" });
});

// Automatic Notification (every 2 hours)
cron.schedule("0 */2 * * *", async () => {
  await sendOneSignalNotification("Hydration Reminder", "Hey Saba, ab paani pee lo 💧");
});

// Function to send OneSignal notification
async function sendOneSignalNotification(title, message) {
  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONE_SIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONE_SIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { "en": title },
        contents: { "en": message }
      })
    });
    console.log("Notification sent:", title);
  } catch(err) {
    console.error("OneSignal Error:", err);
  }
}

// Health Check
app.get("/", (req, res) => res.send("OneSignal backend running ✅"));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));