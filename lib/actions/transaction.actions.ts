"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient } from "../appwrite";
import {
  getAppwriteDatabaseId,
  getAppwriteTransactionCollectionId,
} from "../config";
import { parseStringify } from "../utils";

const getDatabaseId = () => getAppwriteDatabaseId();

const getTransactionCollectionId = () => getAppwriteTransactionCollectionId();

export const createTransaction = async (transaction: CreateTransactionProps) => {
  try {
    const { database } = await createAdminClient();

    const newTransaction = await database.createDocument(
      getDatabaseId(),
      getTransactionCollectionId(),
      ID.unique(),
      {
        channel: 'online',
        category: 'Transfer',
        ...transaction
      }
    )

    return parseStringify(newTransaction);
  } catch (error) {
    console.log(error);
  }
}

export const getTransactionsByBankId = async ({bankId}: getTransactionsByBankIdProps) => {
  try {
    const { database } = await createAdminClient();

    const senderTransactions = await database.listDocuments(
      getDatabaseId(),
      getTransactionCollectionId(),
      [Query.equal('senderBankId', bankId)],
    )

    const receiverTransactions = await database.listDocuments(
      getDatabaseId(),
      getTransactionCollectionId(),
      [Query.equal('receiverBankId', bankId)],
    );

    // A transfer to yourself is returned by both queries, so the documents are
    // deduplicated to avoid showing the same transaction twice.
    const documents = Array.from(
      new Map(
        [...senderTransactions.documents, ...receiverTransactions.documents].map(
          (document) => [document.$id, document]
        )
      ).values()
    );

    const transactions = {
      total: documents.length,
      documents,
    }

    return parseStringify(transactions);
  } catch (error) {
    console.log(error);
  }
}