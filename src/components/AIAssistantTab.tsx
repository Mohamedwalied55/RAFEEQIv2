/**
 * شاشة المساعد الطبي الذكي: استشارات الأدوية، رفع صورة الروشتة والنشرة، ونطق الرد بالعربية
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Camera,
  Volume2,
  VolumeX,
  AlertTriangle,
  Info,
  RefreshCw,
  Download,
  Trash2,
} from 'lucide-react';
import { callHealthAssistant, AssistantMessage } from '../utils/api';
import { speakArabicText, stopAllSpeech, openVoiceInstall } from '../utils/audio';
import { compressImageFile } from '../utils/files';

interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  timestamp: string;
}

export const AIAssistantTab: React.FC = () => {
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'أهلاً بك! أنا رفيقك الطبي الذكي. يمكنك سؤالي عن مواعيد أدويتك، أو تفاعلاتها، أو تصوير الروشتة الطبية ونشرة الدواء وسأشرحها لك ببساطة. كيف أساعدك اليوم؟',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
  } | null>(null);

  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [voiceInstallRequired, setVoiceInstallRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<{ text: string; code?: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, 1280, 1280, 0.8);
      setPendingImage({
        base64: compressed.base64,
        mimeType: compressed.mimeType,
        preview: `data:${compressed.mimeType};base64,${compressed.base64}`,
      });
    } catch (err: any) {
      setErrorMessage({ text: err?.message || 'فشل ضغط ومعالجة الصورة' });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !pendingImage) return;

    const userText = prompt.trim() || 'يرجى قراءة وتحليل صورة الروشتة/الدواء المرفقة.';
    const userMessage: ChatItem = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: userText,
      imageUrl: pendingImage?.preview,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');
    setErrorMessage(null);
    setLoading(true);

    // سياق آخر 4 رسائل
    const history: AssistantMessage[] = messages.slice(-4).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    try {
      const res = await callHealthAssistant({
        prompt: userText,
        imageBase64: pendingImage?.base64,
        imageMimeType: pendingImage?.mimeType,
        history,
      });

      const assistantMsg: ChatItem = {
        id: `reply_${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setPendingImage(null);
    } catch (err: any) {
      setErrorMessage({
        text: err?.message || 'تعذر الحصول على رد من المساعد الطبي.',
        code: err?.code,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = async (msgId: string, text: string) => {
    if (activeSpeechId === msgId) {
      stopAllSpeech();
      setActiveSpeechId(null);
      return;
    }

    setActiveSpeechId(msgId);
    setVoiceInstallRequired(false);

    const res = await speakArabicText(text);
    if (!res.success) {
      setActiveSpeechId(null);
      if (res.needsVoiceInstall) {
        setVoiceInstallRequired(true);
      }
    }
  };

  const handleClearHistory = () => {
    if (confirm('هل تريد مسح محادثة المساعد الطبي والبدء من جديد؟')) {
      stopAllSpeech();
      setActiveSpeechId(null);
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: 'أهلاً بك! تم بدء محادثة جديدة. كيف أستطيع مساعدتك في أدويتك وصحتك اليوم؟',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-170px)] max-h-[750px] pb-20">
      {/* رأس المحادثة وزر المسح */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              المساعد الطبي الذكي
            </h2>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
              متصل عبر الخادم الآمن
            </span>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          title="مسح المحادثة"
          className="text-xs text-slate-400 hover:text-rose-500 p-1.5 rounded-lg transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* تنبيه تثبيت الصوت العربي إن كان مفقوداً في نظام أندرويد */}
      {voiceInstallRequired && (
        <div className="mb-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div>
            <strong>تنبيه الصوت:</strong> حزمة الصوت العربي غير متوفرة في إعدادات النظام.
          </div>
          <button
            onClick={openVoiceInstall}
            className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px] hover:bg-amber-700"
          >
            فتح إعدادات الصوت
          </button>
        </div>
      )}

      {/* منطقة الرسائل */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 py-2">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isReading = activeSpeechId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-teal-600 text-white rounded-ee-xs shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-es-xs shadow-xs'
                }`}
              >
                {/* صورة مرفقة إن وجدت */}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="صورة مرفقة"
                    className="w-full max-h-48 object-cover rounded-xl mb-2 border border-black/10"
                  />
                )}

                <div className="whitespace-pre-line">{msg.text}</div>

                {/* زر النطق للردود */}
                {!isUser && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <button
                      onClick={() => handleSpeak(msg.id, msg.text)}
                      className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                    >
                      {isReading ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                          <span className="text-rose-500">إيقاف الصوت</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>🔊 اقرأ الرد</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.timestamp).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* التنبيه الطبي الثابت أسفل كل رد من المساعد */}
              {!isUser && (
                <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 max-w-[85%] px-1 flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>هذه المعلومات للإرشاد فقط ولا تغني عن استشارة الطبيب أو الصيدلي.</span>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 p-3 bg-white dark:bg-slate-800 rounded-2xl w-fit">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>جاري تحليل استفسارك الطبي...</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">فشل الاتصال: {errorMessage.text}</div>
              {errorMessage.code && (
                <div className="text-[10px] font-mono mt-0.5">رمز الخطأ: {errorMessage.code}</div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* معاينة الصورة المرفقة قبل الإرسال */}
      {pendingImage && (
        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-between gap-2 shrink-0 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={pendingImage.preview}
              alt="معاينة"
              className="w-10 h-10 object-cover rounded-lg shrink-0"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
              صورة روشتة أو علبة دواء جاهزة للإرسال
            </span>
          </div>
          <button
            onClick={() => setPendingImage(null)}
            className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-rose-500 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}

      {/* حقل الإدخال والإرسال */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <label
          title="تصوير روشتة أو دواء"
          className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer shrink-0 transition"
        >
          <Camera className="w-5 h-5 text-teal-600" />
          <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        </label>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="اسأل رفيقي عن أي دواء أو موعد أو أعراض..."
          disabled={loading}
          className="flex-1 h-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={loading || (!prompt.trim() && !pendingImage)}
          className="w-12 h-12 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white flex items-center justify-center shrink-0 transition shadow-md disabled:opacity-40"
        >
          <Send className="w-5 h-5 -rotate-90" />
        </button>
      </form>
    </div>
  );
};
