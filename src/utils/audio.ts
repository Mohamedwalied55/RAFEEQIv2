/**
 * إدارة الصوت والنطق باللغة العربية وتنبيهات المنبّه
 */
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

let audioCtx: AudioContext | null = null;
let alarmOscillatorInterval: number | null = null;
let isSpeaking = false;

// تهيئة AudioContext وفك القفل عند أول لمسة للمستخدم
export function unlockAudioContext(): void {
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (err) {
    console.warn('AudioContext unlock failed:', err);
  }
}

// تنظيف النص من الرموز والإيموجي والماركداون قبل النطق
export function sanitizeArabicTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    // إزالة الروابط
    .replace(/https?:\/\/\S+/g, '')
    // إزالة صيغ الماركداون
    .replace(/[*_#`~[\]()>]/g, ' ')
    // إزالة الإيموجيات الشائعة
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    // استبدال الشرطات والمحارف الخاصة بمسافات
    .replace(/[-+_=|\\]/g, ' ')
    // تقليص المسافات الزائدة
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * فحص دعم الصوت العربي واختيار أنسب لغة
 */
export async function getBestArabicVoice(): Promise<{
  supported: boolean;
  langCode: string;
  source: 'native' | 'web' | 'none';
}> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const result = await TextToSpeech.getSupportedLanguages();
      const languages = result.languages || [];

      if (languages.includes('ar-SA')) {
        return { supported: true, langCode: 'ar-SA', source: 'native' };
      }
      if (languages.includes('ar-EG')) {
        return { supported: true, langCode: 'ar-EG', source: 'native' };
      }
      const anyArabic = languages.find((l) => l.toLowerCase().startsWith('ar'));
      if (anyArabic) {
        return { supported: true, langCode: anyArabic, source: 'native' };
      }
    } catch (e) {
      console.warn('TextToSpeech getSupportedLanguages failed on native:', e);
    }
  }

  // فحص Web SpeechSynthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    const hasArabicVoice = voices.some((v) => v.lang.toLowerCase().startsWith('ar'));
    return {
      supported: hasArabicVoice,
      langCode: hasArabicVoice ? 'ar-SA' : 'ar',
      source: 'web',
    };
  }

  return { supported: false, langCode: 'ar-SA', source: 'none' };
}

/**
 * فتح إعدادات تثبيت الصوت العربي على الهاتف
 */
export async function openVoiceInstall(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      if (typeof (TextToSpeech as unknown as { openInstall?: () => Promise<void> }).openInstall === 'function') {
        await (TextToSpeech as unknown as { openInstall: () => Promise<void> }).openInstall();
        return;
      }
    } catch (err) {
      console.warn('TextToSpeech.openInstall not supported:', err);
    }
  }
}

/**
 * نطق النص باللغة العربية بصوت واضح
 */
export async function speakArabicText(
  text: string,
  options?: { rate?: number; volume?: number }
): Promise<{ success: boolean; needsVoiceInstall?: boolean; error?: string }> {
  stopAllSpeech();

  const cleanText = sanitizeArabicTextForSpeech(text);
  if (!cleanText) return { success: true };

  const rate = options?.rate ?? 0.9;
  const volume = options?.volume ?? 1.0;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const voiceInfo = await getBestArabicVoice();
      if (!voiceInfo.supported) {
        return {
          success: false,
          needsVoiceInstall: true,
          error: 'حزمة الصوت العربي غير مثبتة على الهاتف.',
        };
      }

      isSpeaking = true;
      await TextToSpeech.speak({
        text: cleanText,
        lang: voiceInfo.langCode,
        rate,
        volume,
        category: 'ambient',
      });
      isSpeaking = false;
      return { success: true };
    } catch (err) {
      isSpeaking = false;
      console.warn('Native TTS failed, trying web fallback:', err);
    }
  }

  // Web SpeechSynthesis Fallback
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ar-SA';
      utterance.rate = rate;
      utterance.volume = volume;

      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }

      isSpeaking = true;
      utterance.onend = () => {
        isSpeaking = false;
      };
      utterance.onerror = () => {
        isSpeaking = false;
      };

      window.speechSynthesis.speak(utterance);
      return { success: true };
    } catch (err) {
      isSpeaking = false;
      return { success: false, error: (err as Error)?.message || 'فشل تشغيل الصوت في المتصفح' };
    }
  }

  return { success: false, error: 'المتصفح لا يدعم تحويل النص إلى كلام' };
}

/**
 * إيقاف أي كلام أو نطق جاري
 */
export function stopAllSpeech(): void {
  isSpeaking = false;
  if (Capacitor.isNativePlatform()) {
    try {
      TextToSpeech.stop().catch(() => {});
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/**
 * تشغيل نغمة المنبّه المهدئة والمميزة عبر Web Audio API
 * تتردد كل بضع ثوانٍ حتى يتصرف المريض
 */
export function playAlarmSound(volume = 0.9): void {
  stopAlarmSound();
  unlockAudioContext();

  const playChimeSequence = () => {
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      // نغمة طبية لطيفة ثلاثية النبرات
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.16);

        const startTime = now + idx * 0.16;
        const endTime = startTime + 0.35;

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(Math.min(volume * 0.7, 1), startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(startTime);
        osc.stop(endTime);
      });
    } catch (err) {
      console.warn('Alarm sound playback error:', err);
    }
  };

  playChimeSequence();
  // تكرار النغمة كل 5 ثوانٍ
  alarmOscillatorInterval = window.setInterval(playChimeSequence, 5000);
}

/**
 * إيقاف صوت المنبّه
 */
export function stopAlarmSound(): void {
  if (alarmOscillatorInterval !== null) {
    clearInterval(alarmOscillatorInterval);
    alarmOscillatorInterval = null;
  }
}

/**
 * إيقاف نغمة المنبه المتكررة والنطق الصوتي فوراً
 */
export function stopRepeatingAlarm(): void {
  stopAlarmSound();
  stopAllSpeech();
}

