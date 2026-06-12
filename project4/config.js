/**
 * config.js — Project 4 Configuration
 *
 * ─────────────────────────────────────────────────────
 *  CHOOSE YOUR AI API PROVIDER
 * ─────────────────────────────────────────────────────
 *
 *  Supported providers:
 *    • 'anthropic' — Claude (Anthropic)
 *    • 'gemini'    — Google Gemini
 *    • 'openai'    — OpenAI GPT
 *
 *  1. Uncomment your chosen provider below
 *  2. Add your API key
 *  3. Save this file
 *  4. Open index.html with VS Code Live Server
 *
 *  ⚠ IMPORTANT: Never commit this file with real API keys.
 *    It is already in .gitignore for protection.
 */

const CONFIG = {
  /* ═══ CHOOSE YOUR PROVIDER ═══ */
  API_PROVIDER: 'anthropic',  // Change to: 'gemini', 'openai', etc.

  /* ═══ ANTHROPIC (Claude) ═══ */
  ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY_HERE',
  // Get your key: https://console.anthropic.com/

  /* ═══ GOOGLE GEMINI ═══ */
  GOOGLE_GEMINI_API_KEY: 'YOUR_GOOGLE_GEMINI_API_KEY_HERE',
  // Get your key: https://aistudio.google.com/app/apikey

  /* ═══ OPENAI (GPT) ═══ */
  OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY_HERE',
  // Get your key: https://platform.openai.com/api-keys
};
