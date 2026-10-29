'use server';

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import {
  getAppwriteBankCollectionId,
  getAppwriteDatabaseId,
  getAppwriteUserCollectionId,
} from "../config";
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, getErrorMessage, parseStringify } from "../utils";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";

import { plaidClient } from '@/lib/plaid';
import {
  createLocalAccessToken,
  getLocalItemId,
  LOCAL_PLAID_PROCESSOR_TOKEN,
} from '@/lib/local-plaid';
import { revalidatePath } from "next/cache";
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";

const getDatabaseId = () => getAppwriteDatabaseId();

const getUserCollectionId = () => getAppwriteUserCollectionId();

const getBankCollectionId = () => getAppwriteBankCollectionId();

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  // Missing configuration is a setup problem, so it is surfaced instead of being
  // swallowed by the catch block below.
  const databaseId = getDatabaseId();
  const userCollectionId = getUserCollectionId();

  try {
    const { database } = await createAdminClient();

    const user = await database.listDocuments(
      databaseId,
      userCollectionId,
      [Query.equal('userId', [userId])]
    )

    if (user.total === 0) return null;

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.error('Error getting user info', error);
    return null;
  }
}

export const signIn = async ({ email, password }: signInProps) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    const user = await getUserInfo({ userId: session.userId });

    if (!user) {
      throw new Error(
        "We could not find your account profile. Please sign up again."
      );
    }

    return { success: true, user: parseStringify(user) };
  } catch (error) {
    console.error('Error', error);

    return {
      success: false,
      error: getErrorMessage(
        error,
        'We could not sign you in. Please check your email and password.'
      ),
    };
  }
}

export const signUp = async ({ password, ...userData }: SignUpParams) => {
  const { email, firstName, lastName } = userData;

  let newUserAccount;

  try {
    const databaseId = getDatabaseId();
    const userCollectionId = getUserCollectionId();

    const { account, database } = await createAdminClient();

    newUserAccount = await account.create(
      ID.unique(), 
      email, 
      password, 
      `${firstName} ${lastName}`
    );

    if(!newUserAccount) throw new Error('Error creating user')

    // A Dwolla customer is created for every new account. When Dwolla is not
    // configured the call is emulated locally, so signing up always works.
    const dwollaCustomerUrl = await createDwollaCustomer({
      ...userData,
      type: 'personal',
    }).catch((error) => {
      console.error('Creating the Dwolla customer failed', error);
      return null;
    });

    const dwollaCustomerId = dwollaCustomerUrl
      ? extractCustomerIdFromUrl(dwollaCustomerUrl)
      : '';

    const newUser = await database.createDocument(
      databaseId,
      userCollectionId,
      ID.unique(),
      {
        ...userData,
        userId: newUserAccount.$id,
        dwollaCustomerId,
        dwollaCustomerUrl: dwollaCustomerUrl ?? '',
        bio: userData.bio || ''
      }
    )

    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return { success: true, user: parseStringify(newUser) };
  } catch (error) {
    console.error('Error', error);

    // The Appwrite account is created before the rest of the sign up flow.
    // When a later step fails we remove it again so the email address can be
    // reused instead of being stuck behind an "account already exists" error.
    if (newUserAccount?.$id) {
      try {
        const { user } = await createAdminClient();
        await user.delete(newUserAccount.$id);
      } catch (cleanupError) {
        console.error('Error cleaning up the user account', cleanupError);
      }
    }

    return {
      success: false,
      error: getErrorMessage(
        error,
        'We could not create your account. Please try again.'
      ),
    };
  }
}

export async function getLoggedInUser() {
  try {
    const { account } = await createSessionClient();
    const result = await account.get();

    const user = await getUserInfo({ userId: result.$id})

    return parseStringify(user);
  } catch (error) {
    console.log(error)
    return null;
  }
}

export const updateUserBio = async ({ userId, bio }: { userId: string, bio: string }) => {
  try {
    const databaseId = getDatabaseId();
    const userCollectionId = getUserCollectionId();

    const { database } = await createAdminClient();

    const user = await database.listDocuments(
      databaseId,
      userCollectionId,
      [Query.equal('userId', [userId])]
    )

    if (user.total === 0) return null;

    const updatedUser = await database.updateDocument(
      databaseId,
      userCollectionId,
      user.documents[0].$id,
      { bio }
    )

    return parseStringify(updatedUser);
  } catch (error) {
    console.error('Error updating user bio', error);
    return null;
  }
}

