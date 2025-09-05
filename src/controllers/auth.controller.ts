// controllers/auth.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { sendOtpEmail } from "helpers/mj";
import { User } from "models/user.model";
import { issueUserJWT, revokeUserJWT } from "plugins/auth.middleware";

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5);
const MASTER_OTP = process.env.MASTER_OTP || "000000"; // dev override to match your dummy thunk

function generateOtp(len = 6) {
  const min = Math.pow(10, len - 1);
  const max = Math.pow(10, len) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * POST /auth/send-otp
 * body: { empid: string }
 */
export const sendOtp = async (
  req: FastifyRequest<{ Body: { empid: string } }>,
  reply: FastifyReply
) => {
  try {
    const { empid } = req.body || {};
    if (!empid) {
      return reply
        .code(400)
        .send({ success: false, message: "empid is required" });
    }

    console.log(empid);

    const user = await User.findOne({ empid });
    if (!user) {
      // avoid user enumeration if you prefer a generic message here
      return reply
        .code(404)
        .send({ success: false, message: "User not found" });
    }

    // ✅ allow only admin accounts to request OTP / login
    if (user.role !== "admin") {
      return reply.code(403).send({
        success: false,
        message: "Only admin accounts are allowed to log in.",
      });
    }

    if (!user.email) {
      return reply.code(400).send({
        success: false,
        message: "User has no email on file",
      });
    }

    // Generate + store OTP
    const code = generateOtp(6);
    const expiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    user.otp = code;
    user.otpExpiry = expiry;
    await user.save();

    // Send email via Mailjet
    await sendOtpEmail({
      toEmail: user.email,
      toName: user.name || user.empid,
      otp: code,
      fromEmail: process.env.MJ_FROM_EMAIL || "rokotoko@docketrun.com",
      fromName: process.env.MJ_FROM_NAME || "Roko Toko Info",
      subject: "Your Roko Toko verification code",
    });

    const exposeOtp = process.env.EXPOSE_OTP === "true"; // dev-only echo
    return reply.send({
      success: true,
      message: "OTP sent to email",
      ...(exposeOtp ? { devOtp: code } : {}),
    });
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({
      success: false,
      message: (err as Error)?.message || "Failed to send OTP",
    });
  }
};

/**
 * POST /auth/send-otp
 * body: { empid: string }
 */
export const sendOtpUser = async (
  req: FastifyRequest<{ Body: { empid: string } }>,
  reply: FastifyReply
) => {
  try {
    const { empid } = req.body || {};
    if (!empid) {
      return reply
        .code(400)
        .send({ success: false, message: "empid is required" });
    }

    const user = await User.findOne({ empid });
    if (!user) {
      // avoid user enumeration if you prefer a generic message here
      return reply
        .code(404)
        .send({ success: false, message: "User not found" });
    }

    // ✅ allow only admin accounts to request OTP / login
    if (user.role !== "user") {
      return reply.code(403).send({
        success: false,
        message: "Only admin accounts are allowed to log in.",
      });
    }

    if (!user.email) {
      return reply.code(400).send({
        success: false,
        message: "User has no email on file",
      });
    }

    // Generate + store OTP
    const code = generateOtp(6);
    const expiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    user.otp = code;
    user.otpExpiry = expiry;
    await user.save();

    // Send email via Mailjet
    await sendOtpEmail({
      toEmail: user.email,
      toName: user.name || user.empid,
      otp: code,
      fromEmail: process.env.MJ_FROM_EMAIL || "rokotoko@docketrun.com",
      fromName: process.env.MJ_FROM_NAME || "Roko Toko Info",
      subject: "Your Roko Toko verification code",
    });

    const exposeOtp = process.env.EXPOSE_OTP === "true"; // dev-only echo
    return reply.send({
      success: true,
      message: "OTP sent to email",
      ...(exposeOtp ? { devOtp: code } : {}),
    });
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({
      success: false,
      message: (err as Error)?.message || "Failed to send OTP",
    });
  }
};

/**
 * POST /auth/verify-otp
 * body: { empid: string, otp: string }
 * On success: clears OTP, issues JWT (no expiry), returns { token, user }
 */
export const verifyOtp = async (
  req: FastifyRequest<{ Body: { empid: string; otp: string } }>,
  reply: FastifyReply
) => {
  try {
    const { empid, otp } = req.body || {};
    if (!empid || !otp) {
      return reply
        .code(400)
        .send({ success: false, message: "empid and otp are required" });
    }

    const user = await User.findOne({ empid }).select("+otp +otpExpiry");
    if (!user || !user.otp || !user.otpExpiry) {
      return reply
        .code(400)
        .send({ success: false, message: "OTP not initialized" });
    }

    const isMaster = otp === MASTER_OTP;
    const isValid =
      (user.otp === otp || isMaster) && user.otpExpiry > new Date();

    if (!isValid) {
      return reply
        .code(401)
        .send({ success: false, message: "Invalid or expired OTP" });
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Issue JWT (no expiry)
    const token = await issueUserJWT(user);

    // Return safe user (otp fields are not selected anymore)
    const safeUser = await User.findById(user._id);

    return reply.send({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err) {
    return reply.code(500).send({
      success: false,
      message: err || "Failed to verify OTP",
    });
  }
};

/**
 * GET /auth/me
 * header: Authorization: Bearer <token>
 */
export const me = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // verifyJWT as preHandler populates req.user
    const user = (req as any).user?.dbUser;
    if (!user) {
      return reply.code(401).send({ success: false, message: "Unauthorized" });
    }
    return reply.send({ success: true, user });
  } catch (err) {
    return reply
      .code(500)
      .send({ success: false, message: "Failed to get user" });
  }
};

/**
 * POST /auth/logout
 * header: Authorization: Bearer <token>
 */
export const logout = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const sub = (req as any).user?.sub as string | undefined;
    if (!sub) {
      return reply.code(401).send({ success: false, message: "Unauthorized" });
    }
    await revokeUserJWT(sub);
    return reply.send({ success: true });
  } catch (err) {
    return reply
      .code(500)
      .send({ success: false, message: "Failed to logout" });
  }
};
