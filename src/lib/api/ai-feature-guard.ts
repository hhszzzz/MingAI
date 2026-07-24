import { jsonError } from '@/lib/api-utils';
import { readFeatureModuleStateFresh } from '@/lib/app-settings';

/** Return an error response when the global AI capability is unavailable. */
export async function getGlobalAIFeatureGuardResponse(): Promise<Response | null> {
  const state = await readFeatureModuleStateFresh('chat');
  if (state.status === 'disabled') {
    return jsonError('AI 功能当前未启用', 403, { success: false, code: 'FEATURE_DISABLED' });
  }
  if (state.status === 'unavailable') {
    console.error('[ai-feature-guard] feature state unavailable:', state.error);
    return jsonError('AI 功能状态暂时无法确认', 503, { success: false, code: 'FEATURE_STATE_UNAVAILABLE' });
  }
  return null;
}
