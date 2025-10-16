import express from "express";
import fetch from "node-fetch";
import cron from "node-cron";
import dotenv from "dotenv";
import path from "path";
import cors from "cors"; 

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve subscribe.html
app.use(cors({ origin: "https://yourusername.github.io" })); // Replace with your GitHub Pages URL

// ----------------- ENV Variables -----------------
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("ONESIGNAL_APP_ID:", ONESIGNAL_APP_ID);
console.log("ONESIGNAL_API_KEY:", ONESIGNAL_API_KEY ? "Set" : "Missing");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "Set" : "Missing");

if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY || !GEMINI_API_KEY) {
  console.error("❌ Error: Missing environment variables!");
  process.exit(1);
}

// ----------------- Stock Images -----------------
const imageUrls = [
  "https://cdn.pixabay.com/photo/2022/07/06/16/02/glass-of-water-7305460_1280.jpg",
  "https://cdn.pixabay.com/photo/2013/07/19/00/18/splashing-165192_1280.jpg",
  "https://cdn.pixabay.com/photo/2021/12/02/17/50/bubbles-6841040_1280.jpg",
  "https://cdn.pixabay.com/photo/2017/02/02/15/15/bottle-2032980_1280.jpg",
  "https://cdn.pixabay.com/photo/2020/03/05/00/13/hands-4903050_1280.jpg",
  "https://cdn.pixabay.com/photo/2016/11/29/12/30/drop-1869275_1280.jpg",
  "https://cdn.pixabay.com/photo/2018/09/23/09/31/water-3696787_1280.jpg",
  "https://cdn.pixabay.com/photo/2016/11/29/09/27/water-1868534_1280.jpg",
];
async function getRandomImage() {
  const url = imageUrls[Math.floor(Math.random() * imageUrls.length)];
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.ok) return url;
    console.warn(`⚠️ Image URL invalid: ${url}, using fallback`);
    return "https://cdn.pixabay.com/photo/2022/07/06/16/02/glass-of-water-7305460_1280.jpg";
  } catch (error) {
    console.error("❌ Image validation error:", error.message);
    return "https://cdn.pixabay.com/photo/2022/07/06/16/02/glass-of-water-7305460_1280.jpg";
  }
}

// ----------------- Fetch Subscribed Users from OneSignal -----------------
async function fetchSubscribedUsers() {
  try {
    const response = await fetch(`https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=300`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`OneSignal API Error: ${JSON.stringify(data)}`);
    }
    return data.players
      .filter(player => player.is_active !== false) // Only active users
      .map(player => ({
        player_id: player.id,
        name: player.tags?.name || null,
        streak: player.tags?.streak ? parseInt(player.tags.streak) : 0,
      }));
  } catch (error) {
    console.error("❌ Error fetching OneSignal users:", error.message);
    return [];
  }
}

// ----------------- Update Streak in OneSignal -----------------
async function updateUserStreak(player_id, streak) {
  try {
    await fetch(`https://onesignal.com/api/v1/players/${player_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        tags: { streak: streak.toString() },
      }),
    });
    console.log(`✅ Updated streak for ${player_id}: ${streak}`);
  } catch (error) {
    console.error(`❌ Error updating streak for ${player_id}:`, error.message);
  }
}

// ----------------- AI Message Generator -----------------
async function generateAImessage() {
  const prompt = `
    Generate a casual, fun water reminder in Romanized Hindi, 5-10 words.
    Use [name] placeholder, vibe: funny/motivational/chill, add emoji.
    Examples:
    - Hey [name], ek sip toh banta hai! 💧
    - [name], pani pi lo, din shine kare! 😎
    - Hey [name], chill karo aur sip lo! 💦
    Avoid: "arre", "yo", "maza", "double", "must", "now".
    Return only: Hey [name], <message> 💧
  `;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    console.log("Gemini Response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${JSON.stringify(data)}`);
    }

    let message = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Hey [name], pani pi lo! 💧";
    message = message.trim().split('\n')[0];
    const wordCount = message.split(' ').length;
    if (wordCount > 10 || !message.includes("[name]")) {
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
    "Hey [name], ek glass pani pi lo! 💧",
    "Hey [name], sip karo, fresh raho! 😎",
    "Hey [name], pani ka time hai! 💦",
    "Hey [name], ek sip toh banta hai! 🚰",
    "Hey [name], hydrate karo, shine karo! ✨",
  ];
  return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
}

// ----------------- Send Notification -----------------
async function sendNotification(customMessage = null, targetPlayerIds = null) {
  const users = await fetchSubscribedUsers();

  if (users.length === 0) {
    console.warn("⚠️ No users found, skipping notification.");
    return;
  }

  const message = customMessage || (await generateAImessage());
  const targetUsers = targetPlayerIds ? users.filter(u => targetPlayerIds.includes(u.player_id)) : users;

  for (const user of targetUsers) {
    const userMessage = user.name ? message.replace("[name]", user.name) : "Pani ka time hai! 💧";
    const streakMessage = user.streak > 0 ? ` ${user.streak} din ka streak!` : "";
    try {
      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: [user.player_id],
          headings: { en: "Pani Piyo Buddy 💦" },
          contents: { en: `${userMessage}${streakMessage}` },
          big_picture: await getRandomImage(),
        }),
      });

      const data = await response.json();
      console.log(`OneSignal Response for ${user.name || user.player_id}:`, data);

      if (!response.ok) {
        throw new Error(`OneSignal Error for ${user.name || user.player_id}: ${JSON.stringify(data)}`);
      }

      // Update streak
      await updateUserStreak(user.player_id, user.streak + 1);
      console.log(`✅ Notification Sent: ${userMessage}${streakMessage}`);
    } catch (error) {
      console.error(`❌ OneSignal Error for ${user.name || user.player_id}:`, error.message);
    }
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

app.get("/users", async (req, res) => {
  const users = await fetchSubscribedUsers();
  const userNames = users.filter(u => u.name).map(u => u.name);
  res.json({ users: ["All", ...userNames] });
});

app.get("/status", async (req, res) => {
  const users = await fetchSubscribedUsers();
  res.json({ users: users.map(u => ({ name: u.name || u.player_id, streak: u.streak })) });
});

app.get("/manual", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manual.html')); // For testing on Render
});

app.post("/manual-send", async (req, res) => {
  const { message, target } = req.body;
  const users = await fetchSubscribedUsers();

  if (!message) {
    return res.status(400).json({ error: "Message is required!" });
  }

  if (target === "All") {
    await sendNotification(message);
    res.json({ message: "Notification sent to all users!" });
  } else {
    const user = users.find(u => u.name === target);
    if (!user) {
      return res.status(400).json({ error: "User not found!" });
    }
    await sendNotification(message, [user.player_id]);
    res.json({ message: `Notification sent to ${target}!` });
  }
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} at ${new Date().toISOString()}`)
);