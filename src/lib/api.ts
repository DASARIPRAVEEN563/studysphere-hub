import { offlineRequest, offlineStudentsCsv } from "./offline-backend";

export const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5000";

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
};

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
  driveFileId?: string | null;
  likes?: number;
  likedByMe?: boolean;
  views?: number;
  downloads?: number;
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

const TOKEN_KEY = "sknsh_token";
const USER_KEY = "sknsh_user";

/** Never keep heavy payloads (base64 face photo) in the session copy — it blows the storage quota. */
function slimUser(user: User): User {
  return { ...user, faceImage: null };
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    console.warn("Local storage is full — session data was not persisted.");
  }
}

export const auth = {
  token(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  user(): User | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event("sknsh-auth"));
  },
};

function isNetworkError(err: unknown) {
  return err instanceof TypeError || (err as Error)?.message === "Failed to fetch";
}

function saveBlobUrl(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
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
  try {
    const res = await fetch(`${API_BASE}${path}`, { method, headers, body });
    return (await handle(res)) as T;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    // Flask backend unreachable -> use the in-browser fallback backend.
    return (await offlineRequest(path, method, token, options.body, options.form)) as T;
  }
}

export async function downloadNote(note: Note) {
  const token = auth.token();
  try {
    const res = await fetch(`${API_BASE}/api/notes/${note.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    saveBlobUrl(url, note.fileName);
    URL.revokeObjectURL(url);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const { dataUrl } = await offlineRequest(
      `/api/notes/${note.id}/download`,
      "GET",
      token,
      undefined,
    );
    saveBlobUrl(dataUrl, note.fileName);
  }
}

export async function downloadStudentsExcel() {
  const token = auth.token();
  try {
    const res = await fetch(`${API_BASE}/api/admin/students.xlsx`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    saveBlobUrl(url, "students.xlsx");
    URL.revokeObjectURL(url);
    return "students.xlsx";
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const csv = offlineStudentsCsv();
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    saveBlobUrl(url, "students.csv");
    URL.revokeObjectURL(url);
    return "students.csv";
  }
}

/** Opens the file in a new tab (counts as a view) instead of downloading it. */
export async function viewNote(note: Note) {
  const token = auth.token();
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