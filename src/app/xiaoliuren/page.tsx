'use client';

import { useState } from 'react';
import { CalendarClock, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { HistoryDrawer } from '@/components/layout/HistoryDrawer';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { useToast } from '@/components/ui/Toast';
import { writeSessionJSON } from '@/lib/cache/session-storage';
import { requestBrowserJson } from '@/lib/browser-api';
import { toDateTimeLocalValue } from '@/lib/date-utils';
import type { XiaoliurenWebBundle } from '@/lib/divination/xiaoliuren';

export default function XiaoliurenPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [question, setQuestion] = useState('');
  const [date, setDate] = useState(() => toDateTimeLocalValue());
  const [isLoading, setIsLoading] = useState(false);

  const handleCalculate = async () => {
    if (!question.trim()) {
      showToast('error', '请填写占问事项');
      return;
    }
    if (!date) {
      showToast('error', '请选择起课时间');
      return;
    }
    setIsLoading(true);
    try {
      const response = await requestBrowserJson<XiaoliurenWebBundle>('/api/xiaoliuren', {
        method: 'POST',
        body: JSON.stringify({ action: 'calculate', date, question: question.trim() }),
      });
      if (response.error || !response.data) {
        showToast('error', response.error?.message || '起课失败，请检查输入');
        return;
      }
      writeSessionJSON('xiaoliuren_result', { resultData: response.data });
      router.push('/xiaoliuren/result');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '起课失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground md:pb-12">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
          <header className="hidden md:block border-b border-border/60 pb-7 mb-8">
            <h1 className="text-3xl font-bold tracking-tight">小六壬</h1>
            <p className="mt-2 text-sm text-foreground/55">从农历月、日到时辰，沿三步落宫看当下趋势。</p>
          </header>

          <main className="space-y-6">
            <section className="bg-background border border-border rounded-md p-5 sm:p-6 space-y-5">
              <div>
                <label htmlFor="xiaoliuren-question" className="block text-xs font-bold tracking-wider text-foreground/50 mb-2">占问事项</label>
                <input id="xiaoliuren-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：今天适合签约吗？" className="w-full px-3 py-3 bg-transparent border border-border rounded-md text-sm focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20 focus:outline-none" />
              </div>
              <div>
                <label htmlFor="xiaoliuren-date" className="block text-xs font-bold tracking-wider text-foreground/50 mb-2">起课时间</label>
                <div className="relative">
                  <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/35 pointer-events-none" />
                  <input id="xiaoliuren-date" type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className="w-full pl-10 pr-3 py-3 bg-transparent border border-border rounded-md text-sm focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20 focus:outline-none" />
                </div>
                <p className="mt-2 text-xs text-foreground/40">按本地墙上时间换算农历；闰月会在结果中明确标注。</p>
              </div>
            </section>
            <button type="button" onClick={() => void handleCalculate()} disabled={isLoading} className="w-full inline-flex justify-center items-center gap-2 px-5 py-3.5 bg-[#2383e2] text-white rounded-md font-semibold text-sm hover:bg-[#2383e2]/90 active:bg-[#1a65b0] transition-colors disabled:opacity-50">
              {isLoading ? <><SoundWaveLoader variant="inline" /><span>正在起课</span></> : <><Play className="w-4 h-4" />开始起课</>}
            </button>
          </main>
        </div>
        <HistoryDrawer type="xiaoliuren" />
    </div>
  );
}
