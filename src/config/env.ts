import dotenv from "dotenv";
dotenv.config();

export const config = {
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },
  dbUri: process.env.MONGO_URI || "mongodb://localhost:27017/rokotoko",
  port: Number(process.env.PORT || 3000),
  JWT_SEC: process.env.JWT_SECRET,
};
