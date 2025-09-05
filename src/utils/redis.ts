import { Redis } from "ioredis";
import { config } from "../config/env";

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // ✅ Required for BullMQ compatibility
  enableReadyCheck: false, // Optional for faster startup
  reconnectOnError: (err) => {
    const targetErrors = ["READONLY", "ECONNRESET"];
    const shouldReconnect = targetErrors.some((code) =>
      err.message.includes(code)
    );
    if (shouldReconnect) {
      console.warn("🔁 Reconnecting Redis due to error:", err.message);
      return true;
    }
    return false;
  },
});
