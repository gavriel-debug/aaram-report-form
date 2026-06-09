import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base חייב להתאים לשם ה‑repo ב‑GitHub Pages: https://USER.github.io/REPO/
// אם תפרסם דרך דומיין מותאם או repo בשם USER.github.io — שנה ל‑"/".
export default defineConfig({
  base: "/aaram-report-form/",
  plugins: [react()],
});
