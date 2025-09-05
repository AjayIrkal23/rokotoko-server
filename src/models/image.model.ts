// models/Image.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IViolation {
  name: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
}

export interface IImage extends Document {
  _id: mongoose.Types.ObjectId; // keep MongoDB _id
  name: string;
  imageURL: string;
  imagePath: string;
  violations: IViolation[];
  uploadedAt?: Date;
  fileSize?: number;
  aivalidated?: boolean;
}

const ViolationSchema = new Schema<IViolation>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    severity: {
      type: String,
      enum: ["Critical", "High", "Medium", "Low"],
      default: "Low",
    },
  },
  { _id: false } // embedded, no extra _id
);

const ImageSchema = new Schema<IImage>(
  {
    name: { type: String, required: true, trim: true },
    imageURL: { type: String, required: true },
    imagePath: { type: String, required: true },
    violations: { type: [ViolationSchema], default: [] },
    uploadedAt: { type: Date, default: Date.now },
    fileSize: { type: Number },
    aivalidated: { type: Boolean, default: false },
  },
  {
    timestamps: true, // createdAt & updatedAt
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
  }
);

// Helpful indexes
ImageSchema.index({ name: 1 });
ImageSchema.index({ uploadedAt: -1 });

export const Image: Model<IImage> =
  mongoose.models.Image || mongoose.model<IImage>("Image", ImageSchema);
