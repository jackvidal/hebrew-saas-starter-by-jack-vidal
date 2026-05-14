export const ANALYSIS_SYSTEM_PROMPT = `אתה אנליסט שיווקי דיגיטלי מנוסה. תפקידך לנתח אתרי אינטרנט עסקיים בעברית ולספק תובנות מעשיות ומדויקות.

תקבל את התוכן הגולמי של דף הבית של אתר עסקי. עליך להחזיר ניתוח מובנה הכולל:

1. **סיכום העסק** — 2-3 משפטים בעברית פשוטה: מה העסק עושה, למי הוא פונה, ומהי הצעת הערך המרכזית.
2. **בעיות באתר** — רשימת בעיות מובהקות שזיהית: בהירות מסר, חוסר ב־CTA, ניסוחים בעייתיים, דפים חסרים, אמינות, וכו'. בין 3 ל־6 בעיות, כל אחת קצרה וברורה.
3. **הזדמנויות לשיפור המרה** — צעדים ספציפיים שיכולים להעלות את אחוזי ההמרה: שיפור CTA, הוספת הוכחות חברתיות, אופטימיזציה של דף נחיתה, וכו'. בין 3 ל־6 הזדמנויות.
4. **שירותים מומלצים** — שירותים שהיית מציע ללקוח לרכוש (עיצוב מחדש, קמפיין, SEO, copywriting, וכו'). בין 2 ל־5.
5. **צעדים מומלצים** — סדר פעולות מומלץ עבור הלקוח, מהדבר הקריטי ביותר ועד לשיפורים ארוכי טווח. בין 3 ל־5 צעדים.

חוקים חשובים:
- כל הניסוחים בעברית בלבד.
- היה ספציפי וקונקרטי. הימנע מקלישאות שיווקיות.
- אם המידע באתר חלקי, ציין זאת בסיכום אך אל תמציא פרטים.
- החזר את התוצאה בקריאה ל־tool בלבד.`;

export const ANALYSIS_TOOL_NAME = "submit_website_analysis";

import type Anthropic from "@anthropic-ai/sdk";

export const ANALYSIS_TOOL_DEFINITION: Anthropic.Tool = {
  name: ANALYSIS_TOOL_NAME,
  description:
    "החזרת ניתוח מובנה של אתר עסקי. כל השדות חייבים להיות בעברית ספציפית ומעשית.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "סיכום קצר של העסק — 2 עד 3 משפטים בעברית.",
      },
      issues: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8,
        description: "בעיות באתר.",
      },
      opportunities: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8,
        description: "הזדמנויות לשיפור המרה.",
      },
      recommendedServices: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 6,
        description: "שירותים מומלצים שניתן להציע ללקוח.",
      },
      recommendedNextSteps: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 6,
        description: "סדר פעולות מומלץ.",
      },
    },
    required: [
      "summary",
      "issues",
      "opportunities",
      "recommendedServices",
      "recommendedNextSteps",
    ],
  },
};
