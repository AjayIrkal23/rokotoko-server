import fp from "fastify-plugin";
import fastifyStatic from "@fastify/static";
import { join } from "path";

export default fp(async (fastify) => {
  // public
  fastify.register(fastifyStatic, {
    root: join(process.cwd(), "public"),
    prefix: "/public/",
    setHeaders(res /*, pathName */) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      // optional CORS header for fetch/XHR (not required for <img>):
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  });

  // uploads/images
  fastify.register(fastifyStatic, {
    root: join(process.cwd(), "uploads", "images"),
    prefix: "/uploads/images/",
    decorateReply: false,
    setHeaders(res /*, pathName */) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  });
});
