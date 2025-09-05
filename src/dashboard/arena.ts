import fp from "fastify-plugin";
import { createBullBoard } from "@bull-board/api";
import { FastifyAdapter } from "@bull-board/fastify";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";

export default fp(async (fastify) => {
  const serverAdapter = new FastifyAdapter();

  // ✅ Create BullBoard with your queue(s)
  createBullBoard({
    queues: [], // 👈 Add queue(s) here
    serverAdapter,
  });

  // ✅ Mount BullBoard at /admin/queues
  await fastify.register(serverAdapter.registerPlugin(), {
    basePath: "/admin/queues",
  });
});
