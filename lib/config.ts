/**
 * Central place where every environment variable the app relies on is declared.
 *
 * Having them in one place allows us to:
 *  - validate the environment once, instead of failing halfway through a request
 *  - tell the user exactly which variable is missing (instead of a 500 with a stack trace)
 *  - reference the variables by name everywhere else in the codebase
 */

export const ENV_VARS = {
  siteUrl: "NEXT_PUBLIC_SITE_URL",

  appwriteBackend: "APPWRITE_BACKEND",
  appwriteEndpoint: "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  appwriteProject: "NEXT_PUBLIC_APPWRITE_PROJECT",
  appwriteApiKey: "NEXT_APPWRITE_KEY",
  appwriteDatabaseId: "APPWRITE_DATABASE_ID",
  appwriteUserCollectionId: "APPWRITE_USER_COLLECTION_ID",
  appwriteBankCollectionId: "APPWRITE_BANK_COLLECTION_ID",
  appwriteTransactionCollectionId: "APPWRITE_TRANSACTION_COLLECTION_ID",

  plaidClientId: "PLAID_CLIENT_ID",
  plaidSecret: "PLAID_SECRET",
  plaidEnv: "PLAID_ENV",
  plaidProducts: "PLAID_PRODUCTS",
  plaidCountryCodes: "PLAID_COUNTRY_CODES",

  dwollaKey: "DWOLLA_KEY",
  dwollaSecret: "DWOLLA_SECRET",
  dwollaEnv: "DWOLLA_ENV",
  dwollaBaseUrl: "DWOLLA_BASE_URL",
} as const;

export type EnvVarName = (typeof ENV_VARS)[keyof typeof ENV_VARS];

export type EnvGroupId = "appwrite" | "plaid" | "dwolla";

export type EnvGroup = {
  id: EnvGroupId;
  label: string;
  required: readonly string[];
  hint: string;
};

/**
 * `appwrite` powers authentication and the database, so it is the only hard
 * requirement for the app to boot. Plaid and Dwolla are only needed to link a
 * bank account / move money around.
 *
 * When the local backend is used the Appwrite group is satisfied by the
 * built-in file backed database, so it is not reported as missing.
 */
export const ENV_GROUPS: Record<EnvGroupId, EnvGroup> = {
  appwrite: {
    id: "appwrite",
    label: "Appwrite (authentication & database)",
    required: [
      ENV_VARS.appwriteEndpoint,
      ENV_VARS.appwriteProject,
      ENV_VARS.appwriteApiKey,
      ENV_VARS.appwriteDatabaseId,
      ENV_VARS.appwriteUserCollectionId,
      ENV_VARS.appwriteBankCollectionId,
      ENV_VARS.appwriteTransactionCollectionId,
    ],
    hint: "Run `npm run setup:appwrite` to create the database and collections automatically.",
  },
  plaid: {
    id: "plaid",
    label: "Plaid (link your bank accounts)",
    required: [ENV_VARS.plaidClientId, ENV_VARS.plaidSecret],
    hint: "Get sandbox credentials from https://dashboard.plaid.com/developers/keys",
  },
  dwolla: {
    id: "dwolla",
    label: "Dwolla (funding sources & transfers)",
    required: [ENV_VARS.dwollaKey, ENV_VARS.dwollaSecret],
    hint: "Get sandbox credentials from https://dashboard.dwolla.com/keys - a Dwolla customer is created during sign up.",
  },
};

/**
 * Identifiers used by the built-in local backend. They only have to be stable,
 * they are never sent to a server.
 */
export const LOCAL_APPWRITE_IDS = {
  databaseId: "horizon",
  userCollectionId: "users",
  bankCollectionId: "banks",
  transactionCollectionId: "transactions",
} as const;

/**
 * The app can run against Appwrite Cloud or against the built-in local
 * backend (a small file backed implementation of the Appwrite API, see
 * `lib/local-backend.ts`).
 *
 * The backend is chosen by the `APPWRITE_BACKEND` variable:
 *  - `cloud` -> always use Appwrite Cloud
 *  - `local` -> always use the local backend
 *  - not set -> use Appwrite Cloud when an API key is available, otherwise
 *               fall back to the local backend so the app still works.
 */
export function isLocalBackend(): boolean {
  const backend = getEnvironmentVariable(ENV_VARS.appwriteBackend)?.toLowerCase();

  if (backend === "local") return true;
  if (backend === "cloud") return false;

  return !getEnvironmentVariable(ENV_VARS.appwriteApiKey);
}

