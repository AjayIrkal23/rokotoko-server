// models/User.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "admin" | "user";

export interface IAchievements {
  firstCatch: boolean;
  sharpEye: boolean;
  safetyChampion: boolean;
  safetyMaster: boolean;
  topPerformer: boolean;
  masterPerformer: boolean;
  top10: boolean;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId; // keep _id
  name: string;
  email: string;
  empid: string;
  department: string;
  role: UserRole;
  validatedImages: number;
  score?: number;
  achievements: IAchievements;

  // OTP
  otp?: string;
  otpExpiry?: Date;

  // 🔐 JWT (session)
  jwtoken?: string; // currently active access token
  jwtokenIssuedAt?: Date; // when the token was created

  createdAt?: Date;
  updatedAt?: Date;
}

const AchievementsSchema = new Schema<IAchievements>(
  {
    firstCatch: { type: Boolean, default: false },
    sharpEye: { type: Boolean, default: false },
    safetyChampion: { type: Boolean, default: false },
    safetyMaster: { type: Boolean, default: false },
    topPerformer: { type: Boolean, default: false },
    masterPerformer: { type: Boolean, default: false },
    top10: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      unique: true,
    },
    empid: {
      type: String,
      required: true,
      trim: true,
      index: true,
      unique: true,
    },
    department: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
      index: true,
    },
    validatedImages: { type: Number, default: 0, min: 0 },
    score: { type: Number, default: 0, min: 0 },
    achievements: { type: AchievementsSchema, default: () => ({}) },

    // OTP
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },

    // 🔐 JWT (session)
    jwtoken: { type: String, select: false },
    jwtokenIssuedAt: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
  }
);

UserSchema.index({ department: 1, role: 1 });

UserSchema.pre("save", function (next) {
  if (this.isModified("email") && typeof this.email === "string") {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
