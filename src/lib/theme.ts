export const THEMES = [
  { id: "dark", label: "Midnight Dark", hint: "Purple / cyan glass (default)" },
  { id: "light", label: "Daylight", hint: "Creamy white and violet" },
  { id: "ocean", label: "Ocean Blue", hint: "Deep sea blue and teal" },
  { id: "sunset", label: "Sunset", hint: "Warm orange and pink" },
  { id: "forest", label: "Forest", hint: "Green and lime" },
  { id: "candy", label: "Candy Pop", hint: "Bright pink and sky" },
  { id: "royal", label: "Royal Violet", hint: "Deep violet and gold" },
  { id: "aurora", label: "Aurora", hint: "Teal, mint and magenta glow" },
  { id: "neon", label: "Neon Night", hint: "Electric magenta and cyan" },
  { id: "coffee", label: "Coffee", hint: "Warm mocha and caramel" },
  { id: "mint", label: "Mint Light", hint: "Fresh light mint and aqua" },
  { id: "sand", label: "Desert Sand", hint: "Soft light sand and clay" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

/** Themes that use a light background — the `dark` class must be off for them. */
const LIGHT: string[] = ["light", "mint", "sand"];

const KEY = "sknsh-theme";

export function getTheme(): ThemeId {
  if (typeof window === "undefined") return "dark";
  const v = localStorage.getItem(KEY) as ThemeId | null;
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : "dark";
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", id);
  root.classList.toggle("dark", !LIGHT.includes(id));
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new Event("sknsh-theme"));
}
