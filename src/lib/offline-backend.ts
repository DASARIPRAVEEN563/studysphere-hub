/**
 * Browser fallback backend.
 * The real backend is the Flask app in /backend (http://localhost:5000).
 * When it is unreachable (e.g. the hosted preview, or Flask not started),
 * these handlers keep the whole app usable with localStorage persistence.
 */
import { cloudAuth, cloudCode, cloudFile, cloudLoad, cloudSave } from "./cloud-state.functions";
import type {
  AccessArea,
  AppNotification,
  ChatMessage,
  ChatThread,
  ContentItem,
  Feedback,
  Folder,
  LeaderRow,
  Note,
  TrashItem,
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
  /** Ids of blobs that live in the cloud but are not held in memory. */
  fileIds?: string[];
  /** Blobs deleted locally, applied server-side on the next save. */
  filesRemove?: string[];
  /** Admin-managed folders (Mid 1, Mid 2 …) inside a semester. */
  folders?: Folder[];
  /** Recently deleted records, kept for 10 days. */
  trash?: TrashItem[];
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
  fileIds: [],
  filesRemove: [],
  folders: [],
  trash: [],
});

/** In-memory copy of the cloud document (mirrored to localStorage for offline use). */
let cache: DB | null = null;
/**
 * Ids the browser saw when it last synced. The server uses them to tell an
 * intentional delete apart from a row another user created meanwhile, so many
 * people using the site at once never overwrite each other's data.
 */
let baseIds: Record<string, string[]> = {};

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

/** Coalesces the background polls so the app never fetches the same data twice. */
let pullInFlight: Promise<DB> | null = null;
let pulledAt = 0;
/** Reads that happen within this window reuse the in-memory copy (keeps the UI snappy). */
const PULL_TTL = 20000;
/** Writes only re-sync from the server when the local copy is older than this. */
const WRITE_FRESH_MS = 4000;

/**
 * Pull the latest document from the cloud database.
 * Reads are stale-while-revalidate: a cached copy is returned instantly and the
 * refresh happens in the background, so screens never wait on the network.
 */
async function pull(force = false): Promise<DB> {
  if (!force && cache && Date.now() - pulledAt < PULL_TTL) return cache;
  if (!force && cache) {
    void refresh();
    return cache;
  }
  return refresh();
}

async function refresh(): Promise<DB> {
  if (pullInFlight) return pullInFlight;
  pullInFlight = (async () => {
    try {
      const res = await cloudLoad();
      const doc = res.doc;
      baseIds = res.baseIds ?? {};
      // Blobs staged locally but not pushed yet must survive a refresh.
      const staged = cache?.files ?? {};
      cache = { ...empty(), ...(doc as DB), files: { ...staged } };
      pulledAt = Date.now();
      mirror(cache);
    } catch (err) {
      console.warn("Cloud data unavailable — using the local copy.", err);
      cache = cache ?? readLocal();
    } finally {
      pullInFlight = null;
    }
    return cache!;
  })();
  return pullInFlight;
}

/** Saves are chained so two quick actions never race each other. */
let saveChain: Promise<void> = Promise.resolve();

/** Push the document to the cloud database. */
async function push(db: DB) {
  mirror(db);
  saveChain = saveChain.then(() => pushNow(db)).catch(() => {});
  return saveChain;
}

async function pushNow(db: DB) {
  try {
    const res = await cloudSave({ data: { doc: db as any, baseIds } });
    baseIds = res.baseIds ?? baseIds;
    cache = { ...empty(), ...(res.doc as DB), files: {}, filesRemove: [] };
    pulledAt = Date.now();
    mirror(cache);
  } catch (err) {
    console.warn("Could not save to the cloud — kept a local copy.", err);
  }
}

