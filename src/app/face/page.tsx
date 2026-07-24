/**
 * 面相分析页面
 * 
 * 上传面部照片，选择分析类型，获取AI分析
 */
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, AlertTriangle, X, ScanFace } from 'lucide-react';
import { SoundWaveLoader } from '@/components/ui/SoundWaveLoader';
import { FACE_ANALYSIS_TYPES, FACE_DISCLAIMER } from '@/lib/divination/face';
import { useToast } from '@/components/ui/Toast';
import { CreditsModal } from '@/components/ui/CreditsModal';
import { writeSessionJSON } from '@/lib/cache/session-storage';
import { DEFAULT_VISION_MODEL_ID } from '@/lib/ai/ai-config';
import { VisionModelSelector } from '@/components/ui/VisionModelSelector';
import { useSessionSafe } from '@/components/providers/ClientProviders';
import { AIFeatureGate } from '@/components/ai/AIFeatureGate';
import dynamic from 'next/dynamic';

const HistoryDrawer = dynamic(
    () => import('@/components/layout/HistoryDrawer').then(mod => mod.HistoryDrawer),
    { ssr: false }
);

export default function FacePage() {
    const router = useRouter();
    const { showToast } = useToast();
    const { user } = useSessionSafe();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedType, setSelectedType] = useState('full');
    const [question, setQuestion] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_VISION_MODEL_ID);
    const [reasoningEnabled, setReasoningEnabled] = useState(false);
    const [showCreditsModal, setShowCreditsModal] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            showToast('error', '请上传图片文件');
            return;
        }

        // 检查文件大小 (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showToast('error', '图片大小不能超过 10MB');
            return;
        }

        // 显示免责声明
        if (!disclaimerAccepted) {
            setShowDisclaimer(true);
        }

        setImageMimeType(file.type);

        // 读取并压缩图片
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // 压缩图片
                const canvas = document.createElement('canvas');
                const maxSize = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setImagePreview(compressedDataUrl);
                setImageBase64(compressedDataUrl.split(',')[1]);
                setImageMimeType('image/jpeg');
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyze = async () => {
        if (!imageBase64) {
            showToast('error', '请先上传面部照片');
            return;
        }

        if (!user) {
            showToast('error', '请先登录');
            return;
        }

        if (!disclaimerAccepted) {
            setShowDisclaimer(true);
            return;
        }

        setIsAnalyzing(true);

        try {
            const response = await fetch('/api/face', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'analyze',
                    imageBase64,
                    imageMimeType,
                    analysisType: selectedType,
                    question: question.trim() || undefined,
                    modelId: selectedModel,
                    reasoning: reasoningEnabled,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                // 检测积分不足错误
                if (data.error?.includes('积分不足') || data.error?.includes('充值')) {
                    setShowCreditsModal(true);
                    return;
                }
                showToast('error', data.error || '分析失败');
                return;
            }

            // 跳转到结果页面
            if (data.data?.readingId || data.data?.analysis) {
                writeSessionJSON('face_result', {
                    readingId: data.data.readingId,
                    conversationId: data.data.conversationId,
                    analysisType: selectedType,
                    analysis: data.data.analysis,
                    isTemporary: !data.data.readingId
                });
                router.push('/face/result');
            } else {
                showToast('error', '未获取到分析结果');
            }
        } catch (error) {
            console.error('分析失败:', error);
            showToast('error', '分析失败，请稍后重试');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <AIFeatureGate><>
            <div className="min-h-screen bg-background md:pb-12">
                {/* 顶部 Hero 区域 - 移动端隐藏 */}
                <div className="hidden md:block relative overflow-hidden bg-background-secondary/30 border-b border-border/50">
                    <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
                    <div className="max-w-4xl mx-auto px-4 py-16 text-center relative z-10">
                        <div className="inline-flex items-center justify-center p-4 rounded-2xl mb-6 shadow-lg shadow-purple-500/10">
                            <ScanFace className="w-12 h-12 text-purple-500" />
                        </div>
                        <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
                            AI 面相分析
                        </h1>
                        <p className="text-lg text-foreground-secondary max-w-2xl mx-auto leading-relaxed">
                            上传正面照片，AI 深度解读您的面相特征。
                            <br className="hidden sm:block" />
                            探索容貌背后的性格密码与运势指引。
                        </p>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 -mt-8 relative z-20 md:mt-0 mt-4">
                    <div className="bg-background rounded-2xl p-6 shadow-xl border border-border/50">
                        {/* 模型选择 */}
                        <div className="mb-4 md:mb-8">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                                <span className="w-1 h-4 bg-purple-500 rounded-full" />
                                选择分析模型
                            </label>
                            <VisionModelSelector
                                selectedModel={selectedModel}
                                onModelChange={setSelectedModel}
                                reasoningEnabled={reasoningEnabled}
                                onReasoningChange={setReasoningEnabled}
                            />
                        </div>

                        {/* 免责声明弹窗 */}
                        {showDisclaimer && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                                <div className="bg-background rounded-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 shadow-2xl border border-border">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                                            </div>
                                            <h3 className="text-lg font-semibold">重要提醒</h3>
                                        </div>
                                        <button
                                            onClick={() => setShowDisclaimer(false)}
                                            className="p-1 hover:bg-background-secondary rounded-lg transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="text-sm text-foreground-secondary whitespace-pre-line mb-6 leading-relaxed bg-background-secondary/30 p-4 rounded-xl">
                                        {FACE_DISCLAIMER}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowDisclaimer(false)}
                                            className="flex-1 py-2.5 bg-background-secondary rounded-xl hover:bg-background-tertiary transition-colors font-medium"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={() => {
                                                setDisclaimerAccepted(true);
                                                setShowDisclaimer(false);
                                            }}
                                            className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors font-medium shadow-lg shadow-purple-500/20"
                                        >
                                            我已了解
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 图片上传区 */}
                        <div className="mb-4 md:mb-8">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2 md:mb-3">
                                <span className="w-1 h-4 bg-purple-500 rounded-full" />
                                上传正面照片
                            </label>
                            <div
                                className={`relative border-2 border-dashed rounded-xl p-4 md:p-8 text-center cursor-pointer transition-all duration-300 group
                                    ${imagePreview
                                        ? 'border-purple-500/50 bg-purple-500/5'
                                        : 'border-border hover:border-purple-500/40 hover:bg-background-secondary hover:shadow-lg hover:shadow-purple-500/5'
                                    }`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {imagePreview ? (
                                    <div className="relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={imagePreview}
                                            alt="面相预览"
                                            className="max-h-48 md:max-h-80 mx-auto rounded-lg shadow-md"
                                        />
                                        <div className="absolute inset-x-0 bottom-4 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setImagePreview(null);
                                                    setImageBase64(null);
                                                }}
                                                className="px-4 py-2 bg-background/90 backdrop-blur-md rounded-full text-sm font-medium hover:bg-background shadow-lg text-foreground border border-border/50"
                                            >
                                                更换图片
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 md:space-y-4 py-4 md:py-8">
                                        <div className="flex justify-center gap-4">
                                            <div className="w-12 h-12 md:w-16 md:h-16 bg-background-secondary rounded-xl md:rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
                                                <Camera className="w-6 h-6 md:w-8 md:h-8 text-foreground-secondary group-hover:text-purple-500 transition-colors" />
                                            </div>
                                            <div className="w-12 h-12 md:w-16 md:h-16 bg-background-secondary rounded-xl md:rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 delay-75">
                                                <Upload className="w-6 h-6 md:w-8 md:h-8 text-foreground-secondary group-hover:text-purple-500 transition-colors" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground text-sm md:text-lg mb-1">
                                                点击上传或拖拽图片到此处
                                            </p>
                                            <p className="text-xs md:text-sm text-foreground-secondary">
                                                请上传清晰的正面照片，确保光线充足
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="user"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* 分析类型选择 */}
                        <div className="mb-4 md:mb-8">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2 md:mb-3">
                                <span className="w-1 h-4 bg-purple-500 rounded-full" />
                                选择分析类型
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 md:gap-3">
                                {FACE_ANALYSIS_TYPES.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setSelectedType(type.id)}
                                        className={`relative p-2 md:p-4 rounded-lg md:rounded-xl text-left transition-all duration-300 border
                                            ${selectedType === type.id
                                                ? 'bg-purple-500/10 border-purple-500 shadow-md shadow-purple-500/10'
                                                : 'bg-background border-border hover:border-purple-500/30 hover:bg-background-secondary hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-center md:items-start gap-2 md:gap-3 justify-center md:justify-start">
                                            <div className={`hidden md:block p-2 rounded-lg ${selectedType === type.id ? 'bg-purple-500 text-white' : 'bg-background-secondary text-foreground'}`}>
                                                <span className="text-xl">{type.icon}</span>
                                            </div>
                                            <div className="text-center md:text-left">
                                                <div className={`font-semibold md:mb-1 text-sm md:text-base ${selectedType === type.id ? 'text-purple-700 dark:text-purple-300' : 'text-foreground'}`}>
                                                    {type.name}
                                                </div>
                                                <p className="hidden md:block text-xs text-foreground-secondary leading-relaxed">
                                                    {type.description}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 问题输入 */}
                        {/* 问题输入 */}
                        <div className="mb-10 text-center max-w-2xl mx-auto">
                            <label className="block text-sm font-medium text-foreground-secondary mb-3">
                                心中默念您的问题（选填）
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-0 bg-purple-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                                <input
                                    type="text"
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="例如：我适合什么样的工作？未来的财运如何？"
                                    className="relative w-full px-6 py-4 bg-background rounded-xl border border-border shadow-sm 
                                        focus:border-purple-500 focus:ring-0 focus:outline-none 
                                        text-center text-lg placeholder:text-foreground-tertiary/70
                                        transition-all duration-300"
                                />
                            </div>
                        </div>

                        {/* 分析按钮 */}
                        <button
                            onClick={handleAnalyze}
                            disabled={!imageBase64 || isAnalyzing}
                            className="group w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-lg
                                hover:from-purple-600 hover:to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5
                                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none
                                transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-background/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            {isAnalyzing ? (
                                <>
                                    <SoundWaveLoader variant="inline" />
                                    <span>AI 正在深度分析中...</span>
                                </>
                            ) : (
                                <>
                                    <ScanFace className="w-6 h-6" />
                                    <span>开始分析面相</span>
                                </>
                            )}
                        </button>

                        <p className="text-center text-xs text-foreground-secondary/70 mt-4 flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                            面相分析需要 Plus 会员或以上，每次消耗 1 积分
                        </p>
                    </div>
                </div>
            </div>
            <HistoryDrawer type="face" />
            <CreditsModal
                isOpen={showCreditsModal}
                onClose={() => setShowCreditsModal(false)}
            />
        </></AIFeatureGate>
    );
}
