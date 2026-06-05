import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.MIMO_API_KEY;
const baseUrl = (process.env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1").replace(/\/$/, "");
const outDir = process.env.MIMO_VOICE_OUT_DIR ?? "public/assets/audio/voices";

if (!apiKey) {
  throw new Error("Missing MIMO_API_KEY");
}

const clips = [
  {
    id: "voice-hero-attack",
    voice: "苏打",
    instruction: "英雄式中文男声，明亮、坚定、短促有力，适合 5-6 岁孩子的热血战斗游戏，不要拖长。",
    text: "(兴奋 坚定 提高音量)看我的！"
  },
  {
    id: "voice-hero-special",
    voice: "苏打",
    instruction: "英雄式中文男声，激昂、凌厉、有必杀技启动感，语速中等偏快，清楚喊出每个字。",
    text: "(激昂 凌厉 提高音量)必杀光线！"
  },
  {
    id: "voice-hero-hurt",
    voice: "苏打",
    instruction: "英雄式中文男声，受击后吃力但不沮丧，儿童游戏里非常短的受击反馈。",
    text: "(短促 坚定)别怕！"
  },
  {
    id: "voice-hero-win",
    voice: "苏打",
    instruction: "英雄式中文男声，开心、明亮、鼓励孩子，像通关后的正向反馈，语气不要夸张刺耳。",
    text: "(开心 明亮)太好了，我们赢啦！"
  },
  {
    id: "voice-monster-attack",
    voice: "白桦",
    instruction: "低沉沙哑的中文怪兽感男声，愤怒但不要恐怖，适合儿童游戏，短促有冲击力。",
    text: "(愤怒 低沉 短促)吼！"
  },
  {
    id: "voice-monster-defeat",
    voice: "白桦",
    instruction: "低沉沙哑的中文怪兽感男声，被击败时痛苦但不吓人，必须非常短，不要拖长。",
    text: "(痛苦 短促)啊！"
  },
  {
    id: "voice-monster-win",
    voice: "白桦",
    instruction: "低沉沙哑的中文怪兽感男声，得意但不恐怖，像儿童游戏里的失败提示，语气短促。",
    text: "(得意 低沉)再来吧！"
  }
];

function parseResponsePayloads(rawText) {
  const text = rawText.trim();
  if (!text.startsWith("data:")) return [JSON.parse(text)];

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map((line) => JSON.parse(line));
}

function collectAudioBuffers(payloads) {
  const buffers = [];
  for (const payload of payloads) {
    for (const choice of payload?.choices ?? []) {
      const audioData = choice?.message?.audio?.data ?? choice?.delta?.audio?.data;
      if (audioData) buffers.push(Buffer.from(audioData, "base64"));
    }
  }
  return buffers;
}

await mkdir(outDir, { recursive: true });

const selectedIds = new Set((process.env.MIMO_VOICE_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
const selectedClips = selectedIds.size > 0 ? clips.filter((clip) => selectedIds.has(clip.id)) : clips;

if (selectedIds.size > 0 && selectedClips.length !== selectedIds.size) {
  const knownIds = new Set(clips.map((clip) => clip.id));
  const unknownIds = [...selectedIds].filter((id) => !knownIds.has(id));
  throw new Error(`Unknown MIMO_VOICE_IDS: ${unknownIds.join(", ")}`);
}

for (const clip of selectedClips) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mimo-v2.5-tts",
      stream: false,
      messages: [
        { role: "user", content: clip.instruction },
        { role: "assistant", content: clip.text }
      ],
      audio: {
        format: "wav",
        voice: clip.voice
      }
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${clip.id} failed: ${response.status} ${text.slice(0, 500)}`);
  }

  const rawText = await response.text();
  const payloads = parseResponsePayloads(rawText);
  const audioBuffers = collectAudioBuffers(payloads);
  if (audioBuffers.length === 0) {
    throw new Error(`${clip.id} missing message.audio.data or delta.audio.data`);
  }

  const filePath = path.join(outDir, `${clip.id}.wav`);
  await writeFile(filePath, Buffer.concat(audioBuffers));
  console.log(`wrote ${filePath}`);
}
