import { readFileSync } from "node:fs";
import { translations } from "../src/lib/i18n.js";

const ACTIVE_SOURCE_FILES = [
  "src/App.jsx",
  "src/components/AIInsights.jsx",
  "src/components/AddForm.jsx",
  "src/components/AnalyticsReports.jsx",
  "src/components/Dashboard.jsx",
  "src/components/DocumentsVault.jsx",
  "src/components/GoalsTargets.jsx",
  "src/components/History.jsx",
  "src/components/ImportPage.jsx",
  "src/components/LoginPage.jsx",
  "src/components/NetWorthTracker.jsx",
  "src/components/Settings.jsx",
  "src/components/TimelineView.jsx",
];

const SUPPORTED_LANGUAGES = ["ta", "ml", "kn", "te", "hi"];
const INDIC_RANGES = {
  ta: /[\u0B80-\u0BFF]/,
  ml: /[\u0D00-\u0D7F]/,
  kn: /[\u0C80-\u0CFF]/,
  te: /[\u0C00-\u0C7F]/,
  hi: /[\u0900-\u097F]/,
};

const tCallPattern = /t\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/g;
const missing = [];

for (const file of ACTIVE_SOURCE_FILES) {
  const source = readFileSync(file, "utf8");
  let match;
  while ((match = tCallPattern.exec(source))) {
    const [, key, fallback] = match;
    if (!/[A-Za-z]/.test(fallback)) continue;
    for (const language of SUPPORTED_LANGUAGES) {
      if (!translations[language]?.[key]) {
        missing.push(`${file}: ${key} missing for ${language}`);
      }
    }
  }
}

const wrongScript = [];
for (const language of SUPPORTED_LANGUAGES) {
  for (const [key, value] of Object.entries(translations[language] || {})) {
    if (typeof value !== "string") continue;
    for (const [otherLanguage, range] of Object.entries(INDIC_RANGES)) {
      if (otherLanguage !== language && range.test(value)) {
        wrongScript.push(`${language}.${key} contains ${otherLanguage} script: ${value}`);
      }
    }
  }
}

if (missing.length || wrongScript.length) {
  if (missing.length) {
    console.error("\nMissing active UI translations:");
    for (const item of missing) console.error(`- ${item}`);
  }
  if (wrongScript.length) {
    console.error("\nWrong-script translation entries:");
    for (const item of wrongScript) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("i18n check passed: active UI keys are complete and Indic scripts are consistent.");
