// controllers/user.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { User } from "../models/user.model";

export const addUser = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = await User.create(req.body as any);
    return reply.code(201).send({ success: true, data: user });
  } catch (err) {
    return reply.code(400).send({
      success: false,
      message: err || "Failed to create user",
    });
  }
};

export const getUserByEmpId = async (
  req: FastifyRequest<{ Params: { empid: string } }>,
  reply: FastifyReply
) => {
  try {
    const { empid } = req.params;
    const user = await User.findOne({ empid });
    if (!user)
      return reply
        .code(404)
        .send({ success: false, message: "User not found" });
    return reply.send({ success: true, data: user });
  } catch (err) {
    return reply
      .code(500)
      .send({ success: false, message: "Failed to fetch user" });
  }
};

export const getAllUsers = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { department, role, q, limit = 50, page = 1 } = req.query as any;
    const filter: any = {};
    if (department) filter.department = department;
    if (role) filter.role = role;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, "i") },
        { email: new RegExp(q, "i") },
        { empid: new RegExp(q, "i") },
      ];
    }

    const perPage = Math.min(Number(limit) || 50, 200);
    const current = Math.max(Number(page) || 1, 1);

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((current - 1) * perPage)
        .limit(perPage),
      User.countDocuments(filter),
    ]);

    return reply.send({
      success: true,
      data: items,
      meta: {
        total,
        page: current,
        limit: perPage,
        pages: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    return reply
      .code(500)
      .send({ success: false, message: "Failed to fetch users" });
  }
};

/**
 * Partial or full update:
 * Whatever fields you send in body will be updated.
 * Supports both PATCH and PUT.
 */
export const updateUser = async (
  req: FastifyRequest<{ Params: { empid: string } }>,
  reply: FastifyReply
) => {
  try {
    const { empid } = req.params;
    const update = req.body as any;

    // Safety: never allow direct _id changes
    if (update?._id) delete update._id;

    const updated = await User.findOneAndUpdate(
      { empid },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updated)
      return reply
        .code(404)
        .send({ success: false, message: "User not found" });
    return reply.send({ success: true, data: updated });
  } catch (err) {
    return reply.code(400).send({
      success: false,
      message: err || "Failed to update user",
    });
  }
};

export const deleteUser = async (
  req: FastifyRequest<{ Params: { empid: string } }>,
  reply: FastifyReply
) => {
  try {
    const { empid } = req.params;
    const deleted = await User.findOneAndDelete({ empid });
    if (!deleted)
      return reply
        .code(404)
        .send({ success: false, message: "User not found" });
    return reply.send({ success: true, data: deleted });
  } catch (err) {
    return reply
      .code(500)
      .send({ success: false, message: "Failed to delete user" });
  }
};
