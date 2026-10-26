# ملفات الموارد الصوتية لتطبيق رفيقي (RAFEEQI)

## صوت المنبّه (`alarm.wav`)
الملف الموجود هنا نغمة منبّه افتراضية (نغمات متتابعة مدتها حوالي 4 ثوانٍ). يمكنك استبداله بأي ملف `.wav` آخر بنفس الاسم `alarm.wav`.

عند تنفيذ `npm run android:sync` يقوم السكريبت `scripts/patch-android.mjs` تلقائياً بـ:
1. نسخ `resources/alarm.wav` إلى `android/app/src/main/res/raw/alarm.wav`.
2. إضافة أذونات الإشعارات والمنبّه الدقيق والاهتزاز إلى `AndroidManifest.xml`.
3. إنشاء أيقونة الإشعار الصغيرة `ic_stat_icon_config_sample` في `res/drawable`.

> ملاحظة: قناة الإشعارات في أندرويد تثبّت الصوت عند أول إنشاء لها. لو غيّرت الصوت بعد تثبيت التطبيق، احذف التطبيق وثبّته من جديد (أو غيّر `ALARM_CHANNEL_ID` في `src/utils/nativeAlarms.ts`).
