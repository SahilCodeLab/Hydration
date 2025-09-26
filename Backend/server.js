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

// ----------------- Image URLs for Notifications -----------------
const imageUrls = [
  "https://i.pinimg.com/736x/f9/fa/4b/f9fa4b939654d5c742d5b2fc32e1e628.jpg", // Glass with bubbles
  "https://cdn.pixabay.com/photo/2016/02/18/06/57/glass-1206584_1280.jpg", // Clear glass
  "https://cdn.pixabay.com/photo/2017/11/03/14/32/beverages-2914497_1280.jpg", // Glasses with ice
  "https://cdn.pixabay.com/photo/2017/02/02/15/15/bottle-2032980_1280.jpg", // Water bottle
  "https://cdn.pixabay.com/photo/2020/03/05/00/13/hands-4903050_1280.jpg", // Hands with glass
  "https://cdn.pixabay.com/photo/2022/07/06/16/02/glass-of-water-7305460_1280.jpg", // Glass with lemon
  "https://cdn.pixabay.com/photo/2021/12/02/17/50/bubbles-6841040_1280.jpg", // Water bubbles
  "https://cdn.pixabay.com/photo/2013/07/19/00/18/splashing-165192_1280.jpg", // Water splash 1
  "https://cdn.pixabay.com/photo/2014/02/27/16/08/splashing-275950_1280.jpg", // Water splash 2
  "https://cdn.pixabay.com/photo/2016/04/02/04/14/bell-peppers-1302126_1280.jpg", // Bell peppers
];

// Function to get a random image URL
function getRandomImage() {
  return imageUrls[Math.floor(Math.random() * imageUrls.length)];
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
  const randomImage = getRandomImage(); // Get a random image URL

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
        big_picture: randomImage, // Include random image
      }),
    });

    const data = await response.json();
    console.log("OneSignal Full Response:", data);

    if (!response.ok) {
      throw new Error(`OneSignal Error: ${JSON.stringify(data)}`);
    }

    console.log("✅ Notification Sent Successfully:", aiMessage, "with image:", randomImage);
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
  res.send("Manual AI notification sent with image!");
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} at ${new Date().toISOString()}`)
);