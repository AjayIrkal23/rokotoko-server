// models/Department.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDepartmentDoc extends Document {
  _id: mongoose.Types.ObjectId; // keep _id
  name: string;
  description: string;
  headName: string;
  headEmail: string;
  employeeCount: number;
  validatedImages: number;
  averageScore: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const DepartmentSchema = new Schema<IDepartmentDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, required: true, trim: true },

    headName: { type: String, required: true, trim: true },
    headEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        // basic email regex; adjust if you have a validator package
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Invalid headEmail format",
      ],
      index: true,
    },

    // Counters / metrics
    employeeCount: { type: Number, default: 0, min: 0 },
    validatedImages: { type: Number, default: 0, min: 0 },
    averageScore: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
  }
);

// Indexes
DepartmentSchema.index({ name: 1 }, { unique: true });
DepartmentSchema.index({ headEmail: 1 });
DepartmentSchema.index({ name: "text", description: "text" }); // optional text search

// Normalize email on save (extra safety)
DepartmentSchema.pre("save", function (next) {
  if (this.isModified("headEmail") && typeof this.headEmail === "string") {
    this.headEmail = this.headEmail.toLowerCase().trim();
  }
  next();
});

export const Department: Model<IDepartmentDoc> =
  mongoose.models.Department ||
  mongoose.model<IDepartmentDoc>("Department", DepartmentSchema);
