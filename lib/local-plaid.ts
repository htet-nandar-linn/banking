/**
 * A small stand-in for Plaid.
 *
 * Whenever no Plaid credentials are configured the app emulates the handful of
 * Plaid endpoints it uses, so a bank account can be linked, balances can be
 * shown and transactions can be listed without creating a Plaid account first.
 *
 * The data below is obviously fake, the institution is called "Horizon Demo
 * Bank" so it is never mistaken for a real account. Every user gets their own
 * demo account (the account id is derived from the access token), so several
 * accounts can be linked and money can be transferred between them.
 */

import { PlaidApi } from "plaid";

export const LOCAL_PLAID_PROCESSOR_TOKEN = "processor-sandbox-local-demo";
export const LOCAL_PLAID_INSTITUTION_ID = "ins_local_demo";
export const LOCAL_PLAID_LINK_TOKEN = "link-sandbox-local-demo";

export const LOCAL_PLAID_INSTITUTION = {
  institution_id: LOCAL_PLAID_INSTITUTION_ID,
  name: "Horizon Demo Bank",
  products: ["auth", "transactions"],
  country_codes: ["US"],
  url: "https://horizon.demo",
  logo: null,
};

/**
 * A tiny deterministic string hash (FNV-1a). It is used instead of
 * `node:crypto` so the module stays safe to import anywhere.
 */
const hash = (value: string) => {
  let result = 0x811c9dc5;

  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }

  return result.toString(36);
};

/** Creates the access token that is stored for a demo bank account. */
export const createLocalAccessToken = (seed: string) =>
  `access-sandbox-local-${hash(seed)}`;

/** The demo account id that belongs to an access token. */
export const getLocalAccountId = (accessToken: string) =>
  `acc_local_${hash(accessToken)}`;

/** The demo item id that belongs to an access token. */
export const getLocalItemId = (accessToken: string) =>
  `item_local_${hash(accessToken)}`;

/** The demo account that belongs to an access token. */
export const createLocalAccount = (accessToken: string) => ({
  account_id: getLocalAccountId(accessToken),
  balances: {
    available: 2450.75,
    current: 2450.75,
    limit: null,
    iso_currency_code: "USD",
    unofficial_currency_code: null,
  },
  name: "Horizon Demo Checking",
  official_name: "Horizon Demo Bank Checking",
  mask: "0000",
  type: "depository",
  subtype: "checking",
  item_id: getLocalItemId(accessToken),
});

const DAY_IN_MS = 86_400_000;

/** A Plaid date (`YYYY-MM-DD`) `days` days before today. */
const daysAgo = (days: number, hour = 12) => {
  const date = new Date(Date.now() - days * DAY_IN_MS);

  date.setHours(hour, 0, 0, 0);

  return date.toISOString().slice(0, 10);
};

type DemoTransaction = {
  transaction_id: string;
  name: string;
  amount: number;
  payment_channel: string;
  category: string[];
  date: string;
  pending: boolean;
  logo_url: string | null;
  account_id: string;
};

const DEMO_TRANSACTIONS: Array<{
  name: string;
  amount: number;
  paymentChannel: string;
  category: string;
  daysAgo: number;
}> = [
  { name: "Acme Corp Payroll", amount: -3200, paymentChannel: "ach", category: "Income", daysAgo: 1 },
  { name: "Whole Foods Market", amount: 86.42, paymentChannel: "in store", category: "Food and Drink", daysAgo: 1 },
  { name: "Amazon", amount: 54.99, paymentChannel: "online", category: "Shopping", daysAgo: 2 },
  { name: "Shell Gas Station", amount: 52.17, paymentChannel: "in store", category: "Travel", daysAgo: 3 },
  { name: "Blue Bottle Coffee", amount: 6.75, paymentChannel: "in store", category: "Food and Drink", daysAgo: 3 },
  { name: "Netflix", amount: 22.99, paymentChannel: "online", category: "Entertainment", daysAgo: 4 },
  { name: "Monthly Rent", amount: 1450, paymentChannel: "ach", category: "Housing", daysAgo: 6 },
  { name: "Everlane", amount: 78.5, paymentChannel: "online", category: "Shopping", daysAgo: 8 },
];

/** The demo transactions that belong to an access token. */
export const createLocalTransactions = (accessToken: string) => {
  const accountId = getLocalAccountId(accessToken);
  const suffix = hash(accessToken);

  return DEMO_TRANSACTIONS.map<DemoTransaction>((transaction, index) => ({
    transaction_id: `txn_local_${suffix}_${index}`,
    name: transaction.name,
    amount: transaction.amount,
    payment_channel: transaction.paymentChannel,
    category: [transaction.category],
    date: daysAgo(transaction.daysAgo, index % 2 === 0 ? 9 : 18),
    pending: false,
    logo_url: null,
    account_id: accountId,
  }));
};

/**
 * Builds a client that implements the Plaid endpoints the app uses. It is
 * typed as `PlaidApi` so it can be swapped in transparently.
 */
export const createLocalPlaidClient = (): PlaidApi => {
  const requestId = "req_local_demo";

  const client = {
    linkTokenCreate: async () => ({
      data: {
        link_token: LOCAL_PLAID_LINK_TOKEN,
        expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        request_id: requestId,
      },
    }),

    itemPublicTokenExchange: async () => ({
      data: {
        access_token: `access-sandbox-local-${requestId}`,
        item_id: `item_local_${requestId}`,
        request_id: requestId,
      },
    }),

    processorTokenCreate: async () => ({
      data: {
        processor_token: LOCAL_PLAID_PROCESSOR_TOKEN,
        request_id: requestId,
      },
    }),

    accountsGet: async ({ access_token }: { access_token?: string }) => ({
      data: {
        accounts: [createLocalAccount(access_token ?? requestId)],
        item: {
          institution_id: LOCAL_PLAID_INSTITUTION_ID,
          item_id: getLocalItemId(access_token ?? requestId),
          request_id: requestId,
        },
        request_id: requestId,
      },
    }),

    institutionsGetById: async () => ({
      data: {
        institution: LOCAL_PLAID_INSTITUTION,
        request_id: requestId,
      },
    }),

    transactionsSync: async ({ access_token }: { access_token?: string }) => ({
      data: {
        added: createLocalTransactions(access_token ?? requestId),
        modified: [],
        removed: [],
        next_cursor: "cursor-local-demo",
        has_more: false,
        request_id: requestId,
      },
    }),
  };

  return client as unknown as PlaidApi;
};
