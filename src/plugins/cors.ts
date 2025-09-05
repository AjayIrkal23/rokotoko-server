// plugins/cors.ts
import fp from "fastify-plugin";
import cors from "@fastify/cors";

const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:8081", // Vite dev
  process.env.FRONTEND_ORIGIN || "", // e.g. https://app.example.com
].filter(Boolean);

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allows curl/postman
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error("CORS not allowed"), false);
    },
    credentials: true, // ⬅️ enable credentials
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  });
});
