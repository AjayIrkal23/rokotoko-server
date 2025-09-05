// routes/annotated-image.route.ts
import { FastifyInstance } from "fastify";
import {
  fetchAnnotatedImages,
  fetchAnnotationCandidates,
  getGameAnnotatedBatch,
  submitAnnotatedImage,
  updateAnnotatedImage,
} from "../controllers/annotated-image.controller";
import { verifyJWT } from "plugins/auth.middleware"; // adjust path if needed

export default async function annotatedImageRoutes(fastify: FastifyInstance) {
  // ✅ Apply once for all routes in this scope
  fastify.addHook("preHandler", verifyJWT);

  // List with pagination (page, pageSize)
  fastify.get("/annotated-images", fetchAnnotatedImages);

  // Create a new annotated image (snapshots base image fields server-side)
  fastify.post("/annotated-images", submitAnnotatedImage);

  // ✅ Only images that DO NOT have an annotation yet
  // Optional query: ?onlyValidated=true to require aivalidated=true
  fastify.get("/annotated-images/candidates", fetchAnnotationCandidates);

  // New game batch endpoint (defaults to 10)
  fastify.get("/annotated-images/game", getGameAnnotatedBatch);

  fastify.patch("/annotated-images/:id", updateAnnotatedImage);
  fastify.put("/annotated-images/:id", updateAnnotatedImage);
}
