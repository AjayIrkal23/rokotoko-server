// controllers/image.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import path from "path";
import fs from "fs/promises";
import JSZip from "jszip";
import { createReadStream } from "fs";
import mime from "mime-types";
import { Image } from "models/image.model";
import { IViolation } from "models/anotated.model";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "images");
const PUBLIC_PREFIX_RAW = process.env.PUBLIC_PREFIX || "/uploads/images";

// --- helpers ---------------------------------------------------------------

const ensureDir = async (dir: string) => fs.mkdir(dir, { recursive: true });
const isImageFile = (name: string) => /\.(jpe?g|png|gif|webp)$/i.test(name);

const trimTrailingSlash = (s = "") => s.replace(/\/+$/, "");
const trimLeadingSlash = (s = "") => s.replace(/^\/+/, "");
const ensureLeadingSlash = (s = "") => (s.startsWith("/") ? s : `/${s}`);

const PUBLIC_PREFIX = ensureLeadingSlash(trimTrailingSlash(PUBLIC_PREFIX_RAW));

/** Build base URL using env if set; else infer from request/forwarded headers. */
function buildBaseUrl(req: FastifyRequest): string {
  const env = process.env.BASE_URL && trimTrailingSlash(process.env.BASE_URL);
  if (env) return env;

  const xfProto =
    (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || "";
  const xfHost =
    (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() || "";

  const proto = xfProto || (req.protocol as string) || "http";
  const host =
    xfHost || (req.headers.host as string) || (req.hostname as string);
  return `${proto}://${host}`;
}

/** Convert a possibly-relative URL to absolute using the current request. */
function toAbsoluteUrl(req: FastifyRequest, url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = buildBaseUrl(req);
  const clean = ensureLeadingSlash(url);
  return `${base}${clean}`;
}

// --- routes ----------------------------------------------------------------

// GET /images/:id/file  -> streams the image binary
export const getImageFile = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const doc = await Image.findById(req.params.id).lean();
    if (!doc) return reply.code(404).send({ message: "Image not found" });

    // Resolve file path safely (we only allow files within UPLOAD_DIR)
    const fileName = path.basename((doc as any).imagePath || "");
    const absPath = path.resolve(path.join(UPLOAD_DIR, fileName));
    const rootPath = path.resolve(UPLOAD_DIR);
    if (!absPath.startsWith(rootPath)) {
      return reply.code(400).send({ message: "Invalid image path" });
    }

    // Stat to get size/mtime and set headers
    const stat = await fs.stat(absPath).catch(() => null);
    if (!stat)
      return reply.code(404).send({ message: "File not found on disk" });

    const ct = (mime.lookup(fileName) || "application/octet-stream") as string;
    reply
      .header("Content-Type", ct)
      .header("Content-Length", stat.size.toString())
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("Last-Modified", stat.mtime.toUTCString())
      .header(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(
          (doc as any).name || fileName
        )}"`
      );

    return reply.send(createReadStream(absPath));
  } catch (err) {
    req.log.error(err);
    return reply
      .code(500)
      .send({ message: err?.message || "Failed to serve image" });
  }
};

// GET /images?page=&pageSize=&q=
export const getImages = async (
  req: FastifyRequest<{
    Querystring: { page?: string; pageSize?: string; q?: string };
  }>,
  reply: FastifyReply
) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(req.query.pageSize || "12", 10) || 12, 1),
      200
    );
    const q = (req.query.q || "").trim();

    const filter: any = {};
    if (q)
      filter.$or = [
        { name: new RegExp(q, "i") },
        { imagePath: new RegExp(q, "i") },
      ];

    const [docs, total] = await Promise.all([
      Image.find(filter)
        .sort({ uploadedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(), // return plain objects so we can safely mutate URLs below
      Image.countDocuments(filter),
    ]);

    // Always return absolute URLs (handles both new and legacy rows)
    const items = docs.map((d: any) => ({
      ...d,
      imageURL: toAbsoluteUrl(req, d.imageURL),
    }));

    return reply.send({
      items, // ⬅️ includes _id
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    req.log.error(err);
    return reply
      .code(500)
      .send({ message: err?.message || "Failed to fetch images" });
  }
};

// GET /images/:id
export const getImageById = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const img = await Image.findById(req.params.id).lean();
    if (!img) return reply.code(404).send({ message: "Image not found" });
    // normalize URL to absolute
    (img as any).imageURL = toAbsoluteUrl(req, (img as any).imageURL);
    return reply.send(img); // ⬅️ includes _id
  } catch (err) {
    return reply.code(400).send({ message: err?.message || "Invalid id" });
  }
};

