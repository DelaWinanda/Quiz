import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Mock Data Storage
let sensorData = {
  temp: 24.5,
  humidity: 60.2,
  lastUpdate: new Date().toISOString()
};

let relayStatus = [false, false, false, false];
let telegramLogs: string[] = [];
let sensorHistory: any[] = [];

// Simulate real-time sensor changes
setInterval(() => {
  sensorData.temp = parseFloat((20 + Math.random() * 10).toFixed(1));
  sensorData.humidity = parseFloat((40 + Math.random() * 30).toFixed(1));
  sensorData.lastUpdate = new Date().toISOString();
  
  sensorHistory.push({ ...sensorData });
  if (sensorHistory.length > 50) sensorHistory.shift();
}, 5000);

// Telegram Bot Simulation (or real if TOKEN exists)
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
let bot: TelegramBot | null = null;
let botStatus = "offline";

// Only start bot if token is actually provided and not the placeholder
const isPlaceholderToken = !BOT_TOKEN || BOT_TOKEN === "YOUR_BOT_TOKEN_HERE" || BOT_TOKEN === "MY_BOT_TOKEN";

if (!isPlaceholderToken && BOT_TOKEN) {
  try {
    bot = new TelegramBot(BOT_TOKEN, { 
      polling: {
        autoStart: true,
        params: {
          timeout: 10
        }
      } 
    });
    botStatus = "online";
    console.log("Telegram Bot initialized");

    // Handle polling errors (like 409 Conflict during dev restarts)
    bot.on('polling_error', (error: any) => {
      if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        // This is expected during fast dev restarts in this environment
        botStatus = "online (conflict)";
        console.warn("Telegram polling conflict. Pausing polling for 5s to allow old process to exit...");
        bot?.stopPolling();
        setTimeout(() => {
          if (bot && !bot.isPolling()) {
            bot.startPolling();
          }
        }, 5000);
      } else {
        console.error("Telegram Polling Error:", error);
        botStatus = "error";
      }
    });
    
    bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id;
      const resp = `Smart Home Status:\nTemp: ${sensorData.temp}°C\nHum: ${sensorData.humidity}%\nRelays: ${relayStatus.map((s, i) => `R${i+1}:${s?'ON':'OFF'}`).join(", ")}`;
      bot?.sendMessage(chatId, resp);
      telegramLogs.unshift(`[${new Date().toLocaleTimeString()}] Command /status from ${msg.from?.username}`);
    });

    bot.onText(/\/relay(\d)_(on|off)/, (msg, match) => {
      const chatId = msg.chat.id;
      if (match) {
        const id = parseInt(match[1]) - 1;
        const state = match[2] === "on";
        relayStatus[id] = state;
        bot?.sendMessage(chatId, `Relay ${id+1} is now ${state ? 'ON' : 'OFF'}`);
        telegramLogs.unshift(`[${new Date().toLocaleTimeString()}] Command /relay${id+1}_${match[2]} from ${msg.from?.username}`);
      }
    });
  } catch (e) {
    console.error("Bot failed to start:", e);
    botStatus = "error";
  }
}

// API Routes
app.get("/api/status", (req, res) => {
  res.json({
    esp32: "online",
    backend: "online",
    telegram: botStatus,
    sensor: sensorData,
    relays: relayStatus,
    logs: {
      telegram: telegramLogs.slice(0, 10),
    }
  });
});

app.get("/api/dht", (req, res) => {
  res.json(sensorData);
});

app.get("/api/dht/history", (req, res) => {
  res.json(sensorHistory);
});

app.get("/api/relay/:id/:state", (req, res) => {
  const id = parseInt(req.params.id) - 1;
  const state = req.params.state === "on";
  if (id >= 0 && id < 4) {
    relayStatus[id] = state;
    if (bot && CHAT_ID) {
      bot.sendMessage(CHAT_ID, `Relay ${id + 1} turned ${state ? "ON" : "OFF"} via Dashboard`);
    }
    res.json({ success: true, id: id + 1, state });
  } else {
    res.status(400).json({ error: "Invalid relay ID" });
  }
});

app.get("/api/logs/telegram", (req, res) => {
  res.json(telegramLogs);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down server...");
    if (bot) {
      bot.stopPolling();
      console.log("Telegram bot polling stopped.");
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer();
