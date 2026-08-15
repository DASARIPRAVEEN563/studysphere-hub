/**
 * Browser fallback backend.
 * The real backend is the Flask app in /backend (http://localhost:5000).
 * When it is unreachable (e.g. the hosted preview, or Flask not started),
 * these handlers keep the whole app usable with localStorage persistence.
 */
import type { ChatMessage, ChatThread, ContentItem, Feedback, Note, User } from "./api";

const KEY = "sknsh_offline_db";

type StoredUser = User & {
  password: string;
  securityQuestion: string;
  securityAnswer: string;
};

type DB = {
  users: StoredUser[];
  notes: Note[];
  content: ContentItem[];
  files: Record<string, string>;
  feedback: Feedback[];
  chats: ChatMessage[];
};

const empty = (): DB => ({ users: [], notes: [], content: [], files: {}, feedback: [], chats: [] });

function read(): DB {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...(JSON.parse(raw) as DB) } : empty();
  } catch {
    return empty();
  }
}

function write(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

const id = () => Math.random().toString(36).slice(2, 11);

function publicUser(u: StoredUser): User {
  const { password: _p, securityAnswer: _a, securityQuestion: _q, ...rest } = u;
  return { stars: 0, faceVerified: false, faceImage: null, ...rest };
}

function seed(db: DB) {
  if (!db.users.some((u) => u.role === "admin")) {
    db.users.push({
      id: id(),
      fullName: "Administrator",
      registrationId: "ADMIN",
      department: "CSE",
      year: "4 Year",
      semester: "2 Sem",
      role: "admin",
      sharedCount: 0,
      downloadedCount: 0,
      stars: 0,
      faceVerified: true,
      password: "admin123",
      securityQuestion: "What is your nickname?",
      securityAnswer: "admin",
    });
  }
  if (!db.content.length) {
    db.content.push(
      {
        id: id(),
        type: "notice",
        title: "Welcome to Students Ka Notes Sharing Hub",
        description: "Upload your subject notes and help your classmates ace the semester.",
        createdAt: new Date().toISOString(),
      },
      {
        id: id(),
        type: "notice",
        title: "Mid-term exams schedule released",
        description: "Check the timetable section for department-wise timings.",
        createdAt: new Date().toISOString(),
      },
    );
  }
}

function currentUser(db: DB, token: string | null): StoredUser | null {
  if (!token || !token.startsWith("offline.")) return null;
  const uid = token.slice("offline.".length);
  return db.users.find((u) => u.id === uid) ?? null;
}

export class OfflineError extends Error {}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

export async function offlineRequest(
  path: string,
  method: string,
  token: string | null,
  body: any,
  form?: FormData,
): Promise<any> {
  const db = read();
  seed(db);
  const me = currentUser(db, token);
  const save = () => write(db);
  const url = path.split("?")[0] ?? path;

  // ---- auth ----
  if (url === "/api/auth/signup") {
    if (db.users.some((u) => u.registrationId.toLowerCase() === String(body.registrationId).toLowerCase()))
      throw new OfflineError("Registration ID already exists");
    const user: StoredUser = {
      id: id(),
      fullName: body.fullName,
      registrationId: body.registrationId,
      department: body.department,
      year: body.year,
      semester: body.semester,
      role: "student",
      sharedCount: 0,
      downloadedCount: 0,
      stars: 0,
      faceVerified: false,
      faceImage: null,
      password: body.password,
      securityQuestion: body.securityQuestion,
      securityAnswer: String(body.securityAnswer).trim().toLowerCase(),
    };
    db.users.push(user);
    save();
    return { token: `offline.${user.id}`, user: publicUser(user) };
  }

  if (url === "/api/auth/login") {
    const u = db.users.find(
      (x) => x.registrationId.toLowerCase() === String(body.registrationId).toLowerCase(),
    );
    if (!u || u.password !== body.password) throw new OfflineError("Invalid registration ID or password");
    save();
    return { token: `offline.${u.id}`, user: publicUser(u) };
  }

  if (url === "/api/auth/forgot/question") {
    const u = db.users.find(
      (x) => x.registrationId.toLowerCase() === String(body.registrationId).toLowerCase(),
    );
    if (!u) throw new OfflineError("No account with that registration ID");
    return { securityQuestion: u.securityQuestion };
  }

  if (url === "/api/auth/forgot/reset") {
    const u = db.users.find(
      (x) => x.registrationId.toLowerCase() === String(body.registrationId).toLowerCase(),
    );
    if (!u) throw new OfflineError("No account with that registration ID");
    if (u.securityAnswer !== String(body.securityAnswer).trim().toLowerCase())
      throw new OfflineError("Security answer is incorrect");
    u.password = body.newPassword;
    save();
    return { ok: true };
  }

  // ---- everything below needs a session ----
  if (!me) throw new OfflineError("Please login again");

  if (url === "/api/profile") {
    if (method === "PUT") {
      Object.assign(me, {
        department: body.department,
        year: body.year,
        semester: body.semester,
        profilePicture: body.profilePicture ?? me.profilePicture ?? null,
      });
      save();
    }
    return { user: publicUser(me) };
  }

  if (url === "/api/profile/face-verify" && method === "POST") {
    Object.assign(me, {
      faceImage: body.image,
      faceVerified: true,
      faceVerifiedAt: new Date().toISOString(),
    });
    save();
    return { user: publicUser(me) };
  }

  // ---- feedback ----
  if (url === "/api/feedback") {
    if (method === "POST") {
      const item: Feedback = {
        id: id(),
        userName: me.fullName,
        registrationId: me.registrationId,
        rating: Number(body.rating) || 5,
        comment: String(body.comment ?? ""),
        createdAt: new Date().toISOString(),
      };
      db.feedback.unshift(item);
      save();
      return { item };
    }
    return { feedback: db.feedback };
  }

  // ---- chat with admin ----
  if (url === "/api/chat") {
    if (method === "POST") {
      const msg: ChatMessage = {
        id: id(),
        userId: me.id,
        from: me.role === "admin" ? "admin" : "user",
        text: String(body.text ?? "").trim(),
        createdAt: new Date().toISOString(),
      };
      if (!msg.text) throw new OfflineError("Message is empty");
      db.chats.push(msg);
      save();
      return { message: msg };
    }
    return { messages: db.chats.filter((m) => m.userId === me.id) };
  }

  if (url === "/api/content") return { content: db.content };

  if (url === "/api/notes") return { notes: db.notes };

  if (url === "/api/notes/upload" && form) {
    const file = form.get("file") as File;
    const note: Note = {
      id: id(),
      subject: String(form.get("subject")),
      fileName: file.name,
      department: String(form.get("department")),
      year: String(form.get("year")),
      semester: String(form.get("semester")),
      mimeType: file.type,
      size: file.size,
      uploadedBy: me.fullName,
      uploadedAt: new Date().toISOString(),
      driveFileId: null,
    };
    db.files[note.id] = await fileToDataUrl(file);
    db.notes.unshift(note);
    me.sharedCount += 1;
    me.stars = (me.stars ?? 0) + 1;
    save();
    return { note, stars: me.stars };
  }

  if (url.startsWith("/api/notes/") && url.endsWith("/download")) {
    if (!me.faceVerified) throw new OfflineError("You are not face verified");
    const noteId = url.split("/")[3]!;
    const data = db.files[noteId];
    if (!data) throw new OfflineError("File not found");
    me.downloadedCount += 1;
    save();
    return { dataUrl: data };
  }

  // ---- admin ----
  if (url.startsWith("/api/admin")) {
    if (me.role !== "admin") throw new OfflineError("Admin access required");

    if (url === "/api/admin/notes") return { notes: db.notes };

    if (url === "/api/admin/chat") {
      const threads: ChatThread[] = db.users
        .filter((u) => u.role !== "admin" && db.chats.some((c) => c.userId === u.id))
        .map((u) => ({
          userId: u.id,
          fullName: u.fullName,
          registrationId: u.registrationId,
          department: u.department,
          year: u.year,
          semester: u.semester,
          profilePicture: u.profilePicture ?? null,
          messages: db.chats.filter((c) => c.userId === u.id),
        }));
      return { threads };
    }

    if (url.startsWith("/api/admin/chat/") && method === "POST") {
      const uid = url.split("/")[4]!;
      const msg: ChatMessage = {
        id: id(),
        userId: uid,
        from: "admin",
        text: String(body.text ?? "").trim(),
        createdAt: new Date().toISOString(),
      };
      if (!msg.text) throw new OfflineError("Message is empty");
      db.chats.push(msg);
      save();
      return { message: msg };
    }

    if (url === "/api/admin/feedback") return { feedback: db.feedback };

    if (url === "/api/admin/content" && method === "POST") {
      const item: ContentItem = {
        id: id(),
        type: body.type,
        title: body.title,
        description: body.description || undefined,
        url: body.url || undefined,
        createdAt: new Date().toISOString(),
      };
      db.content.unshift(item);
      save();
      return { item };
    }

    if (url.startsWith("/api/admin/content/")) {
      const cid = url.split("/")[4]!;
      const idx = db.content.findIndex((c) => c.id === cid);
      if (idx < 0) throw new OfflineError("Content not found");
      if (method === "DELETE") db.content.splice(idx, 1);
      else Object.assign(db.content[idx]!, body);
      save();
      return { ok: true };
    }

    if (url.startsWith("/api/admin/notes/")) {
      const nid = url.split("/")[4]!;
      const idx = db.notes.findIndex((n) => n.id === nid);
      if (idx < 0) throw new OfflineError("Note not found");
      if (method === "DELETE") {
        db.notes.splice(idx, 1);
        delete db.files[nid];
      } else {
        Object.assign(db.notes[idx]!, body);
      }
      save();
      return { ok: true };
    }

    if (url === "/api/admin/students") return { students: db.users.map(publicUser) };
  }

  throw new OfflineError(`Offline mode does not support ${method} ${url}`);
}

export function offlineStudentsCsv(): string {
  const db = read();
  const head = [
    "Full Name",
    "Registration ID",
    "Department",
    "Year",
    "Semester",
    "Role",
    "Notes Shared",
    "Notes Downloaded",
    "Stars",
    "Face Verified",
    "Face Verified At",
    "Verified Image (data URL)",
  ];
  const rows = db.users.map((u) => [
    u.fullName,
    u.registrationId,
    u.department,
    u.year,
    u.semester,
    u.role,
    String(u.sharedCount),
    String(u.downloadedCount),
    String(u.stars ?? 0),
    u.faceVerified ? "YES" : "NO",
    u.faceVerifiedAt ?? "",
    u.faceImage ?? "",
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}
