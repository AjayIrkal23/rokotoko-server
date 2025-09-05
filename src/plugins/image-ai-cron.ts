// plugins/image-ai-cron.ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { processUnlabeledImages } from "helpers/processUnlabeledImages";

/**
 * ENV (optional):
 *  - AI_PROCESS_INTERVAL_MS: how often to run (default 10000 ms)
 *  - AI_PROCESS_BATCH_SIZE:  how many images per batch (default 25)
 *  - AI_BACKOFF_WHEN_IDLE:   if true, increases interval while no work (default true)
 */
export default fp(
  async function imageAICron(app: FastifyInstance) {
    const baseIntervalMs = Number(process.env.AI_PROCESS_INTERVAL_MS || 10_000);
    const batchSize = Number(process.env.AI_PROCESS_BATCH_SIZE || 25);
    const backoffWhenIdle =
      String(process.env.AI_BACKOFF_WHEN_IDLE || "true") === "true";

    let running = false;
    let timer: NodeJS.Timeout | null = null;
    let currentInterval = baseIntervalMs;

    async function tick() {
      if (running) {
        app.log.warn("AI processor already running, skipping tick");
        return;
      }
      running = true;

      try {
        const { processed } = await processUnlabeledImages(batchSize);
        app.log.info({ processed }, "AI processor batch done");

        // Optional backoff: if there was nothing to process, relax the schedule a bit.
        if (backoffWhenIdle) {
          const nothingToDo = processed === 0;
          const nextInterval = nothingToDo
            ? Math.min(currentInterval * 2, 120_000) // cap at 2 minutes
            : baseIntervalMs;

          if (nextInterval !== currentInterval) {
            currentInterval = nextInterval;
            if (timer) clearInterval(timer);
            timer = setInterval(tick, currentInterval);
            app.log.info({ currentInterval }, "Adjusted AI processor interval");
          }
        }
      } catch (err) {
        app.log.error({ err }, "AI processor failed");
      } finally {
        running = false;
      }
    }

    app.addHook("onReady", async () => {
      app.log.info(
        { baseIntervalMs, batchSize, backoffWhenIdle },
        "Starting AI image processor"
      );
      // fire immediately so it starts working on boot
      tick().catch(() => {});
      // then schedule periodic runs
      timer = setInterval(tick, currentInterval);
    });

    app.addHook("onClose", async () => {
      if (timer) clearInterval(timer);
    });

    // Optional tiny admin endpoints (remove if you don’t want them exposed)
    app.get("/internal/ai-processor/status", async () => ({
      running,
      currentInterval,
      batchSize,
      backoffWhenIdle,
    }));
    app.post("/internal/ai-processor/trigger", async () => {
      await tick();
      return { ok: true };
    });
  },
  { name: "image-ai-cron" }
);
