export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";

export const DEPARTMENTS = [
  "BS&H",
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
  department: string;
  year: string;
  semester: string;
  role: "student" | "admin";
  profilePicture?: string | null;
  sharedCount: number;
  downloadedCount: number;
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
  uploadedAt: string;
  driveFileId?: string | null;
};

export type ContentItem = {
  id: string;
  type: "gallery" | "timetable" | "promotion" | "video" | "notice";
  title: string;
  description?: string;
  url?: string;
  createdAt: string;
};

const TOKEN_KEY = "sknsh_token";
const USER_KEY = "sknsh_user";

export const auth = {
  token(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  user(): User | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },
  save(token: string, user: User) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("sknsh-auth"));
  },
  setUser(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("sknsh-auth"));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event("sknsh-auth"));
  },
};

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
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });
  return handle(res) as Promise<T>;
}

export async function downloadNote(note: Note) {
  const token = auth.token();
  const res = await fetch(`${API_BASE}/api/notes/${note.id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = note.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadStudentsExcel() {
  const token = auth.token();
  const res = await fetch(`${API_BASE}/api/admin/students.xlsx`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}