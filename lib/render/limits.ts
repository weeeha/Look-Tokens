// The only place the render model, the Runway ratio and the cost live.
// Source for every value: docs/superpowers/plans/2026-10-19-look-tokens-local-render.md,
// section "Verified facts" (Runway docs, read 2026-10-19).

// Table row "Required fields": model for POST /v1/text_to_image.
export const RENDER_MODEL = "gen4_image";

// Table row "Ratio": engine 16:9 maps to the 720p option 1280:720.
export const RUNWAY_RATIO: Record<"16:9", "1280:720"> = { "16:9": "1280:720" };

// Table row "Credits per image": gen4_image, 5 credits per 720p image.
export const CREDITS_PER_IMAGE = 5;

// Table row "Prompt limit": promptText is 1 to 1000 UTF-16 code units, i.e. string.length.
export const MAX_PROMPT = 1000;
