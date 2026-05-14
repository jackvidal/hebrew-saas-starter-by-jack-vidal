import Anthropic from "@anthropic-ai/sdk";

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

const SYSTEM_PROMPT = `אתה עוזר אישי לבעל עסק קטן בישראל שמנהל לקוחות פוטנציאליים דרך וואטסאפ.
המשימה שלך: לקרוא את שרשור השיחה עם הלקוח ולהציע **תגובה מקצועית, אישית, ובעברית טבעית** שהבעל יוכל לשלוח כתשובה.

עקרונות:
- כתוב בעברית בלבד, בטון ידידותי-מקצועי (לא רשמי מדי, לא רחוב מדי).
- קצר וענייני — 1-3 משפטים. וואטסאפ זה לא אימייל.
- ענה ישירות למה שהלקוח אמר במסר האחרון.
- אם הלקוח שאל שאלה — תן תשובה ברורה. אם חסר מידע — תציע להמשיך בשיחת טלפון או פגישה.
- אל תכלול ברכה ("היי", "שלום") אלא אם זו ההודעה הראשונה בשרשור.
- אל תחתום בשם/חתימה.
- אם הלקוח שלח אימוג'י או הביע רגש — את היכול להתאים את הטון.

החזר אך ורק את טקסט התגובה המוצעת, בלי הקדמה, בלי הסברים, בלי גרשיים. רק הטקסט שאני אעתיק ואשלח.`;

export interface ThreadMessage {
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  sentAt: Date;
}

export async function draftWhatsappReply(
  thread: ThreadMessage[],
  leadName: string | null,
): Promise<{ text: string; modelUsed: string }> {
  const cleaned = thread.filter((m) => m.body && m.body.trim());
  if (cleaned.length === 0) {
    throw new Error("אין הודעות בשרשור לניתוח");
  }

  const formatted = cleaned
    .slice(-30) // last 30 messages is plenty of context
    .map((m) => {
      const speaker = m.direction === "INBOUND" ? "הלקוח" : "אני";
      return `[${speaker}]: ${m.body}`;
    })
    .join("\n");

  const userPrompt = `שרשור השיחה עם ${leadName ? `הלקוח "${leadName}"` : "הלקוח"}:

${formatted}

הצע תגובה לשלוח עכשיו.`;

  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  if (!text) {
    throw new Error("Claude לא החזיר טקסט");
  }
  return { text, modelUsed: DEFAULT_MODEL };
}
