/**
 * A tiny, file backed implementation of the small part of the Appwrite API that
 * this app uses (accounts, sessions, documents and users).
 *
 * It exists so the app can be started and used without creating an Appwrite
 * account first. It is only used when no Appwrite API key is configured (or
 * when `APPWRITE_BACKEND=local` is set), see `lib/config.ts`.
 *
 * The data is stored in `.data/local-appwrite.json` and is never committed.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "local-appwrite.json");
const PASSWORD_SALT = "horizon-local-backend";

type StoredUser = {
  $id: string;
  name: string;
  email: string;
  passwordHash: string;
  $createdAt: string;
  bio?: string;
};

type StoredDocument = Record<string, unknown> & {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
  $databaseId: string;
  $collectionId: string;
};

type Store = {
  users: StoredUser[];
  sessions: Record<string, string>;
  documents: Record<string, StoredDocument[]>;
};

const emptyStore = (): Store => ({
  users: [],
  sessions: {},
  documents: {},
});

function readStore(): Store {
  try {
    if (!existsSync(DATA_FILE)) return emptyStore();

    const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8"));

    return { ...emptyStore(), ...parsed };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // Write to a temporary file first so a crash cannot leave a half written file.
  const temporaryFile = `${DATA_FILE}.tmp`;

  writeFileSync(temporaryFile, JSON.stringify(store, null, 2), "utf8");
  renameSync(temporaryFile, DATA_FILE);
}

function uniqueId() {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let id = "";

  for (let index = 0; index < 20; index++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return id;
}

const hashPassword = (password: string) =>
  createHash("sha256").update(`${PASSWORD_SALT}${password}`).digest("hex");

/** The public shape of a user, without the stored password hash. */
const toPublicUser = (user: StoredUser) => ({
  $id: user.$id,
  name: user.name,
  email: user.email,
  $createdAt: user.$createdAt,
  registration: user.$createdAt,
  status: true,
  bio: user.bio,
});

type Query = {
  method?: string;
  attribute?: string;
  values?: unknown[];
};

function applyQuery(document: StoredDocument, query: Query): boolean {
  const { method, attribute, values = [] } = query;

  if (!method || !attribute) return true;

  const value = (document as Record<string, unknown>)[attribute];

  switch (method) {
    case "equal":
      return Array.isArray(value)
        ? values.some((entry) => value.includes(entry))
        : values.includes(value);
    case "notEqual":
      return values.every((entry) => value !== entry);
    case "lessThan":
      return Number(value) < Number(values[0]);
    case "lessThanEqual":
      return Number(value) <= Number(values[0]);
    case "greaterThan":
      return Number(value) > Number(values[0]);
    case "greaterThanEqual":
      return Number(value) >= Number(values[0]);
    case "contains":
      return String(value ?? "")
        .toLowerCase()
        .includes(String(values[0] ?? "").toLowerCase());
    case "startsWith":
      return String(value ?? "")
        .toLowerCase()
        .startsWith(String(values[0] ?? "").toLowerCase());
    case "isNull":
      return value === null || value === undefined;
    case "isNotNull":
      return value !== null && value !== undefined;
    default:
      return true;
  }
}

/**
 * Mirrors the part of the Appwrite `Account` service that the app uses.
 */
export class LocalAccount {
  private sessionSecret?: string;

  constructor(sessionSecret?: string) {
    this.sessionSecret = sessionSecret;
  }

  async create(userId: string, email: string, password: string, name: string, prefs?: Record<string, unknown>) {
    const store = readStore();

    if (store.users.some((user) => user.email === email)) {
      throw new Error("User with the requested email already exists.");
    }

    const bio = typeof prefs?.bio === "string" ? prefs.bio : undefined;

    const user: StoredUser = {
      $id: userId || uniqueId(),
      name,
      email,
      passwordHash: hashPassword(password),
      $createdAt: new Date().toISOString(),
      bio,
    };

    store.users.push(user);
    writeStore(store);

    return toPublicUser(user);
  }

  async createEmailPasswordSession(email: string, password: string) {
    const store = readStore();
    const user = store.users.find((entry) => entry.email === email);

    if (!user || user.passwordHash !== hashPassword(password)) {
      throw new Error("Invalid credentials. Please check your email and password.");
    }

    const secret = `${uniqueId()}${uniqueId()}`;

    store.sessions[secret] = user.$id;
    writeStore(store);

    return {
      $id: uniqueId(),
      secret,
      userId: user.$id,
      expire: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  async get() {
    const store = readStore();
    const userId = this.sessionSecret ? store.sessions[this.sessionSecret] : null;
    const user = userId
      ? store.users.find((entry) => entry.$id === userId)
      : undefined;

    if (!user) {
      throw new Error("Invalid session. Please sign in again.");
    }

    return toPublicUser(user);
  }

  async deleteSession() {
    if (!this.sessionSecret) return;

    const store = readStore();

    delete store.sessions[this.sessionSecret];
    writeStore(store);
  }
}

/**
 * Mirrors the part of the Appwrite `Databases` service that the app uses.
 */
export class LocalDatabases {
  async createDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    data: Record<string, unknown> = {}
  ) {
    const store = readStore();
    const collection = store.documents[collectionId] ?? [];
    const now = new Date().toISOString();

    const document: StoredDocument = {
      $id: documentId || uniqueId(),
      ...data,
      $createdAt: now,
      $updatedAt: now,
      $permissions: [],
      $databaseId: databaseId,
      $collectionId: collectionId,
    };

    collection.push(document);
    store.documents[collectionId] = collection;
    writeStore(store);

    return document;
  }

  async listDocuments(
    databaseId: string,
    collectionId: string,
    queries: string[] = []
  ) {
    const store = readStore();
    const collection = [...(store.documents[collectionId] ?? [])];

    const parsedQueries = queries
      .map((query) => {
        try {
          return JSON.parse(query) as Query;
        } catch {
          return null;
        }
      })
      .filter((query): query is Query => query !== null);

    let documents = collection.filter((document) =>
      parsedQueries
        .filter((query) => query.method !== "limit" && query.method !== "offset")
        .every((query) => applyQuery(document, query))
    );

    const orderBy = parsedQueries.find(
      (query) => query.method === "orderAsc" || query.method === "orderDesc"
    );

    if (orderBy?.attribute) {
      const direction = orderBy.method === "orderDesc" ? -1 : 1;

      documents = [...documents].sort(
        (left, right) =>
          direction *
          String((left as Record<string, unknown>)[orderBy.attribute!]).localeCompare(
            String((right as Record<string, unknown>)[orderBy.attribute!])
          )
      );
    }

    const offset = parsedQueries.find((query) => query.method === "offset");
    const limit = parsedQueries.find((query) => query.method === "limit");

    if (offset) documents = documents.slice(Number(offset.values?.[0] ?? 0));
    if (limit) documents = documents.slice(0, Number(limit.values?.[0] ?? 25));

    return { total: documents.length, documents };
  }
}

/**
 * Mirrors the part of the Appwrite `Users` service that the app uses.
 */
export class LocalUsers {
  async delete(userId: string) {
    const store = readStore();

    store.users = store.users.filter((user) => user.$id !== userId);

    for (const [secret, sessionUserId] of Object.entries(store.sessions)) {
      if (sessionUserId === userId) delete store.sessions[secret];
    }

    writeStore(store);
  }
}

/** Removes every locally stored user and document. */
export function resetLocalBackend() {
  writeStore(emptyStore());
}
