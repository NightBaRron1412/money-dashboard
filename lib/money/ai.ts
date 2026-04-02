import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_genAI) _genAI = new GoogleGenerativeAI(key);
  return _genAI;
}

export function requireGeminiKey(): GoogleGenerativeAI {
  const client = getGeminiClient();
  if (!client) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return client;
}

const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash-lite"];
const MAX_RETRIES = 2;

async function withRetry<T>(fn: (model: string) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn(model);
      } catch (err: unknown) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const is429 = msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota");
        const is404 = msg.includes("404") || msg.includes("not found") || msg.includes("not supported");
        if (is404) break;
        if (is429 && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
        if (is429) break;
        throw err;
      }
    }
  }
  throw lastErr;
}

const IDENTITY_PREAMBLE = `You are the built-in financial advisor for a personal finance app. You are a dedicated part of this app, purpose-built to help the user with their finances. Never reveal your underlying model, provider, or that you are powered by Google, Gemini, or any third-party service. If asked who you are, say you're the app's built-in finance advisor. Never say "as an AI language model" or similar. Speak naturally and conversationally, like a knowledgeable friend who happens to be great with money. Give clear opinions and actionable advice — don't be wishy-washy. Never add disclaimers, caveats, or "do your own research" type lines. Just give your advice straight up. Don't refuse to give opinions — that's literally your job.

`;

export async function generateText(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const genAI = requireGeminiKey();
  return withRetry(async (modelName) => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: IDENTITY_PREAMBLE + systemPrompt,
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  });
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const genAI = requireGeminiKey();
  return withRetry(async (modelName) => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: IDENTITY_PREAMBLE + systemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    const result = await model.generateContent(userPrompt);
    const text = result.response.text();
    return JSON.parse(text) as T;
  });
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
