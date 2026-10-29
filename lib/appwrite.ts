import { Client, Account, Databases, Users } from "node-appwrite";
import { cookies } from "next/headers";

import {
  ENV_VARS,
  getRequiredEnvironmentVariable,
  isLocalBackend,
  MissingEnvironmentVariableError,
} from "./config";
import { LocalAccount, LocalDatabases, LocalUsers } from "./local-backend";

// Re-exported so that existing imports (`from "../appwrite"`) keep working.
export { getRequiredEnvironmentVariable, MissingEnvironmentVariableError };

function createClient({ withKey }: { withKey: boolean }) {
  const client = new Client()
    .setEndpoint(
      getRequiredEnvironmentVariable(ENV_VARS.appwriteEndpoint)
    )
    .setProject(getRequiredEnvironmentVariable(ENV_VARS.appwriteProject));

  if (withKey) {
    client.setKey(getRequiredEnvironmentVariable(ENV_VARS.appwriteApiKey));
  }

  return client;
}

export async function createSessionClient() {
  // The local backend keeps the session in the same cookie, so the session
  // client behaves exactly like the Appwrite one.
  if (isLocalBackend()) {
    const session = cookies().get("appwrite-session");

    if (!session || !session.value) {
      throw new Error("No session");
    }

    return {
      get account() {
        return new LocalAccount(session.value);
      },
    };
  }

  const client = createClient({ withKey: false });

  const session = cookies().get("appwrite-session");

  if (!session || !session.value) {
    throw new Error("No session");
  }

  client.setSession(session.value);

  return {
    get account() {
      return new Account(client);
    },
  };
}

export async function createAdminClient() {
  if (isLocalBackend()) {
    return {
      get account() {
        return new LocalAccount();
      },
      get database() {
        return new LocalDatabases();
      },
      get user() {
        return new LocalUsers();
      },
    };
  }

  const client = createClient({ withKey: true });

  return {
    get account() {
      return new Account(client);
    },
    get database() {
      return new Databases(client);
    },
    get user() {
      return new Users(client);
    },
  };
}
