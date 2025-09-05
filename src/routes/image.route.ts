// routes/image.route.ts
import { FastifyInstance } from "fastify";
import {
  getImages,
  getImageById,
  uploadZip,
  assignViolation,
  removeViolation,
  deleteImage,
  getImageFile, // ⬅️ import
} from "../controllers/image.controller";
import { verifyJWT } from "plugins/auth.middleware";
export default async function imageRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", verifyJWT);

  fastify.get("/images", getImages);
  fastify.get("/images/:id", getImageById);

  // 🔽 actual image bytes for <img src="...">
  fastify.get("/images/:id/file", getImageFile);

  fastify.post("/images/upload-zip", uploadZip);
  fastify.post("/images/:id/violations", assignViolation);
  fastify.delete("/images/:id/violations/:index", removeViolation);
  fastify.delete("/images/:id", deleteImage);
}
