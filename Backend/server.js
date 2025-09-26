import express from "express";
import fetch from "node-fetch";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// ----------------- ENV Variables -----------------
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("ONESIGNAL_APP_ID:", ONESIGNAL_APP_ID);
console.log("ONESIGNAL_API_KEY:", ONESIGNAL_API_KEY ? "Set" : "Missing");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "Set" : "Missing");

if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
  console.error("❌ Error: OneSignal environment variables missing!");
  process.exit(1);
}

// ----------------- AI Message Generator -----------------
async function generateAImessage() {
  const prompt = `
    Generate a fun, motivational one-line reminder to drink water, under 15 words.
    Use emojis and keep it unique, casual, and friendly.
    Example: "💧 Sip some water, stay awesome!"
  `;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
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

    let message = data?.candidates?.[0]?.content?.parts?.[0]?.text || "💧 Drink some water!";
    
    // Ensure the message is one line and under 15 words
    message = message.trim().split('\n')[0]; // Take only the first line
    const wordCount = message.split(' ').length;
    if (wordCount > 15) {
      console.warn("⚠️ Gemini returned a long message, using fallback instead.");
      return getFallbackMessage();
    }

    return message;
  } catch (error) {
    console.error("Gemini Error:", error.message);
    return getFallbackMessage();
  }
}

// Fallback message generator
function getFallbackMessage() {
  const fallbackMessages = [
    "💧 Sip water, stay cool! 😎",
    "💦 Time for a quick hydration break!",
    "💧 Drink up, keep shining! ✨",
    "💦 Hydrate now, feel great! 🚀",
    "💧 Take a sip, you're awesome! 😊",
  ];
  return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
}

// ----------------- Send Notification -----------------
async function sendNotification() {
  const aiMessage = await generateAImessage();

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: "Water Reminder 💦" },
        contents: { en: aiMessage },
      }),
    });

    const data = await response.json();
    console.log("OneSignal Full Response:", data);

    if (!response.ok) {
      throw new Error(`OneSignal Error: ${JSON.stringify(data)}`);
    }

    console.log("✅ Notification Sent Successfully:", aiMessage);
  } catch (error) {
    console.error("❌ OneSignal Error:", error.message);
  }
}

// ----------------- Send Test Notification on Server Start -----------------
(async () => {
  console.log("🚀 Server live, sending initial test push notification...");
  await sendNotification();
})();

// ----------------- Cron Job -----------------
// Every 2 hours from 6:30 AM to 10:30 PM IST (1:00 to 17:00 UTC)
cron.schedule("30 1-17/2 * * *", () => {
  console.log("⏰ Cron Triggered (IST) ->", new Date().toISOString());
  sendNotification();
});

// ----------------- Endpoints -----------------
app.get("/ping", (req, res) => {
  console.log("Ping received - Server awake!");
  res.send("Server is awake and running!");
});

app.get("/send", async (req, res) => {
  await sendNotification();
  res.send("Manual AI notification sent!");
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} at ${new Date().toISOString()}`)
);