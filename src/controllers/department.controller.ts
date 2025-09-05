// controllers/department.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import { Department } from "models/department.model";

// Create
export const createDepartment = async (
  req: FastifyRequest<{
    Body: {
      name: string;
      description: string;
      headName: string;
      headEmail: string;
      employeeCount?: number;
      validatedImages?: number;
      averageScore?: number;
    };
  }>,
  reply: FastifyReply
) => {
  try {
    const body = req.body;
    const doc = await Department.create({
      ...body,
      employeeCount: body.employeeCount ?? 0,
      validatedImages: body.validatedImages ?? 0,
      averageScore: body.averageScore ?? 0,
    });
    return reply.code(201).send({ success: true, data: doc });
  } catch (err) {
    return reply.code(400).send({
      success: false,
      message: err?.message || "Failed to create department",
    });
  }
};

// List with optional filters: ?q=&headEmail=&limit=&page=
export const getDepartments = async (
  req: FastifyRequest<{
    Querystring: {
      q?: string;
      headEmail?: string;
      limit?: string | number;
      page?: string | number;
    };
  }>,
  reply: FastifyReply
) => {
  try {
    const { q, headEmail, limit = 50, page = 1 } = req.query || {};
    const filter: any = {};

    if (q) {
      filter.$or = [
        { name: new RegExp(q, "i") },
        { description: new RegExp(q, "i") },
        { headName: new RegExp(q, "i") },
        { headEmail: new RegExp(q, "i") },
      ];
    }
    if (headEmail) filter.headEmail = headEmail;

    const perPage = Math.min(Number(limit) || 50, 200);
    const current = Math.max(Number(page) || 1, 1);

    const [items, total] = await Promise.all([
      Department.find(filter)
        .sort({ createdAt: -1 })
        .skip((current - 1) * perPage)
        .limit(perPage),
      Department.countDocuments(filter),
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
    return reply.code(500).send({
      success: false,
      message: err?.message || "Failed to fetch departments",
    });
  }
};

// Get one
export const getDepartmentById = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params;
    const doc = await Department.findById(id);
    if (!doc)
      return reply
        .code(404)
        .send({ success: false, message: "Department not found" });
    return reply.send({ success: true, data: doc });
  } catch (err) {
    return reply.code(400).send({
      success: false,
      message: err?.message || "Failed to fetch department",
    });
  }
};

// Update (partial or full)
export const updateDepartment = async (
  req: FastifyRequest<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      description: string;
      headName: string;
      headEmail: string;
      employeeCount: number;
      validatedImages: number;
      averageScore: number;
    }>;
  }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    if ((updates as any)?._id) delete (updates as any)._id;

    const updated = await Department.findByIdAndUpdate(
      id,
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!updated)
      return reply
        .code(404)
        .send({ success: false, message: "Department not found" });
    return reply.send({ success: true, data: updated });
  } catch (err) {
    return reply.code(400).send({
      success: false,
      message: err?.message || "Failed to update department",
    });
  }
};

// Delete
export const deleteDepartment = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params;
    const deleted = await Department.findByIdAndDelete(id);
    if (!deleted)
      return reply
        .code(404)
        .send({ success: false, message: "Department not found" });
    return reply.send({ success: true, data: deleted });
  } catch (err) {
    return reply.code(400).send({
      success: false,
      message: err?.message || "Failed to delete department",
    });
  }
};

// Stats (simple backing for your fetchDepartmentStats thunk)
export const getDepartmentStats = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params;
    const dept = await Department.findById(id);
    if (!dept)
      return reply
        .code(404)
        .send({ success: false, message: "Department not found" });

    // Basic derived stats; extend when you have related collections
    const stats = {
      departmentId: id,
      totalValidations: dept.validatedImages ?? 0,
      monthlyGrowth: 0, // TODO: compute from history when available
      topPerformer: dept.headName ?? null, // placeholder
      averageCompletionTime: null as number | null, // mins; compute when data exists
    };

    return reply.send({ success: true, data: stats });
  } catch (err) {
    return reply.code(500).send({
      success: false,
      message: err?.message || "Failed to fetch department stats",
    });
  }
};
