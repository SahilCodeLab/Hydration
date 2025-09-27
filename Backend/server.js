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
app.use(cors({ origin: "https://username.github.io" })); // Replace with your GitHub Pages URL

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
];
function getRandomImage() {
  return imageUrls[Math.floor(Math.random() * imageUrls.length)];
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
    return data.players.map(player => ({
      player_id: player.id,
      name: player.tags && player.tags.name ? player.tags.name : null,
    }));
  } catch (error) {
    console.error("❌ Error fetching OneSignal users:", error.message);
    return [];
  }
}

// ----------------- AI Message Generator -----------------
async function generateAImessage() {
  const prompt = `
    Generate a professional, non-irritating water reminder in Romanized Hindi, Flipkart-style.
    Return only in this format:
    Heading: [name], pani ka time!
    Content: Ek glass se din ko taze rakho! 💧
    Keep heading short (3-5 words with placeholder [name]), content under 15 words, fun, polished, no name in content, sync with heading.
    Avoid: "arre", "yo", "maza", "double", "must", "now".
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
    console.log("Gemini Response:", JSON.stringify(data, null, 2)); // Debug log

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${JSON.stringify(data)}`);
    }

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let heading = text.match(/Heading: \[name\], (.+)/)?.[1] || "pani ka time!";
    let content = text.match(/Content: (.+)/)?.[1] || "Ek glass se din ko taze rakho! 💧";

    // Ensure content is one line, under 15 words, no name
    heading = heading.trim().split('\n')[0];
    content = content.trim().split('\n')[0];
    const wordCount = content.split(' ').length;
    if (wordCount > 15 || content.includes("[name]") || heading.includes("Option")) {
      console.warn("⚠️ Gemini returned invalid message, using fallback.");
      return getFallbackMessage();
    }

    return { heading, content };
  } catch (error) {
    console.error("Gemini Error:", error.message);
    return getFallbackMessage();
  }
}

// Fallback message generator
function getFallbackMessage() {
  const fallbackMessages = [
    { heading: "pani ka time!", content: "Ek glass se din ko taze rakho! 💧" },
    { heading: "sip karo ab!", content: "Ek sip se din ki energy ko boost karo! 💦" },
    { heading: "pani pi lo!", content: "Ek glass se din ko sundar banao! 💧" },
  ];
  return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
}

// ----------------- Send Notification -----------------
async function sendNotification(heading = null, content = null, targetPlayerIds = null) {
  const users = await fetchSubscribedUsers();

  if (users.length === 0) {
    console.warn("⚠️ No users found, skipping notification.");
    return;
  }

  // Filter users if specific player IDs provided
  const targetUsers = targetPlayerIds ? users.filter(u => targetPlayerIds.includes(u.player_id)) : users;

  // Generate message if not provided (for cron/initial)
  const message = heading && content ? { heading, content } : await generateAImessage();

  // Send notification to each user
  for (const user of targetUsers) {
    const userHeading = user.name ? `${user.name}, ${message.heading}` : message.heading;
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
          headings: { en: userHeading },
          contents: { en: message.content },
          big_picture: getRandomImage(),
        }),
      });

      const data = await response.json();
      console.log(`OneSignal Response for ${user.name || user.player_id}:`, data);

      if (!response.ok) {
        throw new Error(`OneSignal Error for ${user.name || user.player_id}: ${JSON.stringify(data)}`);
      }

      console.log(`✅ Notification Sent: ${userHeading} - ${message.content}`);
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

app.get("/manual", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manual.html')); // For testing on Render
});

app.post("/manual-send", async (req, res) => {
  const { heading, content, target } = req.body;
  const users = await fetchSubscribedUsers();

  if (!heading || !content) {
    return res.status(400).json({ error: "Heading and content are required!" });
  }

  if (target === "All") {
    await sendNotification(heading, content);
    res.json({ message: "Notification sent to all users!" });
  } else {
    const user = users.find(u => u.name === target);
    if (!user) {
      return res.status(400).json({ error: "User not found!" });
    }
    await sendNotification(heading, content, [user.player_id]);
    res.json({ message: `Notification sent to ${target}!` });
  }
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} at ${new Date().toISOString()}`)
);