'use client';

import type { ReactNode } from 'react';
import { useFeatureToggles } from '@/lib/hooks/useFeatureToggles';

/** Fail-closed browser gate for every AI-only surface. */
export function AIFeatureGate({ children }: { children: ReactNode }) {
  const { loaded, isFeatureEnabled } = useFeatureToggles();
  if (!loaded || !isFeatureEnabled('chat')) return null;
  return <>{children}</>;
}
