import express from "express";
import fetch from "node-fetch";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();
const app = express();

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Function to generate message using Gemini AI
async function generateAImessage() {
  const prompt = `
  Create a short, fun, and motivational reminder message
  to drink water. Keep it under 15 words. Make it unique every time.
  Example: "💧 Stay hydrated, your body thanks you!"
  `;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-latest:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "💧 Drink some water!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "💧 Time for a water break!";
  }
}

// Function to send notification via OneSignal
async function sendNotification() {
  const aiMessage = await generateAImessage();

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      contents: { en: aiMessage },
      headings: { en: "Water Reminder 💦" },
    }),
  });

  const data = await response.json();
  console.log("Notification Sent:", aiMessage, data);
}

// Run every 2 hours automatically
cron.schedule("*/2 * * * *", () => {
  console.log("⏰ Sending automatic AI water reminder...");
  sendNotification();
});

// Manual endpoint for testing
app.get("/send", async (req, res) => {
  await sendNotification();
  res.send("Manual AI notification sent!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));