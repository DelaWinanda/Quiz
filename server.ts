import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import app from "./api/index.ts"; // Import the Express app logic

const PORT = 3000;

async function startServer() {
  // Use the API app as the base
  const serverApp = express();
  serverApp.use(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    serverApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    serverApp.use(express.static(distPath));
    serverApp.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  serverApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
