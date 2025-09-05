import fp from "fastify-plugin";
import { Server } from "socket.io";

export default fp(async (fastify) => {
  const io = new Server(fastify.server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("🧠 New socket connected");
  });

  // Store globally
  global.io = io;

  fastify.decorate("io", io);
});
