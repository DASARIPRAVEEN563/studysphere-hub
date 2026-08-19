/** Server-only credential logic: sign-up, login, security-question recovery. */
type AnyDoc = any;

/**
 * Master-admin credentials never live in the repository: they come from the
 * MASTER_ADMIN_ID / MASTER_ADMIN_PASSWORD environment secrets so the code can
 * be pushed to GitHub safely.
 */
const masterId = () => (process.env["MASTER_ADMIN_ID"] || "MASTERADMIN").toUpperCase();
const masterPassword = () => process.env["MASTER_ADMIN_PASSWORD"] || "";

const newId = () => Math.random().toString(36).slice(2, 11);

export function seedDoc(input: AnyDoc): { doc: AnyDoc; changed: boolean } {
  const SUPER_ADMIN_ID = masterId();
  const doc: AnyDoc = {
    users: [],
    notes: [],
    content: [],
    files: {},
    feedback: [],
    chats: [],
    likes: {},
    notifications: [],
    ...input,
  };
  let changed = Object.keys(input).length === 0;
  if (!doc.users.some((u: AnyDoc) => u.registrationId === SUPER_ADMIN_ID)) {
    doc.users.push({
      id: newId(),
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
      password: masterPassword(),
      securityQuestion: "Master admin",
      securityAnswer: "praveen",
      identityConfirmed: true,
    });
    changed = true;
  }
  if (!doc.users.some((u: AnyDoc) => u.role === "admin" && u.registrationId !== SUPER_ADMIN_ID)) {
    doc.users.push({
      id: newId(),
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
    changed = true;
  }
  if (!doc.content.length) {
    doc.content.push(
      {
        id: newId(),
        type: "notice",
        title: "Welcome to Students Ka Notes Sharing Hub",
        description: "Upload your subject notes and help your classmates ace the semester.",
        createdAt: new Date().toISOString(),
      },
      {
        id: newId(),
        type: "notice",
        title: "Mid-term exams schedule released",
        description: "Check the timetable section for department-wise timings.",
        createdAt: new Date().toISOString(),
      },
    );
    changed = true;
  }
  return { doc, changed };
}

function publicUser(u: AnyDoc) {
  const { password: _p, securityAnswer: _a, resetCode: _r, resetAt: _t, ...rest } = u;
  return { stars: 0, faceVerified: false, identityConfirmed: false, ...rest };
}

export function handleAuth(
  path: string,
  body: AnyDoc,
  doc: AnyDoc,
): { payload: AnyDoc; persist: boolean } {
  const SUPER_ADMIN_ID = masterId();
  const users: AnyDoc[] = doc.users;
  const rid = String(body.registrationId ?? "").trim();
  const find = () => users.find((u) => u.registrationId.toLowerCase() === rid.toLowerCase());

  if (path === "/api/auth/signup") {
    if (find()) throw new Error("Registration ID already exists");
    const mail = String(body.email ?? "").trim();
    if (mail && users.some((u) => String(u.email ?? "").trim().toLowerCase() === mail.toLowerCase()))
      throw new Error("This email ID is already used by another account");
    const user: AnyDoc = {
      id: newId(),
      fullName: body.fullName,
      registrationId: rid,
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
      email: String(body.email ?? "").trim() || null,
    };
    users.push(user);
    return { payload: { token: `offline.${user.id}`, user: publicUser(user) }, persist: true };
  }

  if (path === "/api/auth/login") {
    const master = masterPassword();
    if (rid.toUpperCase() === SUPER_ADMIN_ID && !!master && body.password === master) {
      const sa = users.find((u) => u.registrationId === SUPER_ADMIN_ID)!;
      sa.password = master;
      sa.role = "admin";
      return { payload: { token: `offline.${sa.id}`, user: publicUser(sa) }, persist: true };
    }
    const u = find();
    if (!u || u.password !== body.password) throw new Error("Invalid registration ID or password");
    return { payload: { token: `offline.${u.id}`, user: publicUser(u) }, persist: false };
  }

  // Password recovery by email code: step 1 issues the code, step 2 resets.
  if (path === "/api/auth/forgot/code") {
    const u = find();
    if (!u) throw new Error("No account with that registration ID");
    const mail = String(u.email ?? "").trim();
    if (!mail)
      throw new Error(
        "No email ID is saved on this account — ask the admin to reset your password.",
      );
    const code = String(Math.floor(100000 + Math.random() * 900000));
    u.resetCode = code;
    u.resetAt = Date.now();
    return {
      payload: {
        email: mail,
        fullName: u.fullName,
        code,
        registrationId: u.registrationId,
        department: u.department,
        year: u.year,
        semester: u.semester,
      },
      persist: true,
    };
  }

  if (path === "/api/auth/forgot/reset") {
    const u = find();
    if (!u) throw new Error("No account with that registration ID");
    const code = String(body.code ?? "").trim();
    if (!u.resetCode || code !== String(u.resetCode))
      throw new Error("Incorrect verification code");
    if (u.resetAt && Date.now() - Number(u.resetAt) > 20 * 60 * 1000)
      throw new Error("This code has expired — request a new one");
    if (String(body.newPassword ?? "").length < 6)
      throw new Error("Password must be at least 6 characters");
    u.password = body.newPassword;
    u.resetCode = null;
    return {
      payload: {
        ok: true,
        email: u.email ?? null,
        fullName: u.fullName,
        registrationId: u.registrationId,
        department: u.department,
        year: u.year,
        semester: u.semester,
      },
      persist: true,
    };
  }

  throw new Error("Unknown auth request");
}
