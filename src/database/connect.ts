import mongoose from "mongoose";
import { config } from "../config/env";

export const connectDB = async () => {
  try {
    await mongoose.connect(config.dbUri, {
      dbName: "rokotoko",
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};
