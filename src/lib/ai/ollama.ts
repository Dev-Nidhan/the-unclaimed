import { z } from "zod";

import { traceOperation } from "../sentry/report";

export function readOllamaConfig(): { baseUrl: string; model: string; timeoutMs: number; apiKey?: string } {
  const internalHost = process.env.OLLAMA_INTERNAL_HOST?.trim();
  const internalPort = process.env.OLLAMA_INTERNAL_PORT?.trim() || "11435";
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  let baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  if (internalHost) {
    if (process.env.RENDER !== "true" || !/^[a-z0-9][a-z0-9-]*$/i.test(internalHost) || internalPort !== "11435") {
      throw new Error("The hosted Ollama address must be a Render private service host on port 11435.");
    }
    if (!apiKey) {
      throw new Error("OLLAMA_API_KEY is required for the Render private Ollama service.");
    }
    baseUrl = `http://${internalHost}:${internalPort}`;
  }
  const model = process.env.OLLAMA_MODEL?.trim() || "gemma3:4b";
  const parsed = new URL(baseUrl);
  const local = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1";
  const renderPrivate = Boolean(internalHost) && process.env.RENDER === "true";
  if (!local && !renderPrivate) {
    throw new Error("Ollama must use local inference or the configured Render private service.");
  }
  const rawTimeout = Number(process.env.OLLAMA_TIMEOUT_MS);
  const timeoutMs = Number.isInteger(rawTimeout) ? Math.min(600_000, Math.max(10_000, rawTimeout)) : 120_000;
  return { baseUrl: parsed.toString().replace(/\/$/, ""), model, timeoutMs, ...(renderPrivate ? { apiKey } : {}) };
}

export function ollamaChat(input: {
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  timeoutMs: number;
}): Promise<unknown> {
  return traceOperation({ name: "Ollama chat", operation: "ollama" }, () => requestOllama(input));
}

export async function checkHostedOllamaHealth(): Promise<void> {
  const { baseUrl, apiKey } = readOllamaConfig();
  if (!apiKey) {
    throw new Error("The Render private Ollama service is not configured.");
  }
  const response = await fetch(new URL("/healthz", baseUrl), {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error("The private Ollama service is not ready.");
  }
}

async function requestOllama(input: {
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  timeoutMs: number;
}): Promise<unknown> {
  const { baseUrl, model, apiKey } = readOllamaConfig();
  const response = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: input.jsonSchema,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}.`);
  }
  const payload = (await response.json()) as { message?: { content?: unknown } };
  const content = payload.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama returned no message content.");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Ollama returned malformed JSON.");
  }
}

export async function requestStructured<T>(input: {
  instruction: string;
  packet: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
}): Promise<T> {
  const { timeoutMs } = readOllamaConfig();
  const system =
    "You are the archival analyst for THE UNCLAIMED. Quiet atmospheric wording is allowed. Historical claims must come only from the evidence packet. Do not invent dates, quotations, URLs, or recovered documents. Use UNRESOLVED when the evidence is insufficient. Return JSON only.";
  let lastError = "The model output was not valid.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reminder =
      attempt === 0 ? "" : `\n\nThe previous response failed validation: ${lastError.slice(0, 400)}. Return only JSON.`;
    try {
      const raw = await ollamaChat({
        system,
        user: `${input.instruction}\n\n${input.packet}${reminder}`,
        jsonSchema: input.jsonSchema,
        timeoutMs,
      });
      return input.schema.parse(raw);
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.message.startsWith("Ollama returned"))) {
        throw error;
      }
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}
