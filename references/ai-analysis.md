# AI Analysis Recipe — Claude `web_fetch` + Custom Tool

The pattern for "fetch a URL, run an analysis, return structured output." Used in JackCRM for website analysis; adaptable to any URL-based analysis task.

## Why this is non-obvious

The intuitive approach — fetch the URL on your server with `node-fetch` + parse with `cheerio` + send the HTML to Claude — fails for two reasons:

1. **Vercel's data-center IPs get blocked.** Sites with bot protection (Cloudflare, Akamai, even modest WAFs) treat AWS-range IPs as suspicious and reject the request even with a real-browser User-Agent.
2. **Maintenance overhead.** You spend energy on User-Agent games, encoding fixes, redirect handling, JS rendering, etc.

The alternative — Claude's `web_fetch_20260209` server tool — sidesteps both:
- Anthropic's infrastructure fetches the URL, not yours
- Claude sees the content directly, no parsing layer needed
- One round-trip, one billing line

## The tool_choice gotcha

Two-tool setup: Anthropic's `web_fetch` (server tool) + your custom analysis tool (e.g., `submit_website_analysis`). The seemingly obvious config:

```ts
tool_choice: { type: "tool", name: "submit_website_analysis" },  // ❌ DOESN'T WORK
```

This forces the model to call your analysis tool **immediately** — it doesn't get to call `web_fetch` first. You get back a placeholder analysis like "I couldn't fetch the URL."

The fix:

```ts
tool_choice: { type: "auto" },  // ✅ allows web_fetch first, then submit
```

Plus an explicit user-prompt sequence to keep the model on rails:

```
1. Use web_fetch to load the URL.
2. Analyze the content and return via submit_website_analysis.
You MUST do both. Don't return free text.
```

## Full implementation — `src/lib/ai/analyze-website.ts`

```ts
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

  // ToolUnion[] — the union type. Plain `Tool[]` is the custom-tool variant only
  // and won't accept the server tool object. Always type the array explicitly.
  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 2 },
    ANALYSIS_TOOL_DEFINITION,
  ];

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 8192,  // Hebrew tokenizes more aggressively than English
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },  // ~70% token savings on repeat analyses
      },
    ],
    tools,
    tool_choice: { type: "auto" },  // NOT { type: "tool", name: ... } — see gotcha above
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
    throw new Error("הניתוח חרג ממגבלת האורך. נסו שוב או צמצמו את גודל הדף.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === ANALYSIS_TOOL_NAME,
  );
  if (!toolUse) throw new Error("המודל לא החזיר ניתוח מובנה");

  const input = toolUse.input as Partial<AnalysisResult>;
  const required = ["summary", "issues", "opportunities", "recommendedServices", "recommendedNextSteps"] as const;
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
```

## The system prompt + tool schema — `src/lib/ai/prompts.ts`

```ts
import type Anthropic from "@anthropic-ai/sdk";

export const ANALYSIS_SYSTEM_PROMPT = `אתה אנליסט שיווקי דיגיטלי...
[full Hebrew prompt that defines the analysis quality bar]`;

export const ANALYSIS_TOOL_NAME = "submit_website_analysis";

export const ANALYSIS_TOOL_DEFINITION: Anthropic.Tool = {
  name: ANALYSIS_TOOL_NAME,
  description: "החזרת ניתוח מובנה...",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: { type: "string", description: "..." },
      issues: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
      opportunities: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
      recommendedServices: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
      recommendedNextSteps: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    },
    required: ["summary", "issues", "opportunities", "recommendedServices", "recommendedNextSteps"],
  },
};
```

The `as Anthropic.Tool` annotation is critical — without it, TypeScript infers a too-narrow type that breaks when mixed with the server tool in the `tools` array.

## The route handler — sanitize errors

```ts
} catch (err) {
  console.error("Analysis failed", err);
  const raw = err instanceof Error ? err.message : "שגיאה לא ידועה";
  // Never leak Prisma stack traces or framework internals to the UI
  const sanitized =
    raw.length > 200 || /\b(invocation|prisma|stack|TypeError)\b/i.test(raw)
      ? "ניתוח האתר נכשל. אנא נסו שוב."
      : raw;
  return NextResponse.json({ error: sanitized }, { status: 500 });
}
```

## SDK version

Web fetch type lives in `@anthropic-ai/sdk` 0.95+. Older versions don't have it; `@anthropic-ai/sdk@latest` is fine.

## Cost notes

- `web_fetch` is ~$0.01–0.02 per analysis depending on page size
- Output tokens cap at 8K (don't lower this; Hebrew tokenization is hungry)
- System prompt cached as ephemeral → ~70% token savings on repeated analyses within 5 minutes
- Total per analysis: typically ~$0.02–0.05 with Sonnet 4.6

## Adapting to other domains

Same pattern, different prompt + schema:

| Domain | Tool name | Schema fields |
|---|---|---|
| Job posting analysis | `submit_job_analysis` | `requiredSkills`, `salaryRange`, `redFlags`, `cultureSignals` |
| Competitor product page | `submit_competitor_analysis` | `positioning`, `usps`, `pricing`, `gaps`, `tactics` |
| Property listing | `submit_property_analysis` | `condition`, `location_quality`, `comparables`, `red_flags` |
| Restaurant menu URL | `submit_menu_analysis` | `dishes`, `priceTier`, `cuisine`, `dietary_options` |

Just swap `ANALYSIS_SYSTEM_PROMPT`, the tool's `description`, and the `input_schema` properties. The infrastructure stays.
