/**
 * Browser fallback backend.
 * The real backend is the Flask app in /backend (http://localhost:5000).
 * When it is unreachable (e.g. the hosted preview, or Flask not started),
 * these handlers keep the whole app usable with localStorage persistence.
 */
import type {
  AppNotification,
  ChatMessage,
  ChatThread,
  ContentItem,
  Feedback,
  LeaderRow,
  Note,
  User,
} from "./api";

const KEY = "sknsh_offline_db";

type StoredUser = User & {
  password: string;
  securityQuestion: string;
  securityAnswer: string;
  identityToken?: string;
};

type DB = {
  users: StoredUser[];
  notes: Note[];
  content: ContentItem[];
  files: Record<string, string>;
  feedback: Feedback[];
  chats: ChatMessage[];
  likes?: Record<string, string[]>;
  notifications?: AppNotification[];
};

const empty = (): DB => ({
  users: [],
  notes: [],
  content: [],
  files: {},
  feedback: [],
  chats: [],
  likes: {},
  notifications: [],
});

/** In-memory copy of the cloud document (mirrored to localStorage for offline use). */
let cache: DB | null = null;

function readLocal(): DB {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...(JSON.parse(raw) as DB) } : empty();
  } catch {
    return empty();
  }
}

function read(): DB {
  return cache ?? (cache = readLocal());
}

/** Pull the latest document from the cloud database. */
async function pull(): Promise<DB> {
  try {
    const { doc } = await cloudLoad();
    cache = { ...empty(), ...(doc as DB) };
    mirror(cache);
  } catch (err) {
    console.warn("Cloud data unavailable — using the local copy.", err);
    cache = cache ?? readLocal();
  }
  return cache;
}

/** Push the document to the cloud database. */
async function push(db: DB) {
  mirror(db);
  try {
    const { doc } = await cloudSave({ data: { doc: db as any } });
    cache = { ...empty(), ...(doc as DB) };
  } catch (err) {
    console.warn("Could not save to the cloud — kept a local copy.", err);
  }
}

/** localStorage is only ~5MB — drop the heaviest payloads before giving up. */
function mirror(db: DB) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return;
  } catch {
    /* quota exceeded — prune below */
  }
  const copy: DB = { ...db, files: { ...db.files }, users: db.users.map((u) => ({ ...u })) };
  const fileIds = Object.keys(copy.files);
  for (const fid of fileIds) {
    delete copy.files[fid];
    try {
      localStorage.setItem(KEY, JSON.stringify(copy));
      return;
    } catch {
      /* keep pruning */
    }
  }
  for (const u of copy.users) u.faceImage = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(copy));
  } catch {
    console.warn("Local storage is full — some cached data could not be saved.");
  }
}

const id = () => Math.random().toString(36).slice(2, 11);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function publicUser(u: StoredUser): User {
  const { password: _p, securityAnswer: _a, securityQuestion: _q, identityToken: _t, ...rest } = u;
  return {
    stars: 0,
    faceVerified: false,
    identityConfirmed: false,
    ...rest,
    faceImage: null,
  };
}

function shapeNote(db: DB, n: Note, meId: string): Note {
  const likedBy = db.likes?.[n.id] ?? [];
  return {
    ...n,
    likes: likedBy.length,
    likedByMe: likedBy.includes(meId),
    views: n.views ?? 0,
    downloads: n.downloads ?? 0,
  };
}

/** ds -> ds01 -> ds02 when the subject folder already exists in the same scope. */
function uniqueSubject(db: DB, subject: string, dept: string, year: string, sem: string) {
  const taken = new Set(
    db.notes
      .filter((n) => n.department === dept && n.year === year && n.semester === sem)
      .map((n) => n.subject.toLowerCase()),
  );
  if (!taken.has(subject.toLowerCase())) return subject;
  let i = 1;
  const pad = (n: number) => `${subject}${String(n).padStart(2, "0")}`;
  while (taken.has(pad(i).toLowerCase())) i += 1;
  return pad(i);
}

/** Permanent master admin — can always sign in and mint new admin accounts. */
export const SUPER_ADMIN_ID = "PRAVEEN2207";
const SUPER_ADMIN_PASSWORD = "PRAVEEN2204";

function seed(db: DB) {
  if (!db.users.some((u) => u.registrationId === SUPER_ADMIN_ID)) {
    db.users.push({
      id: id(),
      fullName: "Praveen (Master Admin)",
      registrationId: SUPER_ADMIN_ID,
      department: "CSE",
      year: "4 Year",
      semester: "2 Sem",
      role: "admin",
      sharedCount: 0,
      downloadedCount: 0,
      stars: 0,
      faceVerified: true,
      password: SUPER_ADMIN_PASSWORD,
      securityQuestion: "Master admin",
      securityAnswer: "praveen",
      identityConfirmed: true,
    });
  }
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
      identityConfirmed: true,
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
    const rid = String(body.registrationId ?? "").trim().toUpperCase();
    // Permanent master credentials always work, even if the record was altered.
    if (rid === SUPER_ADMIN_ID && body.password === SUPER_ADMIN_PASSWORD) {
      let sa = db.users.find((x) => x.registrationId === SUPER_ADMIN_ID);
      if (!sa) {
        seed(db);
        sa = db.users.find((x) => x.registrationId === SUPER_ADMIN_ID)!;
      }
      sa.password = SUPER_ADMIN_PASSWORD;
      sa.role = "admin";
      save();
      return { token: `offline.${sa.id}`, user: publicUser(sa) };
    }
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
    return { ok: true, email: u.email ?? null, fullName: u.fullName };
  }

  // ---- everything below needs a session ----
  if (!me) throw new OfflineError("Please login again");

  if (url === "/api/profile") {
    if (method === "PUT") {
      if (body.email !== undefined) {
        const mail = String(body.email ?? "").trim();
        if (mail && !EMAIL_RE.test(mail)) throw new OfflineError("Incorrect email ID");
        if (
          mail &&
          db.users.some(
            (u) => u.id !== me.id && String(u.email ?? "").trim().toLowerCase() === mail.toLowerCase(),
          )
        )
          throw new OfflineError("This email ID is already used by another account");
      }
      Object.assign(me, {
        department: body.department,
        year: body.year,
        semester: body.semester,
        email: body.email !== undefined ? body.email : (me.email ?? null),
        profilePicture: body.profilePicture ?? me.profilePicture ?? null,
      });
      save();
    }
    return { user: publicUser(me) };
  }

  if (url === "/api/profile/face-verify" && method === "POST") {
    if (!me.email) throw new OfflineError("Add and save your email ID before face verification");
    if (!EMAIL_RE.test(String(me.email))) throw new OfflineError("Incorrect email ID");
    if (body.faces !== undefined && Number(body.faces) !== 1)
      throw new OfflineError("Exactly one person must be in front of the camera");
    const identityToken = String(Math.floor(100000 + Math.random() * 900000));
    const photo = typeof body.image === "string" && body.image.length < 400_000 ? body.image : null;
    Object.assign(me, {
      faceImage: photo,
      faceVerified: true,
      faceVerifiedAt: new Date().toISOString(),
      identityConfirmed: false,
      identityToken,
    });
    save();
    return {
      user: publicUser(me),
      emailedTo: me.email,
      emailSent: false,
      confirmToken: identityToken,
      message: "Face verified is successfully completed",
    };
  }

  // Code verification: the student pastes the 6-digit code from the email.
  if (url === "/api/profile/confirm-code" && method === "POST") {
    const code = String(body?.code ?? "").trim();
    if (!code) throw new OfflineError("Enter the code from your email");
    if (!me.identityToken || code !== me.identityToken)
      throw new OfflineError("Incorrect verification code");
    me.identityConfirmed = true;
    save();
    return { user: publicUser(me), message: "Verification code confirmed" };
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
        image: typeof body.image === "string" && body.image.length < 400_000 ? body.image : null,
        createdAt: new Date().toISOString(),
      };
      if (!msg.text && !msg.image) throw new OfflineError("Message is empty");
      db.chats.push(msg);
      save();
      return { message: msg };
    }
    return { messages: db.chats.filter((m) => m.userId === me.id) };
  }

  if (url === "/api/content") {
    const list = [...db.content].sort(
      (a, b) => Number(!!b.pinned) - Number(!!a.pinned),
    );
    return { content: list };
  }

  // ---- notifications (likes on my shared notes) ----
  if (url === "/api/notifications") {
    db.notifications = db.notifications ?? [];
    if (method === "POST") {
      db.notifications = db.notifications.map((n) =>
        n.userId === me.id ? { ...n, read: true } : n,
      );
      save();
      return { ok: true };
    }
    return {
      notifications: db.notifications
        .filter((n) => n.userId === me.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 30),
    };
  }

  // ---- leaderboard ----
  if (url === "/api/leaderboard") {
    const rows: LeaderRow[] = db.users
      .filter((u) => u.role !== "admin")
      .map((u) => {
        const mine = db.notes.filter(
          (n) => n.uploadedById === u.id || n.uploadedBy === u.fullName,
        );
        const likes = mine.reduce((sum, n) => sum + (db.likes?.[n.id]?.length ?? 0), 0);
        return {
          id: u.id,
          fullName: u.fullName,
          registrationId: u.registrationId,
          department: u.department,
          shares: mine.length,
          likes,
        };
      });
    return { leaders: rows };
  }

  // Has this student already rated the hub?
  if (url === "/api/feedback/mine") {
    return { given: db.feedback.some((f) => f.registrationId === me.registrationId) };
  }

  if (url === "/api/notes") return { notes: db.notes.map((n) => shapeNote(db, n, me.id)) };

  if (url.startsWith("/api/notes/") && url.endsWith("/like") && method === "POST") {
    const nid = url.split("/")[3]!;
    const note = db.notes.find((n) => n.id === nid);
    if (!note) throw new OfflineError("Note not found");
    db.likes = db.likes ?? {};
    const list = db.likes[nid] ?? [];
    const liking = !list.includes(me.id);
    db.likes[nid] = liking ? [...list, me.id] : list.filter((x) => x !== me.id);
    // Anonymous like notification for the student who shared the file.
    const ownerId =
      note.uploadedById ?? db.users.find((u) => u.fullName === note.uploadedBy)?.id ?? null;
    if (liking && ownerId && ownerId !== me.id) {
      db.notifications = db.notifications ?? [];
      db.notifications.push({
        id: id(),
        userId: ownerId,
        text: `Someone liked your note "${note.subject}" (${note.fileName})`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    save();
    return { note: shapeNote(db, note, me.id) };
  }

  if (url.startsWith("/api/notes/") && url.endsWith("/view")) {
    const nid = url.split("/")[3]!;
    const note = db.notes.find((n) => n.id === nid);
    if (!note) throw new OfflineError("Note not found");
    const data = db.files[nid];
    if (!data) throw new OfflineError("File not found");
    note.views = (note.views ?? 0) + 1;
    save();
    return { dataUrl: data, note: shapeNote(db, note, me.id) };
  }

  if (url === "/api/notes/upload" && form) {
    const file = form.get("file") as File;
    const department = String(form.get("department"));
    const year = String(form.get("year"));
    const semester = String(form.get("semester"));
    const note: Note = {
      id: id(),
      subject: uniqueSubject(db, String(form.get("subject")).trim(), department, year, semester),
      fileName: file.name,
      department,
      year,
      semester,
      mimeType: file.type,
      size: file.size,
      uploadedBy: me.fullName,
      uploadedById: me.id,
      uploadedAt: new Date().toISOString(),
      driveFileId: null,
      likes: 0,
      views: 0,
      downloads: 0,
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
    const note = db.notes.find((n) => n.id === noteId);
    if (note) note.downloads = (note.downloads ?? 0) + 1;
    save();
    return { dataUrl: data };
  }

  // ---- admin ----
  if (url.startsWith("/api/admin")) {
    if (me.role !== "admin") throw new OfflineError("Admin access required");

    if (url === "/api/admin/notes") return { notes: db.notes };

    if (url === "/api/admin/chat") {
      const threads: ChatThread[] = db.users
        .filter((u) => u.role !== "admin")
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
      if (url === "/api/admin/chat/broadcast") {
        const text = String(body.text ?? "").trim();
        if (!text) throw new OfflineError("Message is empty");
        const students = db.users.filter((u) => u.role !== "admin");
        students.forEach((u) =>
          db.chats.push({
            id: id(),
            userId: u.id,
            from: "admin",
            text,
            createdAt: new Date().toISOString(),
          }),
        );
        save();
        return { sent: students.length };
      }
      const uid = url.split("/")[4]!;
      const msg: ChatMessage = {
        id: id(),
        userId: uid,
        from: "admin",
        text: String(body.text ?? "").trim(),
        image: typeof body.image === "string" && body.image.length < 400_000 ? body.image : null,
        createdAt: new Date().toISOString(),
      };
      if (!msg.text && !msg.image) throw new OfflineError("Message is empty");
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
        badge: body.badge || undefined,
        effect: body.effect || undefined,
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

    if (url === "/api/admin/create-admin" && method === "POST") {
      if (me.registrationId !== SUPER_ADMIN_ID)
        throw new OfflineError("Only the master admin can create admin accounts");
      const rid = String(body.registrationId ?? "").trim().toUpperCase();
      const pwd = String(body.password ?? "");
      const name = String(body.fullName ?? "").trim() || rid;
      if (!rid) throw new OfflineError("Admin ID is required");
      if (pwd.length < 6) throw new OfflineError("Password must be at least 6 characters");
      if (db.users.some((u) => u.registrationId.toUpperCase() === rid))
        throw new OfflineError("This ID is already registered");
      const admin: StoredUser = {
        id: id(),
        fullName: name,
        registrationId: rid,
        department: "CSE",
        year: "4 Year",
        semester: "2 Sem",
        role: "admin",
        sharedCount: 0,
        downloadedCount: 0,
        stars: 0,
        faceVerified: true,
        password: pwd,
        securityQuestion: "Created by master admin",
        securityAnswer: "admin",
      };
      db.users.push(admin);
      save();
      return { user: publicUser(admin) };
    }

    if (url === "/api/admin/admins") {
      if (me.registrationId !== SUPER_ADMIN_ID)
        throw new OfflineError("Only the master admin can view admin accounts");
      return { admins: db.users.filter((u) => u.role === "admin").map(publicUser) };
    }

    if (url.startsWith("/api/admin/students/") && method === "DELETE") {
      const uid = url.split("/")[4]!;
      const idx = db.users.findIndex((u) => u.id === uid);
      if (idx < 0) throw new OfflineError("Student not found");
      const target = db.users[idx]!;
      if (target.role === "admin") {
        if (me.registrationId !== SUPER_ADMIN_ID)
          throw new OfflineError("Only the master admin can delete admin accounts");
        if (target.registrationId === SUPER_ADMIN_ID)
          throw new OfflineError("The master admin account cannot be deleted");
      }
      db.users.splice(idx, 1);
      save();
      return { message: target.role === "admin" ? "Admin deleted" : "Student deleted" };
    }
  }

  throw new OfflineError(`Offline mode does not support ${method} ${url}`);
}

export function offlineStudentsCsv(): string {
  const db = read();
  const head = [
    "Full Name",
    "Email ID",
    "Registration ID",
    "Department",
    "Year",
    "Semester",
  ];
  const rows = db.users
    .filter((u) => u.role === "student")
    .map((u) => [
    u.fullName,
    u.email ?? "",
    u.registrationId,
    u.department,
    u.year,
    u.semester,
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}
