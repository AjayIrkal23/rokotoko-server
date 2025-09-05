// services/sendToOpenAiGetResult.ts
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import path from "path";

const API_KEY = process.env.OPENAI_API_KEY || process.env.API_KEY;
if (!API_KEY) throw new Error("Missing OPENAI_API_KEY (or API_KEY)");

const ASSISTANT_ID =
  process.env.OPENAI_ASSISTANT_ID || "asst_SQhnhxIrwChyc3mHPUX5ouEd";

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "OpenAI-Beta": "assistants=v2",
  "Content-Type": "application/json",
};

export type AssistantViolation = {
  name: string;
  description?: string;
  severity: "Critical" | "High" | "Medium" | "Low";
};

export type AssistantResponse = {
  violations: AssistantViolation[];
};

export async function sendToOpenAiGetResult(
  imagePathParam: string
): Promise<AssistantResponse | null> {
  try {
    const fileId = await uploadImageToOpenAI(imagePathParam);
    if (!fileId) return null;

    const threadId = await createThread();
    if (!threadId) return null;

    // 🚫 no extra prompt — just the image
    await addMessageToThread(threadId, fileId);

    const runId = await runThread(threadId);
    if (!runId) return null;

    const result = await pollRun(threadId, runId);
    return result;
  } catch (err) {
    console.error("Failed to send image to OpenAI:", err);
    return null;
  }
}

async function uploadImageToOpenAI(
  imagePathParam: string
): Promise<string | null> {
  const url = "https://api.openai.com/v1/files";
  const absolute = path.isAbsolute(imagePathParam)
    ? imagePathParam
    : path.join(process.cwd(), imagePathParam);

  if (!fs.existsSync(absolute)) {
    console.error("Image file not found:", absolute);
    return null;
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(absolute));
  // Either "assistants" or "vision" works with Assistants v2; keep your original:
  form.append("purpose", "vision");

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    ...form.getHeaders(),
  };

  const res = await axios.post(url, form, { headers });
  return res.data?.id || null;
}

async function createThread(): Promise<string | null> {
  const res = await axios.post(
    "https://api.openai.com/v1/threads",
    {},
    { headers: HEADERS }
  );
  return res.data?.id || null;
}

async function addMessageToThread(threadId: string, fileId: string) {
  const url = `https://api.openai.com/v1/threads/${threadId}/messages`;
  const body = {
    role: "user",
    content: [
      { type: "image_file", image_file: { file_id: fileId } }, // ✅ image only
    ],
  };
  await axios.post(url, body, { headers: HEADERS });
}

async function runThread(threadId: string): Promise<string | null> {
  const url = `https://api.openai.com/v1/threads/${threadId}/runs`;
  const body = { assistant_id: ASSISTANT_ID };
  const res = await axios.post(url, body, { headers: HEADERS });
  return res.data?.id || null;
}

async function pollRun(
  threadId: string,
  runId: string
): Promise<AssistantResponse | null> {
  const url = `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`;

  let delay = 1500;
  const maxDelay = 5000;
  const start = Date.now();

  while (Date.now() - start < 60000) {
    const res = await axios.get(url, { headers: HEADERS });
    const status = res.data?.status;

    if (status === "completed") {
      return getFinalMessage(threadId);
    } else if (
      status === "failed" ||
      status === "cancelled" ||
      status === "expired"
    ) {
      console.error("Run failed:", res.data);
      return null;
    }

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(maxDelay, Math.floor(delay * 1.5));
  }

  console.error("Polling timed out.");
  return null;
}

async function getFinalMessage(
  threadId: string
): Promise<AssistantResponse | null> {
  const url = `https://api.openai.com/v1/threads/${threadId}/messages`;
  const res = await axios.get(url, { headers: HEADERS });
  const messages = res.data?.data || [];

  for (const msg of messages) {
    if (msg?.role !== "assistant") continue;

    for (const part of msg?.content || []) {
      // v2 often returns "output_text"; fallback to "text"
      let str: string | undefined;
      if (part?.type === "output_text") str = part?.text?.value;
      if (!str && part?.type === "text") str = part?.text?.value;
      if (!str) continue;

      try {
        const parsed = JSON.parse(String(str));
        if (parsed && Array.isArray(parsed.violations)) {
          return { violations: parsed.violations };
        }
      } catch {
        // ignore parse error and keep scanning
      }
    }
  }

  return null;
}
