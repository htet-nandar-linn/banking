import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

import { ENV_VARS, getEnvironmentVariable, isPlaidConfigured } from './config';
import { createLocalPlaidClient } from './local-plaid';

const getPlaidEnvironment = () => {
  const environment = getEnvironmentVariable(ENV_VARS.plaidEnv) || 'sandbox';

  switch (environment) {
    case 'production':
      return PlaidEnvironments.production;
    case 'development':
      return PlaidEnvironments.development;
    case 'sandbox':
    default:
      return PlaidEnvironments.sandbox;
  }
};

const configuration = new Configuration({
  basePath: getPlaidEnvironment(),
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    }
  }
})

export const plaidClient: PlaidApi = isPlaidConfigured()
  ? new PlaidApi(configuration)
  : createLocalPlaidClient();
