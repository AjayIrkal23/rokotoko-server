// services/processUnlabeledImages.ts
import { Image, IViolation } from "../models/image.model";
import {
  sendToOpenAiGetResult,
  AssistantResponse,
} from "./sendToOpenAiGetResult";

// Map any incoming severity to your allowed enum; default "Low"
function normalizeSeverity(val: any): IViolation["severity"] {
  const s = String(val || "").toLowerCase();
  if (s === "critical") return "Critical";
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  return "Low";
}

function normalizeViolation(raw: any): IViolation {
  return {
    name: String(raw?.name ?? "Unspecified").trim(),
    description: String(raw?.description ?? "").trim(),
    severity: normalizeSeverity(raw?.severity),
  };
}

/**
 * Process images that haven't been AI-validated yet.
 * @param limit Optional cap per run (default 100)
 */
export async function processUnlabeledImages(limit = 100) {
  const images = await Image.find({
    $or: [{ aivalidated: { $exists: false } }, { aivalidated: false }],
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  console.log(`Found ${images.length} images pending AI validation`);

  for (const image of images) {
    try {
      console.log(`Processing image: ${image.name} (${image._id})`);

      const ai: AssistantResponse | null = await sendToOpenAiGetResult(
        image.imagePath
      );

      let violations: IViolation[] = [];
      if (ai && Array.isArray(ai.violations)) {
        violations = ai.violations
          .map(normalizeViolation)
          .filter((v) => v.name && v.name.length > 0);
      } else {
        console.log(`❌ No valid violations array for: ${image.name}`);
      }

      image.violations = violations;
      image.aivalidated = true; // mark processed even if none found
      await image.save();

      console.log(
        `✅ Updated ${image.name}: ${violations.length} violation(s) saved`
      );
    } catch (err) {
      console.error(`💥 Failed processing ${image.name}:`, err);
      // Optionally: leave aivalidated=false to retry later or add a retry counter field.
    }
  }

  return { processed: images.length };
}
