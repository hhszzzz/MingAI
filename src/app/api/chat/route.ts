/**
 * AI 对话 API 路由
 *
 * 路由仅负责协议层：
 * - 请求解析与错误边界
 * - 复用 server-only chat orchestration
 * - 返回 JSON / SSE 响应
 */

import { NextRequest } from 'next/server';
import { isTextUIPart } from 'ai';
import {
  callAI,
  callAIUIMessageResult,
} from '@/lib/ai/ai';
import { extractAIErrorInfo } from '@/lib/ai/ai-error';
import { refundCreditsOrLog } from '@/lib/user/credits';
import { jsonError, jsonOk } from '@/lib/api-utils';
import {
  parseChatRequestBody,
  prepareChatRequest,
} from '@/lib/server/chat/request';
import { getGlobalAIFeatureGuardResponse } from '@/lib/api/ai-feature-guard';

export async function POST(request: NextRequest) {
  let creditDeducted = false;
  let userId: string | null = null;
  let canSkipCredit = false;

  try {
    const featureGuardResponse = await getGlobalAIFeatureGuardResponse();
    if (featureGuardResponse) return featureGuardResponse;

    const body = await parseChatRequestBody(request);
    if (body instanceof Response) {
      return body;
    }

    const preparedRequest = await prepareChatRequest(request, body);
    if (preparedRequest instanceof Response) {
      return preparedRequest;
    }

    ({
      creditDeducted,
      userId,
      canSkipCredit,
    } = preparedRequest);

    const {
      body: resolvedBody,
      requestedModelId,
      reasoningEnabled,
      sanitizedMessages,
      metadata,
      fallbackPersonality,
      systemPrompt,
    } = preparedRequest;

    console.log(`[chat-route] personality=${fallbackPersonality} systemPromptLen=${systemPrompt?.length ?? 0} stream=${resolvedBody.stream} model=${requestedModelId}`);

    if (resolvedBody.stream) {
      const streamResult = await callAIUIMessageResult(
        sanitizedMessages,
        fallbackPersonality,
        '',
        requestedModelId,
        { reasoning: reasoningEnabled, systemPromptOverride: systemPrompt }
      );

      return streamResult.toUIMessageStreamResponse({
        headers: {
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
        sendReasoning: true,
        sendSources: false,
        messageMetadata: ({ part }) => part.type === 'start' ? metadata : undefined,
        onFinish: async ({ responseMessage }) => {
          if (!userId || canSkipCredit || !creditDeducted) return;
          const hasVisibleText = responseMessage.parts.some(
            (part) => isTextUIPart(part) && part.text.trim().length > 0,
          );

          if (!hasVisibleText) {
            const refunded = await refundCreditsOrLog(userId, 1, 'chat stream empty-response');
            if (refunded) {
              creditDeducted = false;
            }
          }
        },
      });
    }

    const content = await callAI(
      sanitizedMessages,
      fallbackPersonality,
      requestedModelId,
      '',
      { reasoning: reasoningEnabled, systemPromptOverride: systemPrompt }
    );

    return jsonOk({ content, metadata });
  } catch (error) {
    if (creditDeducted && userId && !canSkipCredit) {
      await refundCreditsOrLog(userId, 1, 'chat route failure');
    }

    console.error('AI API 错误:', error);
    const errorInfo = extractAIErrorInfo(error);
    return jsonError(errorInfo.message, errorInfo.status, { code: errorInfo.code });
  }
}
