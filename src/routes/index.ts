// routes/index.ts
import { FastifyInstance } from "fastify";
import userRoutes from "./user.route";
import authRoutes from "./auth.route";
import imageRoutes from "./image.route";
import departmentRoutes from "./department.route";
import annotatedImageRoutes from "./annotated-image.route";

export default async function registerRoutes(fastify: FastifyInstance) {
  fastify.register(
    async (app) => {
      await app.register(authRoutes);
      await app.register(userRoutes);
      await app.register(imageRoutes);
      await app.register(departmentRoutes);
      await app.register(annotatedImageRoutes);
    },
    { prefix: "/api" }
  );
}
