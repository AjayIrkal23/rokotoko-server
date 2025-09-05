// plugins/seed-admin.ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { User } from "../models/user.model";

type EnsureAdminOpts = {
  empid?: string;
  email?: string;
  name?: string;
  department?: string;
};

async function ensureAdminUser(
  app: FastifyInstance,
  opts: EnsureAdminOpts = {}
) {
  const empid = process.env.ADMIN_EMPID || opts.empid || "emp1";
  const email =
    process.env.ADMIN_EMAIL || opts.email || "ajayirkal@docketrun.com";
  const name = process.env.ADMIN_NAME || opts.name || "Super Admin";
  const department = process.env.ADMIN_DEPARTMENT || opts.department || "ALL";

  // 1) Prefer exact empid match
  const byEmp = await User.findOne({ empid });
  if (byEmp) {
    if (byEmp.role !== "admin") {
      byEmp.role = "admin";
      await byEmp.save();
      app.log.info(`Promoted existing user ${empid} to admin`);
    } else {
      app.log.info(`Admin user already present with empid=${empid}`);
    }
    return;
  }

  // 2) If emp not found, try by email (unique in your schema)
  const byEmail = await User.findOne({ email });
  if (byEmail) {
    let changed = false;
    if (byEmail.role !== "admin") {
      byEmail.role = "admin";
      changed = true;
    }
    if (!byEmail.empid) {
      byEmail.empid = empid;
      changed = true;
    }
    if (changed) {
      await byEmail.save();
      app.log.info(`Updated ${email} to admin (empid set to ${empid})`);
    } else {
      app.log.info(`User with email=${email} already admin`);
    }
    return;
  }

  // 3) Create brand-new admin
  await User.create({
    name,
    email,
    empid,
    department,
    role: "admin",
    validatedImages: 0,
    score: 0,
    // achievements omitted => defaults from schema
  });

  app.log.info(`Seeded admin user empid=${empid} email=${email}`);
}

export default fp(
  async function seedAdmin(app) {
    app.addHook("onReady", async () => {
      try {
        await ensureAdminUser(app);
      } catch (err) {
        app.log.error({ err }, "Failed to seed admin user");
      }
    });
  },
  { name: "seed-admin" }
);

export { ensureAdminUser };
