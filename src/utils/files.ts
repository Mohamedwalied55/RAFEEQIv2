/**
 * معالجة وضغط الصور قبل إرسالها للذكاء الاصطناعي أو حفظها
 */

export interface CompressedImage {
  base64: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * ضغط الصورة لتكون بحد أقصى 1280px وبجودة JPEG 0.8
 * حتى تناسب حدود الـ Worker والشبكة
 */
export async function compressImageFile(
  fileOrBlob: File | Blob,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.8
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('فشل معالجة الصورة'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('فشل تهيئة مساحة الرسم للضغط'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const parts = dataUrl.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const base64 = parts[1];
        const sizeBytes = Math.round((base64.length * 3) / 4);

        resolve({ base64, mimeType, sizeBytes });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}
