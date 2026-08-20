import { useEffect, useState } from "react";
import { toast } from "sonner";
import { btnClass } from "./Field";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Add to mobile" tile: opens the browser install prompt so the hub lands on the
 * phone home screen with the project logo as its icon.
 */
export function InstallApp() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) {
      setHelp(true);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") toast.success("Installing on your home screen…");
    setDeferred(null);
  };

  return (
    <section className="glass animate-rise rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <img
          src="/app-icon-192.png"
          alt="Students Ka Notes Sharing Hub icon"
          loading="lazy"
          width={48}
          height={48}
          className="size-12 rounded-2xl shadow-lg"
        />
        <div className="min-w-0">
          <h3 className="text-lg font-black">📲 Add to mobile</h3>
          <p className="text-muted-foreground text-xs">
            Install the hub on your phone home screen with the app logo icon.
          </p>
        </div>
      </div>
      {installed ? (
        <p className="text-cyan mt-4 text-sm font-bold">✅ Already installed on this device</p>
      ) : (
        <button type="button" onClick={() => void install()} className={`${btnClass} mt-4 w-full`}>
          Add to home screen
        </button>
      )}
      {help && !installed && (
        <p className="text-muted-foreground mt-3 text-xs">
          If nothing opened, use your browser menu: Chrome → ⋮ → “Install app / Add to Home screen”,
          Safari → Share → “Add to Home Screen”.
        </p>
      )}
    </section>
  );
}