'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { HistoryDrawer } from '@/components/layout/HistoryDrawer';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { useToast } from '@/components/ui/Toast';
import { writeSessionJSON } from '@/lib/cache/session-storage';
import { requestBrowserJson } from '@/lib/browser-api';
import { toDateTimeLocalValue } from '@/lib/date-utils';
import type { MeihuaInput, MeihuaWebBundle, WebMeihuaMethod } from '@/lib/divination/meihua';

const METHOD_OPTIONS: Array<{ id: WebMeihuaMethod; label: string; hint: string }> = [
  { id: 'time', label: '时间起卦', hint: '按年月日时取数' },
  { id: 'text_split', label: '文字起卦', hint: '字数、句意或笔画' },
  { id: 'number_pair', label: '两数起卦', hint: '输入上下卦数字' },
  { id: 'number_triplet', label: '三数起卦', hint: '输入上下卦与动爻' },
];

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？!?；;]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function MeihuaPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [question, setQuestion] = useState('');
  const [date, setDate] = useState(() => toDateTimeLocalValue());
  const [method, setMethod] = useState<WebMeihuaMethod>('time');
  const [text, setText] = useState('');
  const [multiSentenceStrategy, setMultiSentenceStrategy] = useState<'first' | 'last'>('first');
  const [leftStrokeCount, setLeftStrokeCount] = useState('');
  const [rightStrokeCount, setRightStrokeCount] = useState('');
  const [numbers, setNumbers] = useState(['', '', '']);
  const [isLoading, setIsLoading] = useState(false);

  const sentences = useMemo(() => splitSentences(text), [text]);
  const isSingleCharacter = method === 'text_split' && Array.from(text.trim()).length === 1;

  const updateNumber = (index: number, value: string) => {
    setNumbers((previous) => previous.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const buildInput = (): MeihuaInput | null => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      showToast('error', '请填写占问事项');
      return null;
    }
    if (!date) {
      showToast('error', '请选择起卦时间');
      return null;
    }

    const input: MeihuaInput = { question: trimmedQuestion, date, method };
    if (method === 'text_split') {
      const trimmedText = text.trim();
      if (!trimmedText) {
        showToast('error', '请输入用于起卦的文字');
        return null;
      }
      input.text = trimmedText;
      if (isSingleCharacter) {
        const left = Number(leftStrokeCount);
        const right = Number(rightStrokeCount);
        if (!Number.isInteger(left) || left <= 0 || !Number.isInteger(right) || right <= 0) {
          showToast('error', '单字起卦需要填写左右半部笔画数');
          return null;
        }
        input.textSplitMode = 'stroke';
        input.leftStrokeCount = left;
        input.rightStrokeCount = right;
      } else if (sentences.length > 2) {
        input.multiSentenceStrategy = multiSentenceStrategy;
      }
    }
    if (method === 'number_pair' || method === 'number_triplet') {
      const count = method === 'number_pair' ? 2 : 3;
      const parsedNumbers = numbers.slice(0, count).map(Number);
      if (parsedNumbers.some((value) => !Number.isInteger(value) || value <= 0)) {
        showToast('error', `请填写 ${count} 个正整数`);
        return null;
      }
      input.numbers = parsedNumbers;
    }
    return input;
  };

  const handleCalculate = async () => {
    const input = buildInput();
    if (!input) return;
    setIsLoading(true);
    try {
      const response = await requestBrowserJson<MeihuaWebBundle>('/api/meihua', {
        method: 'POST',
        body: JSON.stringify({ action: 'calculate', input }),
      });
      if (response.error || !response.data) {
        showToast('error', response.error?.message || '起卦失败，请检查输入');
        return;
      }
      writeSessionJSON('meihua_result', { input, resultData: response.data });
      router.push('/meihua/result');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '起卦失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground md:pb-12">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
          <header className="hidden md:block border-b border-border/60 pb-7 mb-8">
            <h1 className="text-3xl font-bold tracking-tight">梅花易数</h1>
            <p className="mt-2 text-sm text-foreground/55">以时间、文字或报数，观察卦象的体用流转。</p>
          </header>

          <main className="space-y-6">
            <section className="bg-background border border-border rounded-md p-5 sm:p-6 space-y-5">
              <div>
                <label htmlFor="meihua-question" className="block text-xs font-bold tracking-wider text-foreground/50 mb-2">占问事项</label>
                <input
                  id="meihua-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="例如：这次合作能否顺利推进？"
                  className="w-full px-3 py-3 bg-transparent border border-border rounded-md text-sm focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="meihua-date" className="block text-xs font-bold tracking-wider text-foreground/50 mb-2">起卦时间</label>
                <div className="relative">
                  <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/35 pointer-events-none" />
                  <input
                    id="meihua-date"
                    type="datetime-local"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="w-full pl-10 pr-3 py-3 bg-transparent border border-border rounded-md text-sm focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-bold tracking-wider text-foreground/50 mb-2">起卦方式</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="group" aria-label="梅花起卦方式">
                  {METHOD_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMethod(option.id)}
                      aria-pressed={method === option.id}
                      className={`text-left px-3 py-3 rounded-md border transition-colors duration-150 ${method === option.id ? 'border-[#2383e2] bg-[#2383e2]/8' : 'border-border hover:bg-background-secondary active:bg-background-secondary/80'}`}
                    >
                      <span className={`block text-sm font-semibold ${method === option.id ? 'text-[#2383e2]' : ''}`}>{option.label}</span>
                      <span className="block mt-1 text-[11px] text-foreground/45">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {method === 'text_split' && (
                <div className="space-y-4 border-t border-border/60 pt-5">
                  <div>
                    <label htmlFor="meihua-text" className="block text-xs font-bold tracking-wider text-foreground/50 mb-2">取卦文字</label>
                    <textarea
                      id="meihua-text"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={3}
                      placeholder="输入一个字、两句文字或一段来意"
                      className="w-full resize-y px-3 py-3 bg-transparent border border-border rounded-md text-sm leading-relaxed focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20 focus:outline-none"
                    />
                  </div>
                  {isSingleCharacter && (
                    <div className="grid grid-cols-2 gap-3">
                      {[['left-stroke', '左半部笔画', leftStrokeCount, setLeftStrokeCount], ['right-stroke', '右半部笔画', rightStrokeCount, setRightStrokeCount]].map(([id, label, value, setter]) => (
                        <label key={id as string} htmlFor={id as string} className="text-xs text-foreground/55">
                          <span className="block mb-2 font-semibold">{label as string}</span>
                          <input id={id as string} type="number" min={1} value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="w-full px-3 py-2.5 border border-border rounded-md bg-transparent text-sm focus:border-[#2383e2] focus:outline-none" />
                        </label>
                      ))}
                    </div>
                  )}
                  {sentences.length > 2 && !isSingleCharacter && (
                    <div>
                      <div className="text-xs font-semibold text-foreground/55 mb-2">多句取用</div>
                      <div className="inline-flex border border-border rounded-md overflow-hidden" role="group" aria-label="多句取用方式">
                        {(['first', 'last'] as const).map((value) => (
                          <button key={value} type="button" aria-pressed={multiSentenceStrategy === value} onClick={() => setMultiSentenceStrategy(value)} className={`px-3 py-2 text-xs transition-colors ${multiSentenceStrategy === value ? 'bg-[#2383e2] text-white' : 'hover:bg-background-secondary'}`}>
                            {value === 'first' ? '取首句' : '取末句'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(method === 'number_pair' || method === 'number_triplet') && (
                <div className="border-t border-border/60 pt-5">
                  <div className="text-xs font-bold tracking-wider text-foreground/50 mb-2">报数</div>
                  <div className={`grid gap-3 ${method === 'number_pair' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {numbers.slice(0, method === 'number_pair' ? 2 : 3).map((value, index) => (
                      <label key={index} htmlFor={`meihua-number-${index}`} className="text-xs text-foreground/55">
                        <span className="block mb-2 font-semibold">{index === 0 ? '上卦' : index === 1 ? '下卦' : '动爻'}</span>
                        <input id={`meihua-number-${index}`} type="number" min={1} value={value} onChange={(event) => updateNumber(index, event.target.value)} className="w-full px-3 py-2.5 border border-border rounded-md bg-transparent text-sm focus:border-[#2383e2] focus:outline-none" />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <button type="button" onClick={() => void handleCalculate()} disabled={isLoading} className="w-full inline-flex justify-center items-center gap-2 px-5 py-3.5 bg-[#2383e2] text-white rounded-md font-semibold text-sm hover:bg-[#2383e2]/90 active:bg-[#1a65b0] transition-colors disabled:opacity-50">
              {isLoading ? <><SoundWaveLoader variant="inline" /><span>正在起卦</span></> : <><Play className="w-4 h-4" />开始起卦</>}
            </button>
          </main>
        </div>
        <HistoryDrawer type="meihua" />
    </div>
  );
}
