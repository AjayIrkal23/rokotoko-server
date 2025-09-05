// models/AnnotatedImage.ts
import mongoose, { Schema, Document, Model } from "mongoose";

/** If you already export these from other files, import instead. */
export interface IViolation {
  name: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
}

export interface IBoundingBox {
  id: string;
  x: number; // normalized [0..1]
  y: number; // normalized [0..1]
  width: number; // normalized [0..1]
  height: number; // normalized [0..1]
  createdAt: string | any;
  createdBy: string; // empid or user id
  imageWidth: number; // original image width (px)
  imageHeight: number; // original image height (px)
}

export interface IAnnotatedViolation extends IViolation {
  bbox: IBoundingBox;
  notes?: string;
  isNew?: boolean;
}

export interface IImageBase {
  name: string;
  imageURL: string;
  imagePath: string;
  violations: IViolation[];
  uploadedAt?: Date;
  fileSize?: number;
  aivalidated?: boolean;
}

export interface IAnnotatedImage extends Document, IImageBase {
  _id: mongoose.Types.ObjectId; // keep MongoDB _id
  /** Link back to original Image document */
  image: mongoose.Types.ObjectId; // ref: "Image"

  annotatedAt: Date;
  annotatedBy: string; // empid or user id
  validated: boolean; // true when all violations are assigned
  annotatedViolations: IAnnotatedViolation[];

  imageWidth?: number;
  imageHeight?: number;
  usersValidated: string[]; // user IDs who have validated this image
}

/* ---------- Sub-schemas ---------- */

const BoundingBoxSchema = new Schema<IBoundingBox>(
  {
    id: { type: String, required: true, trim: true },
    x: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    y: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    width: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    height: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    createdAt: { type: Date, required: true, default: Date.now },
    createdBy: { type: String, required: true, trim: true },
    imageWidth: { type: Number, required: true, min: 1 },
    imageHeight: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const BaseViolationSchema = new Schema<IViolation>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ["Critical", "High", "Medium", "Low"],
      required: true,
    },
  },
  { _id: false }
);

const AnnotatedViolationSchema = new Schema<IAnnotatedViolation>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ["Critical", "High", "Medium", "Low"],
      required: true,
    },
    bbox: { type: BoundingBoxSchema, required: true },
    notes: { type: String, trim: true },
    isNew: { type: Boolean, default: false },
  },
  { _id: false }
);

/* ---------- Main schema ---------- */

const AnnotatedImageSchema = new Schema<IAnnotatedImage>(
  {
    // Link back to original Image doc
    image: {
      type: Schema.Types.ObjectId,
      ref: "Image",
      required: true,
      index: true,
    },

    // Fields from IImage (denormalized snapshot)
    name: { type: String, required: true, trim: true },
    imageURL: { type: String, required: true },
    imagePath: { type: String, required: true },
    violations: { type: [BaseViolationSchema], default: [] },
    uploadedAt: { type: Date, default: Date.now },
    fileSize: { type: Number },
    aivalidated: { type: Boolean, default: false },

    // Annotation fields
    annotatedAt: { type: Date, required: true, default: Date.now, index: true },
    annotatedBy: { type: String, required: true, trim: true, index: true },
    validated: { type: Boolean, default: false, index: true },
    annotatedViolations: { type: [AnnotatedViolationSchema], default: [] },

    imageWidth: { type: Number, min: 1 },
    imageHeight: { type: Number, min: 1 },

    usersValidated: { type: [String], default: [], index: true },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
  }
);

/* ---------- Indexes for common queries ---------- */
AnnotatedImageSchema.index({ validated: 1, annotatedAt: -1 });
AnnotatedImageSchema.index({ annotatedBy: 1, annotatedAt: -1 });
AnnotatedImageSchema.index({ "annotatedViolations.severity": 1 });

/* ---------- Optional virtuals ---------- */
// Count of annotated violations
AnnotatedImageSchema.virtual("annotatedCount").get(function (
  this: IAnnotatedImage
) {
  return this.annotatedViolations?.length || 0;
});

/* ---------- Export model ---------- */
export const AnnotatedImage: Model<IAnnotatedImage> =
  mongoose.models.AnnotatedImage ||
  mongoose.model<IAnnotatedImage>("AnnotatedImage", AnnotatedImageSchema);
