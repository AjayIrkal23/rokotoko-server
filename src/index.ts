import { connectDB } from "./database/connect";
import { buildApp, registerAppPlugins } from "./app";
import { config } from "./config/env.js";

const start = async () => {
  await connectDB(); // ✅ Connect MongoDB

  const app = buildApp();
  // hehehe
  await registerAppPlugins(app);

  app.listen({ port: config.port }, (err, address) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    app.log.info(`🚀 Server running at ${address}`);
  });
};

start();
