import {
  assertDuration,
  assertOutputName,
  assertSoundModel,
  defaultOutputFormat,
  defaultSoundModel,
  defaultSpeechModel,
  type AudioAsset,
} from "./library";

export type GenerationRequest = {
  url: string;
  body: Record<string, unknown>;
};

export type GenerationOptions = {
  model?: string;
  durationSeconds?: number;
  prompt?: string;
  voiceId?: string;
  outputFormat?: string;
};

const speechSettings = {
  stability: 0.4,
  similarity_boost: 0.8,
  style: 0.35,
  use_speaker_boost: true,
  speed: 0.85,
};

export function buildGenerationRequest(asset: AudioAsset, options: GenerationOptions = {}): GenerationRequest {
  const text = options.prompt?.trim() || asset.text;
  if (!text) {
    throw new Error("The prompt is empty.");
  }
  const outputFormat = options.outputFormat?.trim() || defaultOutputFormat;
  if (asset.kind === "sound") {
    const model = assertSoundModel(options.model?.trim() || defaultSoundModel);
    const duration = assertDuration(options.durationSeconds ?? asset.durationSeconds ?? 2);
    const url = new URL("https://api.elevenlabs.io/v1/sound-generation");
    url.searchParams.set("output_format", outputFormat);
    return {
      url: url.toString(),
      body: {
        text,
        model_id: model,
        duration_seconds: duration,
        prompt_influence: 0.75,
        loop: asset.loop === true,
      },
    };
  }

  const voiceId = options.voiceId?.trim() ?? "";
  if (!/^[A-Za-z0-9]+$/.test(voiceId)) {
    throw new Error("Set ELEVENLABS_VOICE_ID to a voice you are allowed to use. Speech is not generated without it.");
  }
  const model = options.model?.trim() || defaultSpeechModel;
  if (!model) {
    throw new Error("The speech model is empty.");
  }
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
  url.searchParams.set("output_format", outputFormat);
  return {
    url: url.toString(),
    body: {
      text,
      model_id: model,
      voice_settings: speechSettings,
    },
  };
}

export function describeElevenLabsError(status: number, body: string, apiKey: string): string {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      detail = parsed.detail;
    } else if (Array.isArray(parsed.detail)) {
      detail = parsed.detail
        .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : ""))
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    detail = "";
  }
  const cleaned = apiKey ? detail.split(apiKey).join("[redacted]") : detail;
  return cleaned ? `ElevenLabs returned ${status}. ${cleaned}` : `ElevenLabs returned ${status}.`;
}

export async function requestAudio(
  request: GenerationRequest,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  if (!apiKey.trim()) {
    throw new Error("ELEVENLABS_API_KEY is not set.");
  }
  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(120_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || type.includes("application/json") || type.includes("text/")) {
    throw new Error(describeElevenLabsError(response.status, bytes.toString("utf8"), apiKey));
  }
  if (bytes.length === 0) {
    throw new Error(`ElevenLabs returned ${response.status} with an empty file.`);
  }
  return bytes;
}

export { assertOutputName };
