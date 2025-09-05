import { connectDB } from "./database/connect";
import { buildApp, registerAppPlugins } from "./app";
import { config } from "./config/env.js"; // make sure this exposes port & host

// .env
// PORT=3000
// HOST=0.0.0.0

const start = async () => {
  await connectDB();

  const app = buildApp();
  await registerAppPlugins(app);

  // Fastify supports both callback and promise styles:
  app.listen({ port: config.port, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    app.log.info(`🚀 Server running at ${address}`);
  });
};

start();