export class MissingEnvironmentVariableError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(
      `${variable} is not configured. Add it to .env.local and restart the dev server.`
    );
    this.name = "MissingEnvironmentVariableError";
    this.variable = variable;
  }
}

/** Reads a variable from the environment, trimming whitespace. */
export function getEnvironmentVariable(name: string): string | undefined {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

/**
 * Reads a variable from the environment and throws a descriptive error when it
 * is missing. Use this for variables that are strictly required to fulfil the
 * request that is currently being handled.
 */
export function getRequiredEnvironmentVariable(name: string): string {
  const value = getEnvironmentVariable(name);

  if (!value) {
    throw new MissingEnvironmentVariableError(name);
  }

  return value;
}

/** Returns the names of the variables that are not configured yet. */
export function getMissingEnvironmentVariables(
  names: readonly string[] = ENV_GROUPS.appwrite.required
): string[] {
  return names.filter((name) => !getEnvironmentVariable(name));
}

export type ServiceStatus = {
  id: EnvGroupId;
  label: string;
  hint: string;
  configured: boolean;
  missing: string[];
  /** True when the service is replaced by a local implementation. */
  emulated: boolean;
};

/** Status of every third party service the app integrates with. */
export function getServiceStatus(): ServiceStatus[] {
  const localBackend = isLocalBackend();

  return (Object.keys(ENV_GROUPS) as EnvGroupId[]).map((id) => {
    const group = ENV_GROUPS[id];
    // The local backend replaces Appwrite completely, so nothing is missing.
    const missing =
      localBackend && id === "appwrite"
        ? []
        : getMissingEnvironmentVariables(group.required);

    return {
      id,
      label: group.label,
      hint: group.hint,
      configured: missing.length === 0,
      missing,
      emulated:
        id === "appwrite" ? localBackend : id === "plaid" ? isPlaidEmulated() : isDwollaEmulated(),
    };
  });
}

/** True when the app has everything it needs to handle an authentication request. */
export function isAppwriteConfigured(): boolean {
  if (isLocalBackend()) return true;

  return getMissingEnvironmentVariables(ENV_GROUPS.appwrite.required).length === 0;
}

/** True when Plaid is configured, so bank accounts can be linked. */
export function isPlaidConfigured(): boolean {
  return (
    getMissingEnvironmentVariables(ENV_GROUPS.plaid.required).length === 0
  );
}

/** True when Dwolla is configured, so funding sources and transfers work. */
export function isDwollaConfigured(): boolean {
  return (
    getMissingEnvironmentVariables(ENV_GROUPS.dwolla.required).length === 0
  );
}

/**
 * Plaid is emulated with the built-in demo data whenever no credentials are
 * configured, so a bank account can always be linked.
 */
export function isPlaidEmulated(): boolean {
  return !isPlaidConfigured();
}

/**
 * A Dwolla funding source is created from a Plaid token, so the Dwolla side is
 * emulated as well when Plaid is emulated. Otherwise the transfer would fail
 * on a token that does not exist.
 */
export function isDwollaEmulated(): boolean {
  return !isDwollaConfigured() || isPlaidEmulated();
}

/**
 * Reads an identifier, falling back to the local defaults when the local
 * backend is used. Throws when the variable is missing and the cloud backend
 * is active.
 */
function getIdentifier(
  name: string,
  localFallback: string
): string {
  const value = getEnvironmentVariable(name);

  if (value) return value;

  if (isLocalBackend()) return localFallback;

  throw new MissingEnvironmentVariableError(name);
}

export const getAppwriteDatabaseId = () =>
  getIdentifier(ENV_VARS.appwriteDatabaseId, LOCAL_APPWRITE_IDS.databaseId);

export const getAppwriteUserCollectionId = () =>
  getIdentifier(
    ENV_VARS.appwriteUserCollectionId,
    LOCAL_APPWRITE_IDS.userCollectionId
  );

export const getAppwriteBankCollectionId = () =>
  getIdentifier(
    ENV_VARS.appwriteBankCollectionId,
    LOCAL_APPWRITE_IDS.bankCollectionId
  );

export const getAppwriteTransactionCollectionId = () =>
  getIdentifier(
    ENV_VARS.appwriteTransactionCollectionId,
    LOCAL_APPWRITE_IDS.transactionCollectionId
  );
