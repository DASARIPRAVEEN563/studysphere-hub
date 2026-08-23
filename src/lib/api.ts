import { offlineRequest, offlineStudentsCsv } from "./offline-backend";

/**
 * When empty (the default), every request is served by the built-in cloud
 * backend so sign-up, login and uploads always hit the same data store.
 * Set VITE_API_URL only when a matching Flask server is running.
 */
export const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

export const DEPARTMENTS = [
  "AMIL & CSM",
  "CSE",
  "ECE",
  "EEE",
  "MECH",
  "CIVIL",
] as const;
export const YEARS = ["1 Year", "2 Year", "3 Year", "4 Year"] as const;
export const SEMESTERS = ["1 Sem", "2 Sem"] as const;

export type User = {
  id: string;
  fullName: string;
  registrationId: string;
  email?: string | null;
  department: string;
  year: string;
  semester: string;
  role: "student" | "admin";
  profilePicture?: string | null;
  sharedCount: number;
  downloadedCount: number;
  stars?: number;
  faceVerified?: boolean;
  faceImage?: string | null;
  faceVerifiedAt?: string | null;
  /** True once the student clicked "It's me" in the verification email. */
  identityConfirmed?: boolean;
  /** Raised by a student who cannot finish camera/email verification. */
  accessRequested?: boolean;
  accessRequestedAt?: string | null;
  accessRequestNote?: string | null;
  /** Features an admin has taken away after misbehaviour. */
  blocked?: AccessArea[];
};

/** Areas an admin can reject access to from the "Access reject" tab. */
export const ACCESS_AREAS = ["chat", "share", "feedback"] as const;
export type AccessArea = (typeof ACCESS_AREAS)[number];

export type Note = {
  id: string;
  subject: string;
  fileName: string;
  department: string;
  year: string;
  semester: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedById?: string;
  uploadedAt: string;
  /** Optional extra note the uploader typed — shown between brackets. */
  note?: string | null;
  driveFileId?: string | null;
  /** Set when the file lives inside an admin-managed folder (Mid 1, Mid 2…). */
  folderId?: string | null;
  likes?: number;
  likedByMe?: boolean;
  views?: number;
  downloads?: number;
};

/** Admin-managed folder inside a semester. Only admins can put files in it. */
export type Folder = {
  id: string;
  name: string;
  /** Optional short description an admin can add to the folder. */
  description?: string | null;
  department: string;
  year: string;
  semester: string;
  createdAt: string;
};

/** A deleted record kept for 10 days so an admin can restore it. */
export type TrashItem = {
  id: string;
  kind: "note" | "user" | "content" | "feedback" | "chat" | "folder";
  label: string;
  detail?: string;
  deletedAt: string;
  deletedBy?: string;
  payload: any;
};

export type ContentItem = {
  id: string;
  type: "gallery" | "timetable" | "promotion" | "video" | "notice" | "advertisement";
  title: string;
  description?: string;
  url?: string;
  badge?: string;
  effect?: string;
  pinned?: boolean;
  createdAt: string;
};

export type Feedback = {
  id: string;
  userName: string;
  registrationId: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  userId: string;
  from: "user" | "admin";
  text: string;
  image?: string | null;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  read?: boolean;
};

export type LeaderRow = {
  id: string;
  fullName: string;
  registrationId: string;
  department: string;
  shares: number;
  likes: number;
};

export type ChatThread = {
  userId: string;
  fullName: string;
  registrationId: string;
  department: string;
  year: string;
  semester: string;
  profilePicture?: string | null;
  messages: ChatMessage[];
};

/** Live hub-wide counters shown on the home page. */
export type HubStats = {
  users: number;
  shares: number;
  downloads: number;
  views: number;
};

/**
 * Students see a sharer's name without the part before the first space
 * (e.g. "DASARI PRAVEEN" → "PRAVEEN"). Admins always see the full name.
 */
export function sharerName(fullName: string, isAdmin = false) {
  if (isAdmin) return fullName;
  const rest = fullName.trim().split(/\s+/).slice(1).join(" ");
  return rest || fullName;
}


const TOKEN_KEY = "sknsh_token";
const USER_KEY = "sknsh_user";
/** Cached app document — dropped first when the browser storage runs out. */
const CACHE_KEY = "sknsh_offline_db";

/** Never keep heavy payloads (base64 face photo) in the session copy — it blows the storage quota. */
function slimUser(user: User): User {
  return { ...user, faceImage: null, profilePicture: user.profilePicture ?? null };
}

/**
 * The session must survive even when localStorage is full (this is what made
 * some students bounce straight back to the login page): we keep an in-memory
 * copy, mirror it into sessionStorage, and free the cached document before
 * giving up on localStorage.
 */
const memory: Record<string, string | null> = {};

function safeSet(key: string, value: string) {
  memory[key] = value;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(key, value);
    } catch {
      console.warn("Local storage is full — the session is kept in memory for this tab.");
    }
  }
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (memory[key]) return memory[key] ?? null;
  let value: string | null = null;
  try {
    value = localStorage.getItem(key);
  } catch {
    /* ignore */
  }
  if (!value) {
    try {
      value = sessionStorage.getItem(key);
    } catch {
      /* ignore */
    }
  }
  if (value) memory[key] = value;
  return value;
}

