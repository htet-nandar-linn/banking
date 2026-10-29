#!/usr/bin/env node
/**
 * Provisions the Appwrite backend this app needs and writes the resulting
 * identifiers into `.env.local`.
 *
 * Why this exists: the app needs an Appwrite database plus three collections
 * (`users`, `banks`, `transactions`). Creating those by hand in the console and
 * copy/pasting five random IDs into `.env.local` is exactly how you end up with
 * an "APPWRITE_DATABASE_ID is not configured" error.
 *
 * Usage:
 *   npm run setup:appwrite            # create what is missing and write .env.local
 *   npm run setup:appwrite -- --check # only report the current configuration
 *
 * Requirements:
 *   - NEXT_PUBLIC_APPWRITE_PROJECT in .env.local
 *   - NEXT_APPWRITE_KEY in .env.local (an API key with the scopes listed below)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const ENV_FILE = resolve(ROOT, '.env.local');

const DATABASE_ID = 'horizon';

const COLLECTIONS = {
  users: {
    name: 'Users',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'email', type: 'email', required: false },
      { key: 'firstName', type: 'string', size: 64, required: false },
      { key: 'lastName', type: 'string', size: 64, required: false },
      { key: 'address1', type: 'string', size: 128, required: false },
      { key: 'city', type: 'string', size: 64, required: false },
      { key: 'state', type: 'string', size: 8, required: false },
      { key: 'postalCode', type: 'string', size: 16, required: false },
      { key: 'dateOfBirth', type: 'string', size: 32, required: false },
      { key: 'ssn', type: 'string', size: 32, required: false },
      { key: 'dwollaCustomerId', type: 'string', size: 64, required: false },
      { key: 'dwollaCustomerUrl', type: 'string', size: 255, required: false },
    ],
  },
  banks: {
    name: 'Banks',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'bankId', type: 'string', size: 64, required: false },
      { key: 'accountId', type: 'string', size: 64, required: false },
      { key: 'accessToken', type: 'string', size: 255, required: false },
      { key: 'fundingSourceUrl', type: 'string', size: 255, required: false },
      { key: 'shareableId', type: 'string', size: 255, required: false },
    ],
  },
  transactions: {
    name: 'Transactions',
    attributes: [
      { key: 'name', type: 'string', size: 128, required: false },
      { key: 'amount', type: 'string', size: 32, required: false },
      { key: 'channel', type: 'string', size: 32, required: false },
      { key: 'category', type: 'string', size: 64, required: false },
      { key: 'email', type: 'email', required: false },
      { key: 'senderId', type: 'string', size: 64, required: false },
      { key: 'senderBankId', type: 'string', size: 64, required: false },
      { key: 'receiverId', type: 'string', size: 64, required: false },
      { key: 'receiverBankId', type: 'string', size: 64, required: false },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* .env handling                                                              */
/* -------------------------------------------------------------------------- */

function parseEnvFile(path) {
  if (!existsSync(path)) return {};

  const values = {};

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);

    if (!match) continue;
    if (line.trim().startsWith('#')) continue;

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[match[1]] = value;
  }

  return values;
}

function writeEnvFile(path, updates) {
  let content = existsSync(path) ? readFileSync(path, 'utf8') : '';

  if (content && !content.endsWith('\n')) content += '\n';

  for (const [key, value] of Object.entries(updates)) {
    const line = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');

    content = line.test(content)
      ? content.replace(line, `${key}=${value}`)
      : `${content}${key}=${value}\n`;
  }

  writeFileSync(path, content, 'utf8');
}

/* -------------------------------------------------------------------------- */
/* Appwrite REST helpers                                                      */
/* -------------------------------------------------------------------------- */

function createClient({ endpoint, project, key }) {
  const headers = {
    'content-type': 'application/json',
    'x-appwrite-project': project,
    'x-appwrite-key': key,
  };

  async function request(method, path, body) {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let payload = {};

    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }

    return { ok: response.ok, status: response.status, payload };
  }

  return {
    request,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
  };
}

function describeError(result) {
  const { status, payload } = result;

  return `HTTP ${status}${payload?.message ? ` - ${payload.message}` : ''}`;
}

/* -------------------------------------------------------------------------- */
/* Provisioning                                                               */
/* -------------------------------------------------------------------------- */

async function ensureDatabase(client, name) {
  const existing = await client.get(`/databases/${DATABASE_ID}`);

  if (existing.ok) {
    console.log(`  ✓ database "${DATABASE_ID}" already exists`);
    return existing.payload.$id;
  }

  const created = await client.post('/databases', {
    databaseId: DATABASE_ID,
    name,
    enabled: true,
  });

  if (!created.ok) {
    throw new Error(`Could not create the database: ${describeError(created)}`);
  }

  console.log(`  ✓ created database "${DATABASE_ID}"`);
  return created.payload.$id;
}