export const logoutAccount = async () => {
  try {
    const { account } = await createSessionClient();

    cookies().delete('appwrite-session');

    await account.deleteSession('current');

    return true;
  } catch (error) {
    console.error('Error logging out', error);
    return false;
  }
}

export const createLinkToken = async (user: User) => {
  try {
    const tokenParams = {
      user: {
        client_user_id: user.$id
      },
      client_name: `${user.firstName} ${user.lastName}`,
      products: ['auth'] as Products[],
      language: 'en',
      country_codes: ['US'] as CountryCode[],
    }

    const response = await plaidClient.linkTokenCreate(tokenParams);

    return parseStringify({ linkToken: response.data.link_token })
  } catch (error) {
    console.log(error);
  }
}

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    // Linking the same account twice would create a duplicate that breaks the
    // "one bank per account" lookups used by the transfer form.
    const existing = await database.listDocuments(
      getDatabaseId(),
      getBankCollectionId(),
      [Query.equal('accountId', [accountId]), Query.equal('userId', [userId])]
    );

    if (existing.total > 0) {
      return parseStringify(existing.documents[0]);
    }

    const bankAccount = await database.createDocument(
      getDatabaseId(),
      getBankCollectionId(),
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    )

    return parseStringify(bankAccount);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    // Exchange public token for access token and item ID
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    
    // Get account information from Plaid using the access token
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = accountsResponse.data.accounts[0];

    // Create a processor token for Dwolla using the access token and account ID
    const request: ProcessorTokenCreateRequest = {
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
    };

    const processorTokenResponse = await plaidClient.processorTokenCreate(request);
    const processorToken = processorTokenResponse.data.processor_token;

     // Create a funding source URL for the account using the Dwolla customer ID, processor token, and bank name
    const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });
    
    // If the funding source URL is not created, throw an error
    if (!fundingSourceUrl) {
      throw new Error(
        "Could not create the Dwolla funding source. Please check your Dwolla credentials."
      );
    }

    // Create a bank account using the user ID, item ID, account ID, access token, funding source URL, and shareableId ID
    await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: encryptId(accountData.account_id),
    });

    // Revalidate the path to reflect the changes
    revalidatePath("/");

    // Return a success message
    return parseStringify({
      publicTokenExchange: "complete",
    });
  } catch (error) {
    console.error("An error occurred while creating exchanging token:", error);
    throw error;
  }
}

/**
 * Links the built-in demo bank account.
 *
 * This is used when Plaid is not configured: instead of opening the Plaid Link
 * window the demo account is created straight away, so the dashboard has a
 * balance, transactions and a shareable id to work with.
 */
export const createDemoBankAccount = async ({ user }: createDemoBankAccountProps) => {
  try {
    // Every user gets their own demo account, so several accounts can be
    // linked and funds can be transferred between them.
    const accessToken = createLocalAccessToken(user.$id);

    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = accountsResponse.data.accounts[0];

    if (!accountData) {
      throw new Error('The demo bank account could not be loaded.');
    }

    const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken: LOCAL_PLAID_PROCESSOR_TOKEN,
      bankName: accountData.name,
    });

    await createBankAccount({
      userId: user.$id,
      bankId: getLocalItemId(accessToken),
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl: fundingSourceUrl ?? '',
      shareableId: encryptId(accountData.account_id),
    });

    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('An error occurred while linking the demo bank account:', error);

    return {
      success: false,
      error: getErrorMessage(
        error,
        'We could not link the demo bank account. Please try again.'
      ),
    };
  }
}

export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const banks = await database.listDocuments(
      getDatabaseId(),
      getBankCollectionId(),
      [Query.equal('userId', [userId])]
    )

    return parseStringify(banks.documents);
  } catch (error) {
    console.log(error)
  }
}

export const getBank = async ({ documentId }: getBankProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      getDatabaseId(),
      getBankCollectionId(),
      [Query.equal('$id', [documentId])]
    )

    if (bank.total !== 1) return null;

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}

export const getBankByAccountId = async ({ accountId }: getBankByAccountIdProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      getDatabaseId(),
      getBankCollectionId(),
      [Query.equal('accountId', [accountId])]
    )

    if(bank.total !== 1) return null;

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}
