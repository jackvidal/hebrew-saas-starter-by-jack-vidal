import type Anthropic from "@anthropic-ai/sdk";

export const CALL_ANALYSIS_SYSTEM_PROMPT = `אתה מאמן מכירות מנוסה ויועץ עסקי. תפקידך לנתח שיחות בין איש מכירות ללקוח פוטנציאלי, ולחלץ ממן תובנות מעשיות, ספציפיות, ושימושיות.

תקבל תמלול מלא של שיחה. עליך להחזיר ניתוח מובנה בעברית הכולל:

1. **סיכום השיחה** — 2 עד 3 משפטים בעברית פשוטה: מה דובר, איך הסתיים, מה ההקשר.
2. **נושאים מרכזיים** — רשימה קצרה של הנושאים שעלו (2 עד 6 פריטים).
3. **תחושת השיחה** — חיובית / נייטרלית / שלילית — בהתבסס על טון הלקוח, סימני התעניינות, חששות. הוסף נימוק של משפט אחד.
4. **התחייבויות מהלקוח** — מה הלקוח אמר שהוא יעשה (יבדוק, יחזור עם תשובה, יחתום, יציג למנהל וכו'). אם הלקוח לא התחייב לכלום — מערך ריק.
5. **ההתחייבויות שלי** (איש המכירות) — מה איש המכירות אמר שיעשה (ישלח, יחזור עם הצעה, יבדוק תאריך וכו'). חשוב במיוחד — אלה הופכים למשימות אוטומטיות.
6. **צעדים מומלצים** — מה הצעדים הבאים הטקטיים שאיש המכירות צריך לעשות כדי לקדם את העסקה. 2 עד 5 פריטים, ספציפיים.
7. **דגלים אדומים** — סיכונים, חששות, סימני אזהרה (כמו "מזכיר מתחרה", "מתלבט בלי סוף", "תקציב מוגבל"). אם אין — מערך ריק.

חוקים חשובים:
- כל המידע **בעברית בלבד**.
- היה ספציפי לשיחה הזו ולא קלישאות גנריות ("לעקוב אחרי הליד" — לא, "לשלוח הצעת מחיר מותאמת עד יום שני" — כן).
- אם השיחה קצרה או חסרת מידע — ציין את זה בסיכום אבל אל תמציא פרטים.
- ההתחייבויות והצעדים המומלצים צריכים להיות פעולות שאפשר לבצע — לא "להמשיך בקשר".
- החזר את התוצאה בקריאה ל־tool בלבד. אל תחזיר טקסט חופשי.`;

export const CALL_ANALYSIS_TOOL_NAME = "submit_call_analysis";

export const CALL_ANALYSIS_TOOL_DEFINITION: Anthropic.Tool = {
  name: CALL_ANALYSIS_TOOL_NAME,
  description: "החזרת ניתוח מובנה של שיחת מכירות. כל השדות בעברית, ספציפיים, ומעשיים.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "סיכום השיחה — 2 עד 3 משפטים בעברית.",
      },
      keyTopics: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8,
        description: "נושאים מרכזיים שעלו בשיחה.",
      },
      sentiment: {
        type: "string",
        enum: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
        description: "תחושה כללית של השיחה.",
      },
      sentimentReason: {
        type: "string",
        description: "משפט אחד שמסביר את הערכת התחושה.",
      },
      prospectCommitments: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
        description:
          "מה הלקוח התחייב לעשות. מערך ריק אם לא התחייב לכלום.",
      },
      myCommitments: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
        description:
          "מה איש המכירות התחייב לעשות. אלה הופכים למשימות אוטומטיות — תהיה ספציפי.",
      },
      recommendedNextSteps: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 6,
        description:
          "צעדים מומלצים לקידום העסקה. פעולות קונקרטיות, לא קלישאות.",
      },
      redFlags: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
        description: "דגלים אדומים / סיכונים. מערך ריק אם אין.",
      },
    },
    required: [
      "summary",
      "keyTopics",
      "sentiment",
      "sentimentReason",
      "prospectCommitments",
      "myCommitments",
      "recommendedNextSteps",
      "redFlags",
    ],
  },
};
