'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { createDemoBankAccount } from '@/lib/actions/user.actions';

import { Button } from './ui/button';

/**
 * Links the built-in demo bank account.
 *
 * It replaces the Plaid Link button when no Plaid credentials are configured,
 * so a bank account (with a balance, transactions and a shareable id) can
 * always be added.
 */
const DemoBankLink = ({ user, variant }: PlaidLinkProps) => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const connect = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await createDemoBankAccount({ user });

      if (!result?.success) {
        setError(
          result?.error ?? 'We could not link the demo bank account. Please try again.'
        );
        return;
      }

      router.push('/');
      router.refresh();
    } catch (caughtError) {
      console.error('Could not link the demo bank account:', caughtError);
      setError('We could not link the demo bank account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const label = isLoading ? 'Connecting...' : 'Connect demo bank';

  return (
    <>
      {error && (
        <p role="alert" className="form-message">
          {error}
        </p>
      )}

      {variant === 'primary' ? (
        <Button
          onClick={connect}
          disabled={isLoading}
          className="plaidlink-primary"
        >
          {isLoading ? (
            <>
              <Loader2 size={20} className="animate-spin" /> &nbsp;
              {label}
            </>
          ) : (
            label
          )}
        </Button>
      ) : variant === 'ghost' ? (
        <Button onClick={connect} variant="ghost" className="plaidlink-ghost">
          <Image
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className='hiddenl text-[16px] font-semibold text-black-2 xl:block'>{label}</p>
        </Button>
      ) : (
        <Button onClick={connect} disabled={isLoading} className="plaidlink-default">
          <Image
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className='text-[16px] font-semibold text-black-2'>{label}</p>
        </Button>
      )}
    </>
  );
};

export default DemoBankLink;
