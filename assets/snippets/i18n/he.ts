// src/i18n/he.ts — single source of truth for Hebrew strings.
// Replace domain-specific sections (`leads`, `meetings`) for your project.
// Keep meta sections (`auth`, `common`, `errors`, `theme`, `nav`) as-is.

export const t = {
  app: {
    name: "REPLACE_APP_NAME",
    tagline: "REPLACE_APP_TAGLINE",
  },
  nav: {
    dashboard: "דשבורד",
    leads: "לידים",
    meetings: "פגישות",
    settings: "הגדרות",
    logout: "התנתקות",
  },
  auth: {
    login: "התחברות",
    signup: "הרשמה",
    email: "אימייל",
    password: "סיסמה",
    fullName: "שם מלא",
    loginAction: "כניסה למערכת",
    signupAction: "יצירת חשבון",
    haveAccount: "יש לך כבר חשבון?",
    noAccount: "אין לך חשבון?",
    invalidCredentials: "אימייל או סיסמה שגויים",
    welcomeBack: "ברוכים השבים",
    createAccount: "צרו חשבון חדש",
    loginSubtitle: "התחברו כדי להמשיך",
    signupSubtitle: "צרו חשבון חדש בחינם",
  },
  theme: {
    switchToDark: "עבור למצב כהה",
    switchToLight: "עבור למצב בהיר",
  },
  common: {
    loading: "טוען...",
    saving: "שומר...",
    confirm: "אישור",
    cancel: "ביטול",
    edit: "עריכה",
    delete: "מחיקה",
    create: "יצירה",
    save: "שמירה",
    back: "חזרה",
    next: "הבא",
    previous: "הקודם",
    actions: "פעולות",
    yes: "כן",
    no: "לא",
    optional: "אופציונלי",
  },
  errors: {
    generic: "אירעה שגיאה. אנא נסו שוב.",
    notFound: "הפריט לא נמצא",
    unauthorized: "אין הרשאה",
    invalidInput: "קלט לא תקין",
    networkError: "תקלת רשת",
  },
  // ─── Domain-specific (REPLACE for new project) ─────────────────
  leads: {
    title: "לידים",
    new: "ליד חדש",
    none: "אין עדיין לידים",
    fields: {
      fullName: "שם מלא",
      email: "אימייל",
      phone: "טלפון",
      company: "חברה",
      websiteUrl: "אתר אינטרנט",
      status: "סטטוס",
      notes: "הערות",
      createdAt: "נוצר ב",
    },
    status: {
      NEW: "ליד חדש",
      MEETING_SCHEDULED: "נקבעה פגישה",
      MEETING_COMPLETED: "פגישה הושלמה",
      DEAL_CLOSED: "עסקה נסגרה",
      DEAL_LOST: "עסקה אבדה",
    },
  },
} as const;
