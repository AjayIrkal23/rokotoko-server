// routes/auth.route.ts
import { FastifyInstance } from "fastify";
import {
  sendOtp,
  verifyOtp,
  me,
  logout,
  sendOtpUser,
} from "../controllers/auth.controller";
import { verifyJWT } from "plugins/auth.middleware";

export default async function authRoutes(fastify: FastifyInstance) {
  // Public
  fastify.post("/auth/send-otp", sendOtp); // admin only
  fastify.post("/auth/send-otp-user", sendOtpUser); //user only

  fastify.post("/auth/verify-otp", verifyOtp);

  // Protected
  fastify.get("/auth/me", { preHandler: verifyJWT }, me);
  fastify.post("/auth/logout", { preHandler: verifyJWT }, logout);
}