function safeRemove(key: string) {
  delete memory[key];
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const auth = {
  token(): string | null {
    return safeGet(TOKEN_KEY);
  },
  user(): User | null {
    const raw = safeGet(USER_KEY);
    try {
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  save(token: string, user: User) {
    safeSet(TOKEN_KEY, token);
    safeSet(USER_KEY, JSON.stringify(slimUser(user)));
    window.dispatchEvent(new Event("sknsh-auth"));
  },
  setUser(user: User) {
    safeSet(USER_KEY, JSON.stringify(slimUser(user)));
    window.dispatchEvent(new Event("sknsh-auth"));
  },
  clear() {
    safeRemove(TOKEN_KEY);
    safeRemove(USER_KEY);
    window.dispatchEvent(new Event("sknsh-auth"));
  },
};

/** Storage-safe writer other modules can reuse (chat "seen" markers, themes…). */
export function safeStore(key: string, value: string) {
  safeSet(key, value);
}


function isNetworkError(err: unknown) {
  return err instanceof TypeError || (err as Error)?.message === "Failed to fetch";
}

async function saveBlobUrl(url: string, fileName: string) {
  const { saveFileToDevice } = await import("./native-files");
  await saveFileToDevice(url, fileName);
}

async function handle(res: Response) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = auth.token();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let body: BodyInit | null = null;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const method = options.method ?? (body ? "POST" : "GET");
  if (!API_BASE) return (await offlineRequest(path, method, token, options.body, options.form)) as T;
  try {
    const res = await fetch(`${API_BASE}${path}`, { method, headers, body });
    return (await handle(res)) as T;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    // Flask backend unreachable -> use the in-browser fallback backend.
    return (await offlineRequest(path, method, token, options.body, options.form)) as T;
  }
}

/** Downloads a file and reports back any star the student just earned. */
export async function downloadNote(note: Note): Promise<{ earnedStar: boolean; stars: number }> {
  const token = auth.token();
  const offline = async () => {
    const r = await offlineRequest(`/api/notes/${note.id}/download`, "GET", token, undefined);
    await saveBlobUrl(r.dataUrl, note.fileName);
    return { earnedStar: !!r.earnedStar, stars: Number(r.stars ?? 0) };
  };
  if (!API_BASE) return offline();
  try {
    const res = await fetch(`${API_BASE}/api/notes/${note.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await saveBlobUrl(url, note.fileName);
    URL.revokeObjectURL(url);
    return { earnedStar: false, stars: 0 };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return offline();
  }
}


export async function downloadStudentsExcel() {
  const token = auth.token();
  if (!API_BASE) {
    const csv = offlineStudentsCsv();
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    await saveBlobUrl(url, "students.csv");
    URL.revokeObjectURL(url);
    return "students.csv";
  }
  try {
    const res = await fetch(`${API_BASE}/api/admin/students.xlsx`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await saveBlobUrl(url, "students.xlsx");
    URL.revokeObjectURL(url);
    return "students.xlsx";
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const csv = offlineStudentsCsv();
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    await saveBlobUrl(url, "students.csv");
    URL.revokeObjectURL(url);
    return "students.csv";
  }
}

/**
 * Returns a URL that can be rendered inline (in-app viewer). Popup blockers on
 * mobile and desktop kill `window.open` after an await, so viewing happens in
 * an in-app modal instead.
 */
/**
 * Browsers refuse to render a `data:` URL inside an iframe/object, which is why
 * the in-app viewer showed a blank white screen. Turning the payload into a
 * real blob URL first makes PDFs and images display everywhere.
 */
function dataUrlToBlobUrl(dataUrl: string): string {
  const [header = "", body = ""] = dataUrl.split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  if (!header.includes("base64")) {
    return URL.createObjectURL(new Blob([decodeURIComponent(body)], { type: mime }));
  }
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export async function noteViewUrl(note: Note): Promise<string> {
  const token = auth.token();
  const offline = async () => {
    const { dataUrl } = await offlineRequest(`/api/notes/${note.id}/view`, "GET", token, undefined);
    if (!dataUrl) throw new Error("Could not open this file");
    return dataUrlToBlobUrl(String(dataUrl));
  };
  if (!API_BASE) return offline();
  try {
    const res = await fetch(`${API_BASE}/api/notes/${note.id}/view`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Could not open this file");
    return URL.createObjectURL(await res.blob());
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return offline();
  }
}

/** Opens the file in a new tab (counts as a view) instead of downloading it. */
export async function viewNote(note: Note) {
  const token = auth.token();
  if (!API_BASE) {
    const { dataUrl } = await offlineRequest(`/api/notes/${note.id}/view`, "GET", token, undefined);
    const win = window.open();
    if (win) {
      win.document.write(
        note.mimeType === "application/pdf"
          ? `<iframe src="${dataUrl}" style="border:0;width:100%;height:100%"></iframe>`
          : `<img src="${dataUrl}" style="max-width:100%" alt="${note.fileName}" />`,
      );
      win.document.title = note.fileName;
    }
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/notes/${note.id}/view`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Could not open this file");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const { dataUrl } = await offlineRequest(`/api/notes/${note.id}/view`, "GET", token, undefined);
    const win = window.open();
    if (win) {
      win.document.write(
        note.mimeType === "application/pdf"
          ? `<iframe src="${dataUrl}" style="border:0;width:100%;height:100%"></iframe>`
          : `<img src="${dataUrl}" style="max-width:100%" alt="${note.fileName}" />`,
      );
      win.document.title = note.fileName;
    }
  }
}