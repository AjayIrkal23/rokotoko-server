// auth/jwt.ts
import jwt from "jsonwebtoken";
import { FastifyRequest, FastifyReply } from "fastify";
import { IUser, User } from "../models/user.model";

const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

export type JWTPayload = {
  sub: string; // user _id
  email: string;
  role: "admin" | "user";
  iat?: number; // issued at
};

export async function issueUserJWT(user: IUser) {
  const payload: JWTPayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  // 🚫 No expiry — permanent token until revoked
  const token = jwt.sign(payload, JWT_SECRET);

  user.jwtoken = token;
  user.jwtokenIssuedAt = new Date();
  await user.save();

  return token;
}

export async function revokeUserJWT(userId: string) {
  await User.updateOne(
    { _id: userId },
    { $unset: { jwtoken: "", jwtokenIssuedAt: "" } }
  );
}

// Fastify request typing
declare module "fastify" {
  interface FastifyRequest {
    user?: JWTPayload & { dbUser?: IUser };
  }
}

// Middleware (preHandler) for protected routes
export const verifyJWT = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) throw new Error("No token provided");

    const token = authHeader.slice("Bearer ".length).trim();
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Confirm stored token matches (revocation check)
    const user = await User.findOne({ _id: payload.sub }).select("+jwtoken");

    if (!user || user.jwtoken !== token) {
      throw new Error("Token is revoked");
    }

    req.user = { ...payload, dbUser: user as IUser };
  } catch (_err) {
    return reply.status(401).send({
      success: false,
      expired: true,
      message: "Unauthorized or session revoked",
    });
  }
};
