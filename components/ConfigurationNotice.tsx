import {
  ENV_GROUPS,
  getMissingEnvironmentVariables,
  isLocalBackend,
} from '@/lib/config';

/**
 * Rendered on the auth pages.
 *
 * It only shows up when the app genuinely cannot run, which is the case when
 * the Appwrite Cloud backend is selected but not configured yet. The local
 * backend and the emulated Plaid/Dwolla integrations work out of the box, so
 * they are never reported as missing.
 */
const ConfigurationNotice = () => {
  // The local backend ships with the app, so there is nothing to configure.
  if (isLocalBackend()) return null;

  const missing = getMissingEnvironmentVariables(ENV_GROUPS.appwrite.required);

  if (missing.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left">
      <div className="flex flex-col gap-1">
        <h2 className="text-14 font-semibold text-amber-900">Setup required</h2>

        <p className="text-12 text-amber-800">
          Some environment variables are not set yet. Add them to{' '}
          <code className="rounded bg-amber-100 px-1 text-amber-900">
            .env.local
          </code>{' '}
          and restart the dev server.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-12 font-semibold text-amber-900">
          Required — the app cannot run without these
        </p>

        <ul className="flex flex-wrap gap-1">
          {missing.map((variable) => (
            <li
              key={variable}
              className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-11 text-amber-900"
            >
              {variable}
            </li>
          ))}
        </ul>

        <p className="text-11 text-amber-700">
          {ENV_GROUPS.appwrite.hint}
        </p>
      </div>
    </div>
  );
};

export default ConfigurationNotice;
