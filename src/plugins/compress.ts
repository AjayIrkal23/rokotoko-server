import fp from "fastify-plugin";
import compress from "@fastify/compress";

export default fp(async (fastify) => {
  fastify.register(compress, { global: true });
});
