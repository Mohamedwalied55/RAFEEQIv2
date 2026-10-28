/**
 * حالة المزامنة الأخيرة (في الذاكرة فقط) لعرضها في شاشة التشخيص
 */
export const syncStatus: {
  lastError: string | null;
  lastErrorAt: string | null;
  lastSuccessAt: string | null;
} = {
  lastError: null,
  lastErrorAt: null,
  lastSuccessAt: null,
};

export function describeError(err: unknown): string {
  const e = err as { code?: string; message?: string } | undefined;
  return [e?.code, e?.message].filter(Boolean).join(' — ') || 'خطأ غير معروف';
}
