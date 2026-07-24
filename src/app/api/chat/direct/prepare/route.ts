import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/api-utils';
import {
  parseChatRequestBody,
  prepareBrowserDirectChatRequest,
} from '@/lib/server/chat/request';
import { getGlobalAIFeatureGuardResponse } from '@/lib/api/ai-feature-guard';

export async function POST(request: NextRequest) {
  try {
    const featureGuardResponse = await getGlobalAIFeatureGuardResponse();
    if (featureGuardResponse) return featureGuardResponse;

    const body = await parseChatRequestBody(request);
    if (body instanceof Response) {
      return body;
    }

    const prepared = await prepareBrowserDirectChatRequest(request, body);
    if (prepared instanceof Response) {
      return prepared;
    }

    return jsonOk({
      systemPrompt: prepared.systemPrompt,
      sanitizedMessages: prepared.sanitizedMessages,
      metadata: prepared.metadata,
      fallbackPersonality: prepared.fallbackPersonality,
      requestedModelId: prepared.requestedModelId,
    });
  } catch (error) {
    console.error('[chat/direct/prepare] error:', error);
    return jsonError('生成直连上下文失败，请稍后重试', 500);
  }
}
