'use client';

import { useCallback, useMemo, useState } from 'react';
import { Brain, RefreshCw, Sparkles } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { ThinkingBlock } from '@/components/chat/ThinkingBlock';
import { CreditsModal } from '@/components/ui/CreditsModal';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { runSharedAnalysisFlow } from '@/lib/ai/analysis-runner';
import { DEFAULT_MODEL_ID } from '@/lib/ai/ai-config';
import { useAnalysisSnapshot } from '@/lib/hooks/useAnalysisSnapshot';
import { useFeatureToggles } from '@/lib/hooks/useFeatureToggles';
import { isCreditsError, useStreamingResponse } from '@/lib/hooks/useStreamingResponse';
import { useSessionMembership } from '@/lib/hooks/useSessionMembership';
import type { HistoryType } from '@/lib/history/registry';

type CanonicalAISectionProps = {
  endpoint: string;
  resultData: unknown;
  recordId?: string;
  conversationId?: string;
  historyType: HistoryType;
  sessionKey: string;
  onConversationId: (conversationId: string) => void;
};

/**
 * Canonical divination result pages share one AI interaction surface. The
 * feature state is intentionally fail-closed in the browser to avoid showing
 * controls while the global AI switch is unresolved or disabled.
 */
export function CanonicalAISection({
  endpoint,
  resultData,
  recordId,
  conversationId,
  historyType,
  sessionKey,
  onConversationId,
}: CanonicalAISectionProps) {
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [interpretationReasoning, setInterpretationReasoning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const streaming = useStreamingResponse();
  const { userId, membershipInfo, sessionLoading, membershipLoading, membershipResolved } = useSessionMembership();
  const { isFeatureEnabled, loaded: featureLoaded } = useFeatureToggles();
  const aiEnabled = featureLoaded && isFeatureEnabled('chat');
  const membershipPending = membershipLoading || !membershipResolved;
  const membershipType = membershipResolved ? (membershipInfo?.type ?? 'free') : 'free';

  const snapshotCallbacks = useMemo(() => ({
    onAnalysis: setInterpretation,
    onReasoning: setInterpretationReasoning,
    onReasoningEnabled: setReasoningEnabled,
    onModelId: setModelId,
    onConversationIdResolved: onConversationId,
  }), [onConversationId]);

  useAnalysisSnapshot({
    conversationId,
    recordId,
    divinationType: historyType,
    sessionKey,
    hasExistingAnalysis: Boolean(interpretation || streaming.content),
    skip: !aiEnabled || (!conversationId && !recordId),
    callbacks: snapshotCallbacks,
  });

  const handleInterpret = useCallback(async () => {
    if (!aiEnabled) return;
    if (!userId) {
      setShowAuthModal(true);
      return;
    }

    setError(null);
    setInterpretation(null);
    setInterpretationReasoning(null);
    streaming.reset();

    try {
      const analysisResult = await runSharedAnalysisFlow({
        endpoint,
        streaming,
        isCreditsError,
        direct: {
          prepareBody: { action: 'interpret_prepare', resultData, divinationId: recordId },
          persistBody: { action: 'interpret_persist', resultData, divinationId: recordId },
        },
        streamBody: {
          action: 'interpret',
          resultData,
          divinationId: recordId,
          modelId,
          reasoning: reasoningEnabled,
          stream: true,
        },
      });

      if (analysisResult.requiresCredits) {
        setShowCreditsModal(true);
        return;
      }
      if (analysisResult.error) {
        setError(analysisResult.error === 'FEATURE_DISABLED'
          ? 'AI 功能当前未启用'
          : analysisResult.error);
      }
      if (analysisResult.content) setInterpretation(analysisResult.content);
      if (analysisResult.reasoning) setInterpretationReasoning(analysisResult.reasoning);
      if (analysisResult.conversationId) onConversationId(analysisResult.conversationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '解读失败');
    }
  }, [aiEnabled, endpoint, modelId, onConversationId, reasoningEnabled, recordId, resultData, streaming, userId]);

  if (!featureLoaded || !aiEnabled) return null;

  const content = interpretation || streaming.content;
  const reasoning = interpretationReasoning || streaming.reasoning;

  return (
    <section className="bg-background border border-border rounded-md p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
        <h2 className="text-sm font-bold flex items-center gap-2 tracking-wider text-foreground/60">
          <Brain className="w-4 h-4 text-[#2eaadc]" />
          AI 深度解读
        </h2>
        <div className="flex items-center gap-2">
          <ModelSelector
            compact
            selectedModel={modelId}
            onModelChange={setModelId}
            reasoningEnabled={reasoningEnabled}
            onReasoningChange={setReasoningEnabled}
            userId={userId}
            membershipType={membershipType}
            disabled={membershipPending}
          />
          {content && (
            <button
              type="button"
              aria-label="重新获取 AI 解读"
              title="重新获取 AI 解读"
              onClick={handleInterpret}
              disabled={streaming.isStreaming}
              className="p-1.5 rounded-md hover:bg-background-secondary active:bg-background-secondary/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${streaming.isStreaming ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-[#eb5757] text-xs rounded-md border border-red-100">{error}</div>}

      {content ? (
        <div className="prose prose-sm max-w-none">
          {reasoning && <ThinkingBlock content={reasoning} isStreaming={streaming.isStreaming && !interpretation} />}
          <MarkdownContent content={content} className="text-sm text-foreground leading-relaxed" />
        </div>
      ) : (
        <div className="py-10 text-center space-y-5">
          {sessionLoading || membershipPending ? (
            <SoundWaveLoader variant="inline" />
          ) : !userId ? (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 active:bg-[#1a65b0] transition-colors"
            >
              登录解锁 AI 解读
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInterpret}
              disabled={membershipPending || streaming.isStreaming}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2383e2] text-white text-sm font-bold rounded-md hover:bg-[#2383e2]/90 active:bg-[#1a65b0] transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              获取 AI 解读
            </button>
          )}
        </div>
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <CreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
    </section>
  );
}
