import express from "express";
import fetch from "node-fetch";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Verify environment variables
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("ONESIGNAL_APP_ID:", ONESIGNAL_APP_ID);
console.log("ONESIGNAL_API_KEY:", ONESIGNAL_API_KEY ? "Set" : "Missing");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "Set" : "Missing");

if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
  console.error("Error: OneSignal environment variables missing!");
  process.exit(1);
}

// Function to generate message using Gemini AI (with fallback)
async function generateAImessage() {
  const prompt = `
    Create a short, fun, and motivational reminder message
    to drink water. Keep it under 15 words. Make it unique every time.
    Example: "💧 Stay hydrated, your body thanks you!"
  `;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Gemini API Error: ${JSON.stringify(data)}`);
    }
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "💧 Drink some water!";
  } catch (error) {
    console.error("Gemini Error:", error.message);
    // Random fallback messages
    const messages = [
      "💧 Sip some water, stay fresh!",
      "💦 Hydrate now, feel awesome!",
      "💧 Water break time, champ!",
      "💦 Keep calm and drink water!",
      "💧 Refresh with a quick sip!",
      "💦 Water fuels your greatness!"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

// Function to send notification via OneSignal
async function sendNotification() {
  const aiMessage = await generateAImessage();
  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        contents: { en: aiMessage },
        headings: { en: "Water Reminder 💦" },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`OneSignal Error: ${JSON.stringify(data)}`);
    }
    console.log("Notification Sent Successfully:", aiMessage, data);
  } catch (error) {
    console.error("OneSignal Error:", error.message);
  }
}

// Cron job: Every 2 hours from 6 AM to 10 PM IST (UTC: 00:30 to 16:30)
cron.schedule("30 0-16/2 * * *", () => {
  console.log("⏰ Sending automatic AI water reminder...", new Date().toISOString());
  sendNotification();
});

// Ping endpoint to keep server awake (free tier hack)
app.get("/ping", (req, res) => {
  console.log("Ping received - Server awake!");
  res.send("Server is awake and running!");
});

// Manual endpoint for testing notification
app.get("/send", async (req, res) => {
  await sendNotification();
  res.send("Manual AI notification sent!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} at ${new Date().toISOString()}`));