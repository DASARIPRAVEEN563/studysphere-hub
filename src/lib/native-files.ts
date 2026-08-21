/**
 * Saving downloaded notes.
 *
 * Inside the installed Android app (Capacitor) the file is written into the
 * app's own Documents folder — `Android/data/app.lovable.sknsh/files/Documents/SKNSH`
 * — exactly like WhatsApp keeps its media in internal app storage. The file then
 * stays on the phone and can be reopened without internet.
 *
 * In a normal browser it falls back to a plain download link.
 */

const FOLDER = "SKNSH";

function browserSave(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function toBase64(url: string) {
  const blob = await (await fetch(url)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Returns the on-device path when saved natively, otherwise null. */
export async function saveFileToDevice(url: string, fileName: string): Promise<string | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      browserSave(url, fileName);
      return null;
    }
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const data = await toBase64(url);
    try {
      await Filesystem.mkdir({ path: FOLDER, directory: Directory.Documents, recursive: true });
    } catch {
      /* folder already exists */
    }
    const saved = await Filesystem.writeFile({
      path: `${FOLDER}/${fileName}`,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    return saved.uri;
  } catch {
    browserSave(url, fileName);
    return null;
  }
}

/** Opens a note that was already saved into the app's internal storage. */
export async function openSavedFile(fileName: string) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { uri } = await Filesystem.getUri({
    path: `${FOLDER}/${fileName}`,
    directory: Directory.Documents,
  });
  return uri;
}
