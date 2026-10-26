/**
 * عميل الاتصال بـ Cloudflare Worker للذكاء الاصطناعي
 * Worker URL: https://rafeeqi-ai.waliedm756.workers.dev
 */
import { auth } from '../lib/firebase';

const TIMEOUT_MS = 45000;

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface DrugInfoResponse {
  info: string;
  tradeNames?: string[];
  activeIngredients?: string[];
  category?: string;
  usage?: string;
  sideEffects?: string;
  warnings?: string;
}

export interface DrugInteractionItem {
  name: string;
  strength: string;
  form: string;
}

export interface InteractionAnalysisResponse {
  analysis: string;
  hasCriticalInteractions?: boolean;
  recommendations?: string[];
}

function getBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL || 'https://rafeeqi-ai.waliedm756.workers.dev';
  return url.replace(/\/+$/, '');
}

async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (err) {
    console.warn('Could not fetch Firebase ID token:', err);
  }
  return null;
}

async function postJson<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw {
      message: 'إعداد الخادم ناقص (VITE_API_BASE_URL غير محدد)',
      code: 'SERVER_CONFIG_MISSING',
    } as ApiError;
  }

  const token = await getAuthToken();
  if (!token) {
    throw {
      message: 'سجّل دخولك لاستخدام المساعد الذكي',
      code: 'AUTH_REQUIRED',
      status: 401,
    } as ApiError;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      let errorCode = `HTTP_${response.status}`;

      if (isJson) {
        try {
          const errData = await response.json();
          if (errData.error) errorMsg = errData.error;
          if (errData.code) errorCode = errData.code;
        } catch {
          // ignore json parse error
        }
      } else {
        const text = await response.text();
        if (text) errorMsg = `${errorMsg}: ${text.substring(0, 100)}`;
      }

      throw {
        message: errorMsg,
        code: errorCode,
        status: response.status,
      } as ApiError;
    }

    if (!isJson) {
      throw {
        message: 'استجابة الخادم ليست بصيغة JSON صحيحة',
        code: 'INVALID_JSON',
        status: response.status,
      } as ApiError;
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as Error)?.name === 'AbortError') {
      throw {
        message: 'انتهت مهلة الاتصال بالخادم (45 ثانية)',
        code: 'TIMEOUT',
      } as ApiError;
    }
    if ((err as ApiError)?.message) {
      throw err;
    }
    throw {
      message: (err as Error)?.message || 'فشل الاتصال بالخادم',
      code: 'NETWORK_ERROR',
    } as ApiError;
  }
}

/**
 * محادثة المساعد الطبي الذكي
 */
export async function callHealthAssistant(params: {
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  history?: AssistantMessage[];
}): Promise<{ reply: string }> {
  // الحفاظ على آخر 4 رسائل كسياق
  const history = (params.history || []).slice(-4);
  return await postJson<{ reply: string }>('/api/health-assistant', {
    prompt: params.prompt,
    imageBase64: params.imageBase64,
    imageMimeType: params.imageMimeType,
    history,
  });
}

/**
 * البحث عن معلومات دواء
 */
export async function lookupDrug(drugName: string): Promise<DrugInfoResponse> {
  return await postJson<DrugInfoResponse>('/api/lookup-drug', { drugName });
}

/**
 * فحص التداخلات الدوائية
 */
export async function checkInteractions(
  medications: DrugInteractionItem[]
): Promise<InteractionAnalysisResponse> {
  if (medications.length < 2) {
    throw {
      message: 'يجب اختيار دوائين على الأقل لفحص التفاعلات',
      code: 'MIN_MEDICATIONS_REQUIRED',
    } as ApiError;
  }
  // الحد الأقصى 20 دواء
  const sliced = medications.slice(0, 20);
  return await postJson<InteractionAnalysisResponse>('/api/check-interactions', {
    medications: sliced,
  });
}
