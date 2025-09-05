import bcrypt from "bcrypt";
import { UserModel } from "./../models/user.model";

export const ensureSuperAdmin = async () => {
  const existing = await UserModel.findOne({ email: "admin@docketrun.com" });
  if (!existing) {
    const password = await bcrypt.hash("admin123", 12); // You can read from env if needed
    await UserModel.create({
      fullname: "Super Admin",
      department: "Admin",
      profile_pic: null,
      email: "admin@docketrun.com",
      password,
      contact: "1234567890",
      super_adminid: true,
      created_at: new Date().toISOString(),
      expire: null,
      jwtoken: null,
      selectedpages: [],
      forceLogout: false,
    });
    console.log("✅ Superadmin created");
  } else {
    console.log("ℹ️ Superadmin already exists");
  }
};