/** Blob for a note: served from memory when just uploaded, else fetched once. */
async function fileData(db: DB, fileId: string): Promise<string | null> {
  const local = db.files[fileId];
  if (local) return local;
  try {
    const res = await cloudFile({ data: { id: fileId } });
    return res.dataUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Mirroring to localStorage is only an offline fallback, so it runs off the main
 * work: at most once a second, while the browser is idle, and without the heavy
 * base64 blobs that used to make every save stutter.
 */
let mirrorTimer: ReturnType<typeof setTimeout> | null = null;
let mirrorPending: DB | null = null;

function mirror(db: DB) {
  if (typeof window === "undefined") return;
  mirrorPending = db;
  if (mirrorTimer) return;
  mirrorTimer = setTimeout(() => {
    mirrorTimer = null;
    const next = mirrorPending;
    mirrorPending = null;
    if (!next) return;
    const run = () => writeMirror(next);
    const idle = (window as any).requestIdleCallback as
      | ((cb: () => void, o?: { timeout: number }) => number)
      | undefined;
    if (idle) idle(run, { timeout: 1500 });
    else run();
  }, 1000);
}

/** localStorage is only ~5MB — drop the heaviest payloads before giving up. */
function writeMirror(db: DB) {
  const light: DB = { ...db, files: {}, users: db.users.map((u) => ({ ...u, faceImage: null })) };
  try {
    localStorage.setItem(KEY, JSON.stringify(light));
  } catch {
    console.warn("Local storage is full — some cached data could not be saved.");
  }
}

const id = () => Math.random().toString(36).slice(2, 11);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function publicUser(u: StoredUser): User {
  const { password: _p, securityAnswer: _a, securityQuestion: _q, identityToken: _t, resetCode: _rc, resetAt: _ra, ...rest } = u as any;
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

/** Recently-deleted records are recoverable for this long, then purged for good. */
const TRASH_DAYS = 10;

/** Moves a record to "Recently deleted" instead of destroying it. */
function toTrash(
  db: DB,
  kind: TrashItem["kind"],
  label: string,
  payload: any,
  detail: string,
  by: string,
) {
  db.trash = db.trash ?? [];
  db.trash.unshift({
    id: id(),
    kind,
    label,
    detail,
    deletedAt: new Date().toISOString(),
    deletedBy: by,
    payload,
  });
}

/** Drops bin entries older than 10 days (and their file blobs), like a phone gallery. */
function purgeTrash(db: DB) {
  const list = db.trash ?? [];
  const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
  const stale = list.filter((t) => new Date(t.deletedAt).getTime() < cutoff);
  if (!stale.length) return;
  db.trash = list.filter((t) => new Date(t.deletedAt).getTime() >= cutoff);
  const blobs = stale.filter((t) => t.kind === "note").map((t) => String(t.payload?.id));
  if (blobs.length) db.filesRemove = [...(db.filesRemove ?? []), ...blobs];
}

/** Throws when an admin has rejected this student's access to a feature. */
function assertAllowed(user: StoredUser, area: AccessArea) {
  if (user.role === "admin") return;
  if ((user.blocked ?? []).includes(area))
    throw new OfflineError(
      area === "chat"
        ? "The admin has removed your access to chat"
        : area === "share"
          ? "The admin has removed your access to share notes"
          : "The admin has removed your access to feedback",
    );
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

/**
 * Permanent master admin — can always sign in and mint new admin accounts.
 * The password is never kept in the code: sign-in is validated on the server
 * against the MASTER_ADMIN_PASSWORD secret.
 */
export const SUPER_ADMIN_ID = "PRAVEEN2207";

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
      password: "",
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
  const url = path.split("?")[0] ?? path;

  // ---- auth: credentials are checked in the cloud, never in the browser ----
  if (url.startsWith("/api/auth/")) {
    try {
      const res: any = await cloudAuth({ data: { path: url, body: body ?? {} } });
      const { doc, baseIds: ids, ...payload } = res;
      baseIds = ids ?? baseIds;
      cache = { ...empty(), ...(doc as DB) };
      mirror(cache);
      if (payload.error) throw new OfflineError(String(payload.error));
      return payload;
    } catch (err: any) {
      if (err instanceof OfflineError) throw err;
      throw new OfflineError(String(err?.message ?? "Request failed").replace(/^Error:\s*/, ""));
    }
  }

  // Reads reuse the fresh in-memory copy; writes re-sync only when it is stale.
  const db = await pull(method !== "GET" && Date.now() - pulledAt > WRITE_FRESH_MS);
  seed(db);
  purgeTrash(db);
  const me = currentUser(db, token);
  /** Returns a promise: await it whenever the next request depends on the write. */
  const save = () => push(db);

  // ---- everything below needs a session ----
  if (!me) throw new OfflineError("Please login again");

  if (url === "/api/profile") {
    if (method === "PUT") {
      if (body.email !== undefined) {
        const mail = String(body.email ?? "").trim();
        const current = String(me.email ?? "").trim();
        // Once the face + email verification is complete the email is locked.
        if (me.faceVerified && me.identityConfirmed && mail.toLowerCase() !== current.toLowerCase())
          throw new OfflineError("Your email ID cannot be changed after face verification");
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
    // The code lives in a private server row, so nobody else's save can wipe it.
    const issued: any = await cloudCode({ data: { action: "issue", kind: "face", userId: me.id } });
    if (!issued?.ok) throw new OfflineError(String(issued?.error ?? "Could not send the code"));
    const identityToken = String(issued.code);
    const photo = typeof body.image === "string" && body.image.length < 400_000 ? body.image : null;
    Object.assign(me, {
      faceImage: photo,
      faceVerified: true,
      faceVerifiedAt: new Date().toISOString(),
      identityConfirmed: false,
      identityToken: null,
    });
    // Must be persisted before the student can submit the emailed code.
    await save();
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
    const code = String(body?.code ?? "").replace(/\D/g, "");
    if (!code) throw new OfflineError("Enter the code from your email");
    const res: any = await cloudCode({ data: { action: "verify", kind: "face", userId: me.id, code } });
    if (!res?.ok) throw new OfflineError(String(res?.error ?? "Incorrect verification code"));
    me.identityConfirmed = true;
    me.faceVerified = true;
    await save();
    return { user: publicUser(me), message: "Verification code confirmed" };
  }

  /**
   * Fallback for students whose camera or email code never works: they raise a
   * request and an admin approves them by hand from the admin portal.
   */
  if (url === "/api/profile/request-access" && method === "POST") {
    Object.assign(me, {
      accessRequested: true,
      accessRequestedAt: new Date().toISOString(),
      accessRequestNote: String(body?.note ?? "").slice(0, 300),
    });
    await save();
    return { user: publicUser(me), message: "Request sent to the admin" };
  }

  // ---- feedback ----
  if (url === "/api/feedback") {
    if (method === "POST") {
      assertAllowed(me, "feedback");
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
      assertAllowed(me, "chat");
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

  // Admin-managed folders are readable by everybody (view / download / like).
  if (url === "/api/folders") return { folders: db.folders ?? [] };

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
    const data = await fileData(db, nid);
    if (!data) throw new OfflineError("File not found");
    note.views = (note.views ?? 0) + 1;
    save();
    return { dataUrl: data, note: shapeNote(db, note, me.id) };
  }

  if (url === "/api/notes/upload" && form) {
    assertAllowed(me, "share");
    const folderId = String(form.get("folderId") ?? "").trim() || null;
    if (folderId && me.role !== "admin")
      throw new OfflineError("Only the admin can share notes inside this folder");
    const file = form.get("file") as File;
    const department = String(form.get("department"));
    const year = String(form.get("year"));
    const semester = String(form.get("semester"));
    const extra = String(form.get("note") ?? "").trim().slice(0, 200);
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
      note: extra || null,
      folderId,
      driveFileId: null,
      likes: 0,
      views: 0,
      downloads: 0,
    };
    db.files[note.id] = await fileToDataUrl(file);
    db.notes.unshift(note);
    me.sharedCount += 1;
    me.stars = (me.stars ?? 0) + 1;
    await save();
    return { note, stars: me.stars };
  }

  if (url.startsWith("/api/notes/") && url.endsWith("/download")) {
    if (!me.faceVerified) throw new OfflineError("You are not face verified");
    const noteId = url.split("/")[3]!;
    const data = await fileData(db, noteId);
    if (!data) throw new OfflineError("File not found");
    me.downloadedCount += 1;
    const note = db.notes.find((n) => n.id === noteId);
    if (note) note.downloads = (note.downloads ?? 0) + 1;
    save();
    return { dataUrl: data };
  }

  /**
   * Owner tools: a student can rename or delete only the notes they shared —
   * never anybody else's files (admins keep their own endpoints below).
   */
  if (url.startsWith("/api/notes/") && url.split("/").length === 4) {
    const nid = url.split("/")[3]!;
    const idx = db.notes.findIndex((n) => n.id === nid);
    if (idx < 0) throw new OfflineError("Note not found");
    const note = db.notes[idx]!;
    const owns = note.uploadedById === me.id || (!note.uploadedById && note.uploadedBy === me.fullName);
    if (!owns) throw new OfflineError("You can only manage the notes you shared");
    if (method === "DELETE") {
      db.notes.splice(idx, 1);
      toTrash(db, "note", note.subject, note, `${note.fileName} · ${note.department}`, me.fullName);
      await save();
      return { ok: true };
    }
    if (method === "PUT") {
      const subject = String(body?.subject ?? note.subject).trim();
      if (!subject) throw new OfflineError("Subject cannot be empty");
      note.subject = subject;
      if (body?.note !== undefined) note.note = String(body.note ?? "").trim().slice(0, 200) || null;
      await save();
      return { note: shapeNote(db, note, me.id) };
    }
  }

  // ---- admin ----
  if (url.startsWith("/api/admin")) {
    if (me.role !== "admin") throw new OfflineError("Admin access required");

    if (url === "/api/admin/notes") return { notes: db.notes };

    // ---- admin-managed folders (Mid 1, Mid 2 …) ----
    if (url === "/api/admin/folders") {
      if (method === "POST") {
        const name = String(body?.name ?? "").trim();
        if (!name) throw new OfflineError("Folder name is required");
        const department = String(body?.department ?? "");
        const year = String(body?.year ?? "");
        const semester = String(body?.semester ?? "");
        if (!department || !year || !semester)
          throw new OfflineError("Pick a department, year and semester");
        db.folders = db.folders ?? [];
        if (
          db.folders.some(
            (f) =>
              f.department === department &&
              f.year === year &&
              f.semester === semester &&
              f.name.toLowerCase() === name.toLowerCase(),
          )
        )
          throw new OfflineError("A folder with this name already exists here");
        const folder: Folder = {
          id: id(),
          name,
          description: String(body?.description ?? "").trim().slice(0, 200) || null,
          department,
          year,
          semester,
          createdAt: new Date().toISOString(),
        };
        db.folders.unshift(folder);
        await save();
        return { folder };
      }
      return { folders: db.folders ?? [] };
    }

    if (url.startsWith("/api/admin/folders/")) {
      const fid = url.split("/")[4]!;
      db.folders = db.folders ?? [];
      const folder = db.folders.find((f) => f.id === fid);
      if (!folder) throw new OfflineError("Folder not found");
      if (method === "DELETE") {
        const inside = db.notes.filter((n) => n.folderId === fid);
        db.notes = db.notes.filter((n) => n.folderId !== fid);
        db.folders = db.folders.filter((f) => f.id !== fid);
        toTrash(
          db,
          "folder",
          folder.name,
          { folder, notes: inside },
          `${folder.department} · ${folder.year} · ${folder.semester} · ${inside.length} file(s)`,
          me.fullName,
        );
        await save();
        return { ok: true };
      }
      // Rename and/or move the folder — the files inside travel with it.
      const name = String(body?.name ?? folder.name).trim();
      if (!name) throw new OfflineError("Folder name is required");
      const department = String(body?.department ?? folder.department);
      const year = String(body?.year ?? folder.year);
      const semester = String(body?.semester ?? folder.semester);
      Object.assign(folder, { name, department, year, semester });
      db.notes.forEach((n) => {
        if (n.folderId === fid) Object.assign(n, { department, year, semester });
      });
      await save();
      return { folder };
    }

    // ---- recently deleted (10 day recovery bin) ----
    if (url === "/api/admin/trash") return { trash: db.trash ?? [] };

    if (url.startsWith("/api/admin/trash/")) {
      const tid = url.split("/")[4]!;
      db.trash = db.trash ?? [];
      const entry = db.trash.find((t) => t.id === tid);
      if (!entry) throw new OfflineError("Item not found in the bin");
      if (method === "POST") {
        if (entry.kind === "note") db.notes.unshift(entry.payload);
        else if (entry.kind === "user") db.users.push(entry.payload);
        else if (entry.kind === "content") db.content.unshift(entry.payload);
        else if (entry.kind === "feedback") db.feedback.unshift(entry.payload);
        else if (entry.kind === "chat")
          db.chats.push(...(Array.isArray(entry.payload) ? entry.payload : [entry.payload]));
        else if (entry.kind === "folder") {
          db.folders = [...(db.folders ?? []), entry.payload.folder];
          db.notes.unshift(...(entry.payload.notes ?? []));
        }
        db.trash = db.trash.filter((t) => t.id !== tid);
        await save();
        return { ok: true, restored: entry.kind };
      }
      if (method === "DELETE") {
        if (entry.kind === "note")
          db.filesRemove = [...(db.filesRemove ?? []), String(entry.payload?.id)];
        if (entry.kind === "folder")
          db.filesRemove = [
            ...(db.filesRemove ?? []),
            ...(entry.payload?.notes ?? []).map((n: Note) => n.id),
          ];
        db.trash = db.trash.filter((t) => t.id !== tid);
        await save();
        return { ok: true };
      }
    }

    // ---- access reject: take chat / share / feedback away from a student ----
    if (url.startsWith("/api/admin/students/") && url.endsWith("/access") && method === "POST") {
      const uid = url.split("/")[4]!;
      const target = db.users.find((u) => u.id === uid);
      if (!target) throw new OfflineError("Student not found");
      const allowed = ["chat", "share", "feedback"];
      const list = Array.isArray(body?.blocked) ? body.blocked : [];
      target.blocked = list.filter((a: string) => allowed.includes(a)) as AccessArea[];
      await save();
      return { user: publicUser(target) };
    }

    // ---- admin removes chat messages ----
    if (url.startsWith("/api/admin/chat/") && method === "DELETE") {
      const parts = url.split("/");
      if (parts[4] === "message") {
        const mid = parts[5]!;
        const gone = db.chats.find((c) => c.id === mid);
        if (!gone) throw new OfflineError("Message not found");
        db.chats = db.chats.filter((c) => c.id !== mid);
        toTrash(db, "chat", gone.text || "Photo message", gone, `from ${gone.from}`, me.fullName);
        await save();
        return { ok: true };
      }
      const uid = parts[4]!;
      const thread = db.chats.filter((c) => c.userId === uid);
      if (!thread.length) throw new OfflineError("This conversation is already empty");
      db.chats = db.chats.filter((c) => c.userId !== uid);
      const owner = db.users.find((u) => u.id === uid);
      toTrash(
        db,
        "chat",
        `Conversation with ${owner?.fullName ?? "student"}`,
        thread,
        `${thread.length} message(s)`,
        me.fullName,
      );
      await save();
      return { ok: true, removed: thread.length };
    }

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

    if (url.startsWith("/api/admin/feedback/") && method === "DELETE") {
      const fid = url.split("/").pop();
      const gone = db.feedback.find((f) => f.id === fid);
      if (!gone) throw new OfflineError("Feedback not found");
      db.feedback = db.feedback.filter((f) => f.id !== fid);
      toTrash(db, "feedback", gone.userName, gone, gone.comment.slice(0, 60), me.fullName);
      save();
      return { ok: true };
    }

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
      if (method === "DELETE") {
        const gone = db.content[idx]!;
        db.content.splice(idx, 1);
        toTrash(db, "content", gone.title, gone, gone.type, me.fullName);
      } else Object.assign(db.content[idx]!, body);
      save();
      return { ok: true };
    }

    if (url.startsWith("/api/admin/notes/")) {
      const nid = url.split("/")[4]!;
      const idx = db.notes.findIndex((n) => n.id === nid);
      if (idx < 0) throw new OfflineError("Note not found");
      if (method === "DELETE") {
        const gone = db.notes[idx]!;
        db.notes.splice(idx, 1);
        toTrash(db, "note", gone.subject, gone, `${gone.fileName} · ${gone.department}`, me.fullName);
      } else {
        Object.assign(db.notes[idx]!, body);
      }
      save();
      return { ok: true };
    }

    if (url === "/api/admin/students") return { students: db.users.map(publicUser) };

    /** Admin approves (or rejects) a manual verification request. */
    if (url.startsWith("/api/admin/students/") && url.endsWith("/verify") && method === "POST") {
      const uid = url.split("/")[4]!;
      const target = db.users.find((u) => u.id === uid);
      if (!target) throw new OfflineError("Student not found");
      const approve = body?.approve !== false;
      Object.assign(target, {
        faceVerified: approve,
        identityConfirmed: approve,
        accessRequested: false,
        faceVerifiedAt: approve ? new Date().toISOString() : null,
      });
      await save();
      return { user: publicUser(target) };
    }

    /** Admin creates a student account after verifying the person face-to-face. */
    if (url === "/api/admin/create-student" && method === "POST") {
      const rid = String(body.registrationId ?? "").trim().toUpperCase();
      const pwd = String(body.password ?? "");
      const name = String(body.fullName ?? "").trim();
      const mail = String(body.email ?? "").trim();
      if (!name) throw new OfflineError("Full name is required");
      if (!rid) throw new OfflineError("Registration ID is required");
      if (pwd.length < 6) throw new OfflineError("Password must be at least 6 characters");
      if (mail && !EMAIL_RE.test(mail)) throw new OfflineError("Incorrect email ID");
      if (db.users.some((u) => u.registrationId.toUpperCase() === rid))
        throw new OfflineError("This ID is already registered");
      if (mail && db.users.some((u) => String(u.email ?? "").toLowerCase() === mail.toLowerCase()))
        throw new OfflineError("This email ID is already used by another account");
      const verified = body.verified !== false;
      const student: StoredUser = {
        id: id(),
        fullName: name,
        registrationId: rid,
        email: mail || null,
        department: String(body.department ?? "CSE"),
        year: String(body.year ?? "1 Year"),
        semester: String(body.semester ?? "1 Sem"),
        role: "student",
        sharedCount: 0,
        downloadedCount: 0,
        stars: 0,
        faceVerified: verified,
        identityConfirmed: verified,
        faceVerifiedAt: verified ? new Date().toISOString() : null,
        password: pwd,
        securityQuestion: "Created by admin",
        securityAnswer: "admin",
      };
      db.users.push(student);
      await save();
      return { user: publicUser(student) };
    }

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
      toTrash(
        db,
        "user",
        target.fullName,
        target,
        `${target.registrationId} · ${target.department}`,
        me.fullName,
      );
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
