// controllers/annotated-image.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { AnnotatedImage } from "models/anotated.model";
import { Image } from "models/image.model";
import mongoose from "mongoose";

/** GET /annotated-images?page=&pageSize= */
export const fetchAnnotatedImages = async (
  req: FastifyRequest<{ Querystring: { page?: number; pageSize?: number } }>,
  reply: FastifyReply
) => {
  try {
    const { page = 1, pageSize = 20 } = req.query || {};
    const p = Math.max(Number(page) || 1, 1);
    const ps = Math.min(Math.max(Number(pageSize) || 20, 1), 200);

    const [items, total] = await Promise.all([
      AnnotatedImage.find({})
        .sort({ annotatedAt: -1, createdAt: -1 })
        .skip((p - 1) * ps)
        .limit(ps)
        .lean(),
      AnnotatedImage.countDocuments({}),
    ]);

    return reply.send({
      items,
      page: p,
      pageSize: ps,
      total,
      totalPages: Math.ceil(total / ps),
    });
  } catch (err) {
    req.log.error(err);
    return reply
      .code(500)
      .send({ message: err?.message || "Failed to fetch annotated images" });
  }
};

/**
 * POST /annotated-images
 * Body: {
 *   image: string(ObjectId),
 *   annotatedBy: string,
 *   annotatedViolations: IAnnotatedViolation[],
 *   validated?: boolean,
 *   imageWidth?: number,
 *   imageHeight?: number,
 *   usersValidated?: string[]
 * }
 *
 * NOTE: We DO NOT trust the client for base image fields.
 * We fetch the Image by _id and snapshot name, imageURL, imagePath, violations, etc.
 */
export const submitAnnotatedImage = async (
  req: FastifyRequest<{
    Body: {
      image: string; // ObjectId of Image
      annotatedBy: string;
      annotatedViolations: any[]; // validated by schema
      validated?: boolean;
      imageWidth?: number;
      imageHeight?: number;
      usersValidated?: string[];
      annotatedAt?: string | Date;
    };
  }>,
  reply: FastifyReply
) => {
  try {
    const {
      image,
      annotatedBy,
      annotatedViolations = [],
      validated,
      imageWidth,
      imageHeight,
      usersValidated = [],
      annotatedAt,
    } = req.body || {};

    if (!image || !mongoose.isValidObjectId(image)) {
      return reply
        .code(400)
        .send({ message: "Valid 'image' ObjectId is required" });
    }
    if (!annotatedBy) {
      return reply.code(400).send({ message: "'annotatedBy' is required" });
    }

    // Fetch base Image (source)
    const src = await Image.findById(image);
    if (!src) {
      return reply.code(404).send({ message: "Source image not found" });
    }

    // Snapshot base image fields from Image doc
    const baseSnapshot = {
      name: src.name,
      imageURL: src.imageURL,
      imagePath: src.imagePath,
      violations: src.violations || [],
      uploadedAt: src.uploadedAt,
      fileSize: src.fileSize,
      aivalidated: !!src.aivalidated,
    };

    const doc = await AnnotatedImage.create({
      image: src._id,
      ...baseSnapshot,

      annotatedAt: annotatedAt ? new Date(annotatedAt) : new Date(),
      annotatedBy,
      validated:
        typeof validated === "boolean"
          ? validated
          : annotatedViolations.length > 0,
      annotatedViolations,

      imageWidth,
      imageHeight,
      usersValidated,
    });

    // Return the document itself (no wrapper) – matches your thunk shape
    return reply.code(201).send(doc.toObject());
  } catch (err) {
    req.log.error(err);
    return reply
      .code(400)
      .send({ message: err?.message || "Failed to submit annotation" });
  }
};

/**
 * ✅ NEW:
 * GET /annotated-images/candidates?page=&pageSize=&onlyValidated=
 * Returns Image docs that DO NOT yet have an AnnotatedImage.
 * - onlyValidated (optional boolean): when true, only returns images with aivalidated=true.
 */
