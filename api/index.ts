import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// State (Note: Global variables in Vercel reset frequently. This is common for IoT prototypes)
let sensorData = {
  temp: 24.5,
  humidity: 60.2,
  lastUpdate: new Date().toISOString()
};

let relayStatus = [false, false, false, false];
let telegramLogs: string[] = [];
let sensorHistory: any[] = [];

// Telegram Bot Logic
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
let bot: TelegramBot | null = null;
let botStatus = "offline";

const isPlaceholderToken = !BOT_TOKEN || BOT_TOKEN === "YOUR_BOT_TOKEN_HERE" || BOT_TOKEN === "MY_BOT_TOKEN";

if (!isPlaceholderToken && BOT_TOKEN) {
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    botStatus = "online";
    
    bot.onText(/\/status/, (msg) => {
      const resp = `Smart Home Status:\nTemp: ${sensorData.temp}°C\nHum: ${sensorData.humidity}%\nRelays: ${relayStatus.map((s, i) => `R${i+1}:${s?'ON':'OFF'}`).join(", ")}`;
      bot?.sendMessage(msg.chat.id, resp);
      telegramLogs.unshift(`[${new Date().toLocaleTimeString()}] Command /status from ${msg.from?.username}`);
    });

    bot.on('polling_error', (error: any) => {
        if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
          botStatus = "online (conflict)";
        }
    });
  } catch (e) {
    botStatus = "error";
  }
}

// API Endpoints
app.get("/api/status", (req, res) => {
  res.json({
    esp32: "online",
    backend: "online",
    telegram: botStatus,
    sensor: sensorData,
    relays: relayStatus,
    logs: { telegram: telegramLogs.slice(0, 10) }
  });
});

app.get("/api/dht", (req, res) => res.json(sensorData));

app.get("/api/relay/:id/:state", (req, res) => {
  const id = parseInt(req.params.id) - 1;
  const state = req.params.state === "on";
  if (id >= 0 && id < 4) {
    relayStatus[id] = state;
    if (bot && CHAT_ID) {
      bot.sendMessage(CHAT_ID, `Relay ${id + 1} turned ${state ? "ON" : "OFF"} via Dashboard`);
    }
    telegramLogs.unshift(`[${new Date().toLocaleTimeString()}] Relay ${id+1} ${req.params.state} via Web`);
    res.json({ success: true, id: id + 1, state });
  } else {
    res.status(400).json({ error: "Invalid relay ID" });
  }
});

app.get("/api/dht/history", (req, res) => res.json(sensorHistory));

// Endpoint for ESP32 to push data
app.post("/api/update", (req, res) => {
    const { temp, humidity } = req.body;
    if (temp !== undefined && humidity !== undefined) {
        sensorData = { temp, humidity, lastUpdate: new Date().toISOString() };
        sensorHistory.push({ ...sensorData });
        if (sensorHistory.length > 50) sensorHistory.shift();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Missing data" });
    }
});

export default app;
