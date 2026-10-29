"use server";

import { Client } from "dwolla-v2";

import {
  ENV_VARS,
  getEnvironmentVariable,
  isDwollaEmulated,
} from "../config";

/** Base url used by the emulated (local) Dwolla implementation. */
const LOCAL_DWOLLA_BASE_URL = "https://sandbox.dwolla.com/v2";

/** Generates an id that looks like a Dwolla id, for the emulated responses. */
const createLocalId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const getEnvironment = (): "production" | "sandbox" => {
  const environment = getEnvironmentVariable(ENV_VARS.dwollaEnv) || "sandbox";

  switch (environment) {
    case "sandbox":
      return "sandbox";
    case "production":
      return "production";
    default:
      throw new Error(
        "Dwolla environment should either be set to `sandbox` or `production`"
      );
  }
};

const getDwollaClient = (): Client => {
  const key = getEnvironmentVariable(ENV_VARS.dwollaKey);
  const secret = getEnvironmentVariable(ENV_VARS.dwollaSecret);

  if (!key || !secret) {
    throw new Error(
      "Dwolla credentials are missing. Set DWOLLA_KEY and DWOLLA_SECRET in your .env.local file."
    );
  }

  const client = new Client({
    environment: getEnvironment(),
    key,
    secret,
  });

  // `DWOLLA_BASE_URL` is optional, it allows pointing the app at a different
  // Dwolla host (a mock or a proxy) instead of the default sandbox/production.
  const baseUrl = getEnvironmentVariable(ENV_VARS.dwollaBaseUrl);

  if (baseUrl) {
    const normalized = baseUrl.replace(/\/$/, "");
    // `apiUrl` / `tokenUrl` are not part of the published typings.
    const endpoints = client as Client & { apiUrl: string; tokenUrl: string };

    endpoints.apiUrl = normalized;
    endpoints.tokenUrl = `${normalized}/token`;
  }

  return client;
};

// Create a Dwolla Funding Source using a Plaid Processor Token
export const createFundingSource = async (
  options: CreateFundingSourceOptions
) => {
  if (isDwollaEmulated()) {
    return `${LOCAL_DWOLLA_BASE_URL}/funding-sources/${createLocalId(
      "demo-funding-source"
    )}`;
  }

  try {
    const dwollaClient = getDwollaClient();
    return await dwollaClient
      .post(`customers/${options.customerId}/funding-sources`, {
        name: options.fundingSourceName,
        plaidToken: options.plaidToken,
      })
      .then((res) => res.headers.get("location"));
  } catch (err) {
    console.error("Creating a Funding Source Failed: ", err);
  }
};

export const createOnDemandAuthorization = async () => {
  if (isDwollaEmulated()) {
    return {
      authorization: {
        href: `${LOCAL_DWOLLA_BASE_URL}/on-demand-authorizations/${createLocalId(
          "demo-authorization"
        )}`,
      },
    };
  }

  try {
    const dwollaClient = getDwollaClient();
    const onDemandAuthorization = await dwollaClient.post(
      "on-demand-authorizations"
    );
    const authLink = onDemandAuthorization.body._links;
    return authLink;
  } catch (err) {
    console.error("Creating an On Demand Authorization Failed: ", err);
  }
};

export const createDwollaCustomer = async (
  newCustomer: NewDwollaCustomerParams
) => {
  if (isDwollaEmulated()) {
    return `${LOCAL_DWOLLA_BASE_URL}/customers/${createLocalId(
      "demo-customer"
    )}`;
  }

  try {
    const dwollaClient = getDwollaClient();
    return await dwollaClient
      .post("customers", newCustomer)
      .then((res) => res.headers.get("location"));
  } catch (err) {
    console.error("Creating a Dwolla Customer Failed: ", err);
    throw err;
  }
};

export const createTransfer = async ({
  sourceFundingSourceUrl,
  destinationFundingSourceUrl,
  amount,
}: TransferParams) => {
  if (isDwollaEmulated()) {
    return `${LOCAL_DWOLLA_BASE_URL}/transfers/${createLocalId("demo-transfer")}`;
  }

  try {
    const dwollaClient = getDwollaClient();
    const requestBody = {
      _links: {
        source: {
          href: sourceFundingSourceUrl,
        },
        destination: {
          href: destinationFundingSourceUrl,
        },
      },
      amount: {
        currency: "USD",
        value: amount,
      },
    };
    return await dwollaClient
      .post("transfers", requestBody)
      .then((res) => res.headers.get("location"));
  } catch (err) {
    console.error("Transfer fund failed: ", err);
  }
};

export const addFundingSource = async ({
  dwollaCustomerId,
  processorToken,
  bankName,
}: AddFundingSourceParams) => {
  try {
    // create dwolla auth link
    const dwollaAuthLinks = await createOnDemandAuthorization();

    // add funding source to the dwolla customer & get the funding source url
    const fundingSourceOptions = {
      customerId: dwollaCustomerId,
      fundingSourceName: bankName,
      plaidToken: processorToken,
      _links: dwollaAuthLinks,
    };
    return await createFundingSource(fundingSourceOptions);
  } catch (err) {
    console.error("Transfer fund failed: ", err);
  }
};
