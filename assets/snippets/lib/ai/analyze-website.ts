// src/lib/ai/analyze-website.ts — Claude web_fetch + structured analysis tool
// Pattern: Anthropic fetches the URL inline (sidesteps bot blocking),
// then returns structured Hebrew analysis via a custom tool.
//
// CRITICAL: tool_choice MUST be "auto", not { type: "tool", name: ... }.
// Forcing the analysis tool blocks web_fetch from running first.
// See references/ai-analysis.md for the full explanation.

import Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_TOOL_DEFINITION,
  ANALYSIS_TOOL_NAME,
} from "./prompts";

export interface AnalysisResult {
  summary: string;
  issues: string[];
  opportunities: string[];
  recommendedServices: string[];
  recommendedNextSteps: string[];
  modelUsed: string;
  raw: unknown;
}

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function analyzeWebsite(url: string): Promise<AnalysisResult> {
  try {
    new URL(url);
  } catch {
    throw new Error("כתובת אתר לא תקינה");
  }

  const client = getClient();

  // ToolUnion[] — explicit type. Plain `Tool[]` is the custom-tool variant
  // and won't accept the server tool object.
  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 2 },
    ANALYSIS_TOOL_DEFINITION,
  ];

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools,
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content:
          `אנא בצע את שני הצעדים הבאים בסדר הזה:\n` +
          `1. השתמש בכלי web_fetch כדי לטעון את התוכן של ${url}\n` +
          `2. נתח את התוכן שטענת והחזר את הניתוח דרך הכלי ${ANALYSIS_TOOL_NAME}.\n\n` +
          `חובה לבצע את שני הצעדים. אל תחזיר טקסט חופשי.`,
      },
    ],
  });

  console.log(
    "[analyze-website] stop_reason:",
    response.stop_reason,
    "blocks:",
    response.content.map((b) => b.type).join(", "),
  );

  if (response.stop_reason === "max_tokens") {
    throw new Error("הניתוח חרג ממגבלת האורך. נסו שוב.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === ANALYSIS_TOOL_NAME,
  );
  if (!toolUse) throw new Error("המודל לא החזיר ניתוח מובנה");

  const input = toolUse.input as Partial<AnalysisResult>;
  const required = [
    "summary",
    "issues",
    "opportunities",
    "recommendedServices",
    "recommendedNextSteps",
  ] as const;
  const missing = required.filter((k) => {
    const v = input[k];
    return v === undefined || (Array.isArray(v) && v.length === 0);
  });
  if (missing.length > 0) {
    throw new Error(`הניתוח לא הושלם — חסרים שדות: ${missing.join(", ")}`);
  }

  return {
    summary: input.summary!,
    issues: input.issues!,
    opportunities: input.opportunities!,
    recommendedServices: input.recommendedServices!,
    recommendedNextSteps: input.recommendedNextSteps!,
    modelUsed: DEFAULT_MODEL,
    raw: response,
  };
}
