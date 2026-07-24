import { NextRequest } from 'next/server';
import { jsonError, jsonOk, requireUserContext, resolveRequestDbClient } from '@/lib/api-utils';
import { buildChatBootstrap, type ChatBootstrapSupabase } from '@/lib/server/chat/bootstrap';
import { getGlobalAIFeatureGuardResponse } from '@/lib/api/ai-feature-guard';

export async function GET(request: NextRequest) {
  try {
    const featureGuardResponse = await getGlobalAIFeatureGuardResponse();
    if (featureGuardResponse) return featureGuardResponse;

    const auth = await requireUserContext(request);
    if ('error' in auth) {
      return jsonError(auth.error.message, auth.error.status);
    }

    const db = resolveRequestDbClient(auth);
    if (!db) {
      return jsonError('加载对话上下文失败', 500);
    }

    const data = await buildChatBootstrap(db as unknown as ChatBootstrapSupabase, auth.user.id);
    return jsonOk({ data });
  } catch (error) {
    console.error('[chat/bootstrap] failed to build bootstrap:', error);
    return jsonError(error instanceof Error ? error.message : '加载对话上下文失败', 500);
  }
}
