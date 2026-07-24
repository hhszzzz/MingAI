import { getBrowserQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

function resolveInvalidationKeys(pathname: string): ReadonlyArray<readonly unknown[]> {
  if (pathname.startsWith('/api/admin/announcements') || pathname.startsWith('/api/announcements')) {
    return [queryKeys.announcementsPrefix()];
  }

  if (pathname.startsWith('/api/notifications')) {
    return [queryKeys.notificationsPrefix(), queryKeys.appBootstrapPrefix()];
  }

  if (pathname.startsWith('/api/feature-toggles')) {
    return [queryKeys.appBootstrapPrefix()];
  }

  if (pathname.startsWith('/api/user/profile')) {
    return [queryKeys.appBootstrapPrefix()];
  }

  if (pathname.startsWith('/api/user/settings')) {
    return [queryKeys.chatBootstrapPrefix()];
  }

  if (
    pathname.startsWith('/api/user/membership')
    || pathname.startsWith('/api/membership')
    || pathname.startsWith('/api/credits')
    || pathname.startsWith('/api/checkin')
    || pathname.startsWith('/api/activation-keys')
    || pathname.startsWith('/api/auth')
  ) {
    return [
      queryKeys.appBootstrapPrefix(),
      queryKeys.chatBootstrapPrefix(),
      queryKeys.modelsPrefix(),
    ];
  }

  if (pathname.startsWith('/api/admin/ai-models')) {
    return [queryKeys.modelsPrefix()];
  }

  return [];
}

export function invalidateQueriesForPath(pathname: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const queryClient = getBrowserQueryClient();
  if (!queryClient) {
    return;
  }

  for (const key of resolveInvalidationKeys(pathname)) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
