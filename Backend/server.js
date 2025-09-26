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
  "https://i.imgur.com/8bF5z3J.jpg", // Resized Pinterest glass (example, replace with actual)
  "https://i.imgur.com/4k3xY7m.jpg", // Resized Pixabay glass
  "https://i.imgur.com/9pQzW2n.jpg", // Resized beverages
  "https://i.imgur.com/7vT8jRt.jpg", // Resized bottle
  "https://i.imgur.com/2mNhK6P.jpg", // Resized hands
  "https://i.imgur.com/5xL9fQw.jpg", // Resized lemon glass
  "https://i.imgur.com/3jB8vZp.jpg", // Resized bubbles
  "https://i.imgur.com/6yR2mKd.jpg", // Resized splash 1
  "https://i.imgur.com/9tF3nXw.jpg", // Resized splash 2
  "https://i.imgur.com/1hP4k9L.jpg", // Resized bell peppers
];

// Function to get a random image URL
function getRandomImage() {
  return imageUrls[Math.floor(Math.random() * imageUrls.length)];
}

// ----------------- AI Message Generator -----------------
async function generateAImessage() {
  const prompt = `
    Generate a fun, motivational one-line reminder to drink water, under 10 words.
    Use emojis and keep it unique, casual, friendly.
    Example: "💧 Sip water, stay awesome! 😎"
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
    
    // Ensure the message is one line and under 10 words
    message = message.trim().split('\n')[0];
    const wordCount = message.split(' ').length;
    if (wordCount > 10 || message.includes("Option")) {
      console.warn("⚠️ Gemini returned invalid message, using fallback.");
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
    "💦 Quick hydration break time!",
    "💧 Drink up, shine on! ✨",
    "💦 Hydrate now, feel great! 🚀",
    "💧 Take a sip, you rock! 😊",
  ];
  return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
}

// ----------------- Send Notification -----------------
async function sendNotification() {
  const aiMessage = await generateAImessage();
  const randomImage = getRandomImage();

  try {
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      included_segments: ["All"],
      headings: { en: "Water Reminder 💦" },
      contents: { en: aiMessage },
    };

    // Only add big_picture if image URL is valid
    try {
      const imageResponse = await fetch(randomImage, { method: "HEAD" });
      if (imageResponse.ok) {
        payload.big_picture = randomImage;
      } else {
        console.warn(`⚠️ Image URL invalid: ${randomImage}`);
      }
    } catch (error) {
      console.warn(`⚠️ Image check failed: ${randomImage}, skipping image.`);
    }

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("OneSignal Full Response:", data);

    if (!response.ok) {
      throw new Error(`OneSignal Error: ${JSON.stringify(data)}`);
    }

    console.log("✅ Notification Sent Successfully:", aiMessage, "with image:", randomImage || "none");
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