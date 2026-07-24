'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, RotateCcw, Waypoints } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CanonicalAISection } from '@/components/divination/CanonicalAISection';
import { LUNAR_DAY_NAMES, LUNAR_MONTH_NAMES } from '@/components/bazi/form/options';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { useToast } from '@/components/ui/Toast';
import { useAdminJsonCopy } from '@/lib/admin/useAdminJsonCopy';
import { readSessionJSON, updateSessionJSON } from '@/lib/cache/session-storage';
import { buildXiaoliurenCanonicalText, type XiaoliurenWebBundle } from '@/lib/divination/xiaoliuren';
import { saveDivinationAction } from '@/lib/divination/save-client';
import { useSessionMembership } from '@/lib/hooks/useSessionMembership';

type XiaoliurenSession = { resultData?: XiaoliurenWebBundle; divinationId?: string; conversationId?: string };

const PATH_LABELS = ['月上起', '日上落', '时上落'];

export default function XiaoliurenResultPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { userId, sessionLoading } = useSessionMembership();
  const [bundle, setBundle] = useState<XiaoliurenWebBundle | null>(null);
  const [divinationId, setDivinationId] = useState<string>();
  const [conversationId, setConversationId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const hasAutoSavedRef = useRef(false);
  const canonicalJson = useMemo(() => bundle?.canonicalJson ?? null, [bundle]);
  const { isAdmin, jsonCopied, copyJson } = useAdminJsonCopy(canonicalJson);

  const persistSessionIds = useCallback((next: { divinationId?: string; conversationId?: string }) => {
    updateSessionJSON<XiaoliurenSession>('xiaoliuren_result', (previous) => ({ ...(previous || {}), ...next }));
  }, []);

  const saveRecord = useCallback(async (nextBundle: XiaoliurenWebBundle) => {
    const saved = await saveDivinationAction({ endpoint: '/api/xiaoliuren', body: { resultData: nextBundle }, idKey: 'divinationId', fallbackMessage: '保存小六壬记录失败' });
    if (saved.ok && saved.id) {
      setDivinationId(saved.id);
      persistSessionIds({ divinationId: saved.id });
      return saved.id;
    }
    if (!saved.ok) console.error('[xiaoliuren/result] 保存失败:', saved.error.message);
    return undefined;
  }, [persistSessionIds]);

  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;
    const init = async () => {
      await Promise.resolve();
      const session = readSessionJSON<XiaoliurenSession>('xiaoliuren_result');
      if (!session?.resultData) {
        router.replace('/xiaoliuren');
        return;
      }
      if (cancelled) return;
      setBundle(session.resultData);
      if (session.divinationId) setDivinationId(session.divinationId);
      if (session.conversationId) setConversationId(session.conversationId);
      if (!session.divinationId && userId && !hasAutoSavedRef.current) {
        hasAutoSavedRef.current = true;
        void saveRecord(session.resultData);
      }
      setIsLoading(false);
    };
    void init();
    return () => { cancelled = true; };
  }, [router, saveRecord, sessionLoading, userId]);

  const handleCopy = async () => {
    if (!bundle) return;
    try {
      await navigator.clipboard.writeText(buildXiaoliurenCanonicalText(bundle.result));
      setCopied(true);
      showToast('success', '规范文本已复制');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('error', '复制失败，请重试');
    }
  };

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><SoundWaveLoader variant="block" text="正在排课" /></div>;
  if (!bundle) return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-5"><p className="text-sm text-foreground/50">没有找到起课数据</p><button type="button" onClick={() => router.push('/xiaoliuren')} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-background-secondary">返回</button></div>;

  const result = bundle.result;
  const statuses = [result.monthStatus, result.dayStatus, result.hourStatus];
  const lunarMonthLabel = bundle.lunarMonthName
    ? `${bundle.lunarMonthName}月`
    : `${bundle.isLeapMonth ? '闰' : ''}${LUNAR_MONTH_NAMES[bundle.lunarMonth] ?? `${bundle.lunarMonth}月`}`;
  const lunarDayLabel = bundle.lunarDayName ?? LUNAR_DAY_NAMES[bundle.lunarDay] ?? `${bundle.lunarDay}日`;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <header className="flex items-center justify-between border-b border-border/60 pb-5">
          <div className="flex items-center gap-3"><Link href="/xiaoliuren" aria-label="返回小六壬输入页" title="返回小六壬输入页" className="p-2 rounded-md text-foreground/55 hover:bg-background-secondary active:bg-background-secondary/80 transition-colors"><ArrowLeft className="w-4 h-4" /></Link><div className="flex items-center gap-2"><Waypoints className="w-4 h-4 text-[#2eaadc]" /><h1 className="text-lg font-bold">小六壬</h1></div></div>
          <div className="flex items-center gap-1"><button type="button" onClick={() => router.push('/xiaoliuren')} aria-label="重新起课" title="重新起课" className="p-2 rounded-md text-foreground/55 hover:bg-background-secondary active:bg-background-secondary/80 transition-colors"><RotateCcw className="w-4 h-4" /></button><button type="button" onClick={() => void handleCopy()} aria-label="复制规范文本" title="复制规范文本" className="p-2 rounded-md text-foreground/55 hover:bg-background-secondary active:bg-background-secondary/80 transition-colors">{copied ? <Check className="w-4 h-4 text-[#0f7b6c]" /> : <Copy className="w-4 h-4" />}</button>{isAdmin && <button type="button" onClick={() => void copyJson()} aria-label="复制规范 JSON" title="复制规范 JSON" className="p-2 rounded-md text-foreground/55 hover:bg-background-secondary active:bg-background-secondary/80 transition-colors">{jsonCopied ? <Check className="w-4 h-4 text-[#0f7b6c]" /> : <span className="text-[10px] font-mono">JSON</span>}</button>}</div>
        </header>

        <section className="border border-border rounded-md p-5 sm:p-6 bg-background-secondary/20">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5"><div><div className="text-xs text-foreground/45 mb-1">占问</div><h2 className="text-xl font-bold">{result.question || '未填写占问'}</h2></div><span className="text-xs text-foreground/45">{bundle.solarDateTime}</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"><div><span className="block text-foreground/40 mb-1">农历月</span><b>{lunarMonthLabel}</b></div><div><span className="block text-foreground/40 mb-1">农历日</span><b>{lunarDayLabel}</b></div><div><span className="block text-foreground/40 mb-1">时辰</span><b>{result.input.shichen}</b></div><div><span className="block text-foreground/40 mb-1">最终落宫</span><b className="text-[#0f7b6c]">{result.hourStatus}</b></div></div>
        </section>

        <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-xs font-bold tracking-widest text-foreground/45">三步落宫</h2><span className="text-[11px] text-foreground/35">月 → 日 → 时</span></div><div className="grid gap-3 md:grid-cols-3">{statuses.map((status, index) => { const isFinal = index === statuses.length - 1; const info = index === 2 ? result.result : undefined; return <article key={`${status}-${index}`} className={`relative border rounded-md p-5 ${isFinal ? 'border-[#2eaadc] bg-[#2eaadc]/5' : 'border-border bg-background'}`}><div className="flex items-center justify-between mb-7"><span className="text-xs font-bold tracking-wider text-foreground/45">{PATH_LABELS[index]}</span><span className="font-mono text-[10px] text-foreground/35">0{index + 1}</span></div><div className="text-3xl font-bold mb-2">{status}</div>{info && <><div className="text-sm text-foreground/65 mb-3">{info.nature} · {info.element}</div><p className="text-xs text-foreground/55 leading-relaxed">{info.description}</p></>}{index < statuses.length - 1 && <span className="hidden md:block absolute -right-3 top-1/2 w-5 h-px bg-border" />}</article>; })}</div></section>

        <section className="border border-border rounded-md p-5 space-y-4"><h2 className="text-xs font-bold tracking-widest text-foreground/45">最终落宫</h2><div className="flex flex-wrap items-baseline gap-x-4 gap-y-2"><span className="text-2xl font-bold">{result.result.name}</span><span className="text-sm text-foreground/60">{result.result.nature}</span><span className="text-sm text-foreground/60">{result.result.element} · {result.result.direction}</span></div><p className="text-sm leading-relaxed text-foreground/70">{result.result.description}</p><div className="text-xs text-foreground/50 border-l-2 border-[#2eaadc]/50 pl-3">{result.result.poem}</div></section>

        <CanonicalAISection endpoint="/api/xiaoliuren" resultData={bundle} recordId={divinationId} conversationId={conversationId} historyType="xiaoliuren" sessionKey="xiaoliuren_result" onConversationId={(id) => { setConversationId(id); persistSessionIds({ conversationId: id }); }} />
      </div>
    </div>
  );
}