async function ensureCollection(client, databaseId, id, definition) {
  const existing = await client.get(
    `/databases/${databaseId}/collections/${id}`
  );

  if (!existing.ok) {
    const created = await client.post(
      `/databases/${databaseId}/collections`,
      {
        collectionId: id,
        name: definition.name,
        permissions: [
          'read("any")',
          'create("server")',
          'update("server")',
          'delete("server")',
        ],
        documentSecurity: false,
        enabled: true,
      }
    );

    if (!created.ok) {
      throw new Error(
        `Could not create the collection "${id}": ${describeError(created)}`
      );
    }

    console.log(`  ✓ created collection "${id}"`);
  } else {
    console.log(`  ✓ collection "${id}" already exists`);
  }

  await ensureAttributes(client, databaseId, id, definition.attributes);
}

async function ensureAttributes(client, databaseId, collectionId, attributes) {
  const current = await client.get(
    `/databases/${databaseId}/collections/${collectionId}/attributes`
  );

  const existing = new Set(
    current.ok ? current.payload.attributes.map((attribute) => attribute.key) : []
  );

  for (const attribute of attributes) {
    if (existing.has(attribute.key)) continue;

    const body = { key: attribute.key, required: attribute.required ?? false };

    if (attribute.type === 'string') body.size = attribute.size ?? 64;
    if (attribute.type === 'email') body.array = false;

    const created = await client.post(
      `/databases/${databaseId}/collections/${collectionId}/attributes/${attribute.type}`,
      body
    );

    if (!created.ok) {
      throw new Error(
        `Could not create the attribute "${collectionId}.${attribute.key}": ${describeError(created)}`
      );
    }

    console.log(`  ✓ created attribute "${collectionId}.${attribute.key}"`);
  }
}

/**
 * Appwrite creates attributes asynchronously, a document can only be written
 * once every attribute of its collection is available.
 */
async function waitForAttributes(client, databaseId, collectionId) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await client.get(
      `/databases/${databaseId}/collections/${collectionId}/attributes`
    );

    if (!response.ok) return;

    const pending = response.payload.attributes.filter(
      (attribute) => attribute.status !== 'available'
    );

    if (pending.length === 0) return;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.warn(
    `  ! the attributes of "${collectionId}" are still processing, give it a moment`
  );
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

function printInstructions() {
  console.log(`
The Appwrite API key is missing, so the database cannot be created yet.

1. Open https://cloud.appwrite.io/console and select your project
2. Go to "Overview" -> "Integrations" -> "API Keys" -> "Add API key"
3. Give it these scopes:
     databases.read, databases.write,
     collections.read, collections.write,
     attributes.read, attributes.write
4. Copy the key into .env.local:

     NEXT_APPWRITE_KEY=your_api_key_here

5. Run this command again:

     npm run setup:appwrite
`);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const env = parseEnvFile(ENV_FILE);

  const endpoint = (env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1').replace(
    /\/$/,
    ''
  );
  const project = env.NEXT_PUBLIC_APPWRITE_PROJECT || '';
  const key = env.NEXT_APPWRITE_KEY || '';

  console.log('Appwrite setup');
  console.log(`  endpoint : ${endpoint}`);
  console.log(`  project  : ${project || '(not set)'}`);
  console.log(`  api key  : ${key ? 'set' : '(not set)'}`);

  if (!project) {
    console.error(
      '\nNEXT_PUBLIC_APPWRITE_PROJECT is not set. Add your Appwrite project ID to .env.local.'
    );
    process.exitCode = 1;
    return;
  }

  if (!key) {
    printInstructions();
    process.exitCode = 1;
    return;
  }

  const client = createClient({ endpoint, project, key });

  const probe = await client.get('/databases');

  if (!probe.ok) {
    console.error(
      `\nThe Appwrite API key was rejected: ${describeError(probe)}`
    );
    console.error(
      'Check that the key belongs to this project and has the databases.read scope.'
    );
    process.exitCode = 1;
    return;
  }

  if (checkOnly) {
    console.log('\nThe API key works. Nothing else to do.');
    return;
  }

  console.log('\nProvisioning the database');

  const databaseId = await ensureDatabase(client, 'Horizon');

  for (const [id, definition] of Object.entries(COLLECTIONS)) {
    await ensureCollection(client, databaseId, id, definition);
    await waitForAttributes(client, databaseId, id);
  }

  const updates = {
    APPWRITE_DATABASE_ID: databaseId,
    APPWRITE_USER_COLLECTION_ID: 'users',
    APPWRITE_BANK_COLLECTION_ID: 'banks',
    APPWRITE_TRANSACTION_COLLECTION_ID: 'transactions',
  };

  writeEnvFile(ENV_FILE, updates);

  console.log('\nWrote the following values to .env.local:');

  for (const [key, value] of Object.entries(updates)) {
    console.log(`  ${key}=${value}`);
  }

  console.log(`
Next steps
  1. Restart the dev server:  npm run dev
  2. Add your Plaid and Dwolla sandbox credentials to .env.local to link a bank account:
       PLAID_CLIENT_ID / PLAID_SECRET   https://dashboard.plaid.com/developers/keys
       DWOLLA_KEY / DWOLLA_SECRET       https://dashboard.dwolla.com/keys
`);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