// POST /images/upload-zip (multipart field: file)
export const uploadZip = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    if (!req.isMultipart()) {
      return reply.code(400).send({ message: "Multipart/form-data required" });
    }
    const file = await (req as any).file();
    if (!file)
      return reply
        .code(400)
        .send({ message: "ZIP file (field 'file') is required" });
    if (!/\.zip$/i.test(file.filename)) {
      return reply.code(400).send({ message: "Only .zip files are allowed" });
    }

    const buf: Buffer = await file.toBuffer();
    const zip = await JSZip.loadAsync(buf);
    await ensureDir(UPLOAD_DIR); // e.g. <cwd>/public/uploads/images

    const createdDocs: any[] = [];

    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const originalName = entry.name;
      if (!isImageFile(originalName)) continue;

      const content = await (entry as any).async("nodebuffer");

      const safeBase = path.basename(originalName).replace(/[^\w.\-]+/g, "_");
      const uniqueName = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}_${safeBase}`;

      // absolute path on disk where we save the file
      const diskPath = path.join(UPLOAD_DIR, uniqueName);
      await fs.writeFile(diskPath, content);

      // public URL (what the browser uses)
      const relUrl = `${PUBLIC_PREFIX}/${encodeURIComponent(uniqueName)}`; // e.g. /uploads/images/<file>
      const absUrl = toAbsoluteUrl(req, relUrl); // http://localhost:3000/uploads/images/<file>

      // ✅ POSIX-style relative FS path (what your AI code resolves via process.cwd())
      const relFsPath = path.posix.join("uploads", "images", uniqueName);

      const doc = await Image.create({
        name: safeBase,
        imageURL: absUrl, // public URL
        imagePath: relFsPath, // ✅ "uploads/images/<file>" (forward slashes)
        violations: [],
        uploadedAt: new Date(),
        fileSize: content.length,
        aivalidated: false,
      });
      createdDocs.push(doc.toObject());
    }

    // Response (URLs already absolute)
    const items = createdDocs.map((d: any) => ({
      ...d,
      imageURL: toAbsoluteUrl(req, d.imageURL),
    }));

    return reply.code(201).send({ items, added: items.length });
  } catch (err) {
    req.log.error(err);
    return reply
      .code(500)
      .send({ message: err?.message || "Failed to process ZIP" });
  }
};

// POST /images/:id/violations { violation }
export const assignViolation = async (
  req: FastifyRequest<{
    Params: { id: string };
    Body: { violation: IViolation };
  }>,
  reply: FastifyReply
) => {
  try {
    const { id } = req.params;
    const { violation } = (req.body || {}) as any;
    if (!violation?.name || !violation?.severity) {
      return reply.code(400).send({
        message: "violation.name and violation.severity are required",
      });
    }

    const img = await Image.findByIdAndUpdate(
      id,
      { $push: { violations: violation } },
      { new: true, runValidators: true }
    ).lean();
    if (!img) return reply.code(404).send({ message: "Image not found" });
    (img as any).imageURL = toAbsoluteUrl(req, (img as any).imageURL);
    return reply.send(img); // ⬅️ includes _id
  } catch (err) {
    return reply
      .code(400)
      .send({ message: err?.message || "Failed to assign violation" });
  }
};

// DELETE /images/:id/violations/:index
export const removeViolation = async (
  req: FastifyRequest<{ Params: { id: string; index: string } }>,
  reply: FastifyReply
) => {
  try {
    const { id, index } = req.params;
    const imgDoc = await Image.findById(id);
    if (!imgDoc) return reply.code(404).send({ message: "Image not found" });

    const idx = Number.parseInt(index, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= imgDoc.violations.length) {
      return reply.code(400).send({ message: "Invalid violation index" });
    }

    imgDoc.violations.splice(idx, 1);
    const saved = await imgDoc.save();
    const lean = saved.toObject();
    (lean as any).imageURL = toAbsoluteUrl(req, (lean as any).imageURL);
    return reply.send(lean); // ⬅️ includes _id
  } catch (err) {
    return reply
      .code(400)
      .send({ message: err?.message || "Failed to remove violation" });
  }
};

// DELETE /images/:id
export const deleteImage = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const img = await Image.findByIdAndDelete(req.params.id).lean();
    if (!img) return reply.code(404).send({ message: "Image not found" });
    return reply.send({ success: true });
  } catch (err) {
    return reply
      .code(400)
      .send({ message: err?.message || "Failed to delete image" });
  }
};
