import { useEffect, useState } from "react";
import { toast } from "sonner";
import { applyTheme, getTheme, THEMES, type ThemeId } from "@/lib/theme";
import { Field, inputClass } from "@/components/Field";

/** Theme dropdown — switches the whole interface palette instantly. */
export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>("dark");

  useEffect(() => {
    const t = getTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  const change = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
    toast.success(`${THEMES.find((t) => t.id === id)?.label} theme applied`);
  };

  const current = THEMES.find((t) => t.id === theme);

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <h3 className="text-lg font-black">Appearance</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Pick a theme — the whole website changes instantly.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Theme">
          <select
            className={inputClass}
            value={theme}
            onChange={(e) => change(e.target.value as ThemeId)}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id} className="bg-card">
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="hero-gradient glow grid h-12 w-24 place-items-center rounded-2xl text-xs font-black text-white">
          Preview
        </div>
      </div>
      {current && <p className="text-muted-foreground mt-2 text-xs">{current.hint}</p>}
    </section>
  );
}