export const fetchAnnotationCandidates = async (
  req: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; onlyValidated?: string };
  }>,
  reply: FastifyReply
) => {
  try {
    const { page = 1, pageSize = 20, onlyValidated } = req.query || {};
    const p = Math.max(Number(page) || 1, 1);
    const ps = Math.min(Math.max(Number(pageSize) || 20, 1), 200);

    // All image ids already annotated
    const annotatedIds = await AnnotatedImage.distinct("image");

    const filter: any = { _id: { $nin: annotatedIds } };
    // Optional: only images already AI-validated
    const onlyValBool =
      typeof onlyValidated === "string"
        ? ["1", "true", "yes"].includes(onlyValidated.toLowerCase())
        : !!onlyValidated;
    if (onlyValBool) filter.aivalidated = true;

    const [items, total] = await Promise.all([
      Image.find(filter)
        .sort({ uploadedAt: -1, createdAt: -1 })
        .skip((p - 1) * ps)
        .limit(ps)
        .lean(),
      Image.countDocuments(filter),
    ]);

    return reply.send({
      items,
      page: p,
      pageSize: ps,
      total,
      totalPages: Math.ceil(total / ps),
    });
  } catch (err) {
    req.log.error(err);
    return reply
      .code(500)
      .send({ message: err?.message || "Failed to fetch candidates" });
  }
};

/**
 * GET /annotated-images/game?limit=10
 * Uses req.user.dbUser.empid (from verifyJWT). Falls back to ?empid=...
 * Returns a random sample of annotated images where usersValidated DOES NOT
 * contain the user's empid, and there is at least one annotated violation.
 */
export const getGameAnnotatedBatch = async (
  req: FastifyRequest<{ Querystring: { limit?: number; empid?: string } }>,
  reply: FastifyReply
) => {
  try {
    const empidFromAuth = (req as any)?.user?.dbUser?.empid as
      | string
      | undefined;
    const empidFromQuery = req.query?.empid
      ? String(req.query.empid)
      : undefined;
    const empid = empidFromAuth || empidFromQuery;

    if (!empid) {
      return reply
        .code(400)
        .send({ message: "empid is required via auth or ?empid=" });
    }

    const raw = Number(req.query?.limit);
    const limit = Math.min(Math.max(isNaN(raw) ? 10 : raw, 1), 50);

    const items = await AnnotatedImage.aggregate([
      {
        $match: {
          validated: true,
          usersValidated: { $ne: empid },
          "annotatedViolations.0": { $exists: true }, // at least one bbox
        },
      },
      { $sample: { size: limit } },
      {
        $project: {
          _id: 1,
          image: 1,
          name: 1,
          imageURL: 1,
          imagePath: 1,
          violations: 1,
          uploadedAt: 1,
          fileSize: 1,
          aivalidated: 1,
          annotatedAt: 1,
          annotatedBy: 1,
          validated: 1,
          annotatedViolations: 1,
          imageWidth: 1,
          imageHeight: 1,
          usersValidated: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    return reply.send({
      empid,
      limit,
      count: items.length,
      items,
    });
  } catch (err) {
    req.log.error(err);
    return reply
      .code(500)
      .send({ message: err?.message || "Failed to fetch game batch" });
  }
};

/**
 * PATCH/PUT /annotated-images/:id
 * - If body contains update operators ($set/$push/...), it's passed through as-is.
 * - Otherwise it's wrapped as { $set: body } for a partial update.
 * - Protects immutable fields like _id/createdAt/updatedAt from being overwritten.
 */
export const updateAnnotatedImage = async (
  req: FastifyRequest<{ Params: { id: string }; Body: any }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params;
    const body = (req.body ?? {}) as Record<string, any>;

    // Never allow direct _id timestamps changes
    delete body._id;
    delete body.createdAt;
    delete body.updatedAt;

    // Determine if the client sent any operator
    const hasOperator = Object.keys(body).some((k) => k.startsWith("$"));

    const updateDoc = hasOperator ? body : { $set: body };

    const updated = await AnnotatedImage.findByIdAndUpdate(id, updateDoc, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return reply.code(404).send({ message: "Annotated image not found" });
    }

    return reply.send(updated.toObject());
  } catch (err) {
    req.log.error(err);
    return reply
      .code(400)
      .send({ message: err?.message || "Failed to update annotated image" });
  }
};
