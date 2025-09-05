import Fastify from "fastify";
import dotenv from "dotenv";
dotenv.config();
import cors from "./plugins/cors";
import helmet from "./plugins/helmet";
import swagger from "./plugins/swagger";
import socket from "./plugins/socket";
import rateLimit from "./plugins/rate-limit";
import multipart from "./plugins/multipart";
import staticFiles from "./plugins/static";
import compress from "./plugins/compress";
import sensible from "./plugins/sensible";
import arena from "./dashboard/arena";
import registerRoutes from "routes";
import seedAdmin from "plugins/seed-admin";
import imageAiCron from "plugins/image-ai-cron";

export const buildApp = () =>
  Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    },
  });

export const registerAppPlugins = async (app: ReturnType<typeof buildApp>) => {
  await app.register(cors);
  await app.register(helmet);
  await app.register(swagger);
  await app.register(socket);
  await app.register(rateLimit);
  await app.register(multipart);
  await app.register(staticFiles);
  await app.register(compress);
  await app.register(sensible);
  await app.register(arena);
  await app.register(registerRoutes);

  await app.register(imageAiCron);
  await app.register(seedAdmin);
};
