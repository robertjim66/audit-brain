'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/apiClient';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? '/cockpit' : '/login');
  }, [router]);
  return null;
}
