// routes/user.route.ts
import { FastifyInstance } from "fastify";
import {
  addUser,
  getUserByEmpId,
  getAllUsers,
  updateUser,
  deleteUser,
} from "../controllers/user.controller";
import { verifyJWT } from "../plugins/auth.middleware";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", verifyJWT);
  fastify.post("/users", addUser);
  fastify.get("/users", getAllUsers);
  fastify.get("/users/:empid", getUserByEmpId);
  fastify.patch("/users/:empid", updateUser);
  fastify.put("/users/:empid", updateUser);
  fastify.delete("/users/:empid", deleteUser);
}
