import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes.js";
import { initDb } from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4000);

const start = async () => {
  await initDb();

  app.use(cors({ origin: true, credentials: true }));
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(morgan("dev"));

  // Serve uploaded images
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  app.use("/api", router);

  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
};

start();
