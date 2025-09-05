// routes/department.route.ts
import { FastifyInstance } from "fastify";
import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getDepartmentStats,
} from "../controllers/department.controller";

// import { verifyJWT } from "../auth/jwt"; // uncomment to protect

export default async function departmentRoutes(fastify: FastifyInstance) {
  // If you want to protect all department routes:
  // fastify.addHook("preHandler", verifyJWT);

  fastify.get("/departments", getDepartments);
  fastify.post("/departments", createDepartment);
  fastify.get("/departments/:id", getDepartmentById);
  fastify.patch("/departments/:id", updateDepartment);
  fastify.put("/departments/:id", updateDepartment);
  fastify.delete("/departments/:id", deleteDepartment);

  // Stats
  fastify.get("/departments/:id/stats", getDepartmentStats);
}
