#!/usr/bin/env node
/**
 * سكريبت تصحيح وتهيئة إعدادات أندرويد لتطبيق رفيقي
 * يُنفّذ تلقائياً بعد إضافة أو مزامنة منصة أندرويد:
 * 1. إضافة أذونات الإشعارات والمنبّه الدقيق والاهتزاز إلى AndroidManifest.xml
 * 2. نسخ ملف صوت المنبّه alarm.wav من resources/ إلى res/raw/
 */

import fs from 'fs';
import path from 'path';

const ANDROID_MANIFEST_PATH = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const RES_RAW_DIR = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'raw');
const SOURCE_SOUND_PATH = path.join(process.cwd(), 'resources', 'alarm.wav');
const TARGET_SOUND_PATH = path.join(RES_RAW_DIR, 'alarm.wav');

const REQUIRED_PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
];

console.log('🤖 [RAFEEQI] تشغيل سكريبت ضبط منصة أندرويد...');

// 1. فحص ملف AndroidManifest.xml
if (fs.existsSync(ANDROID_MANIFEST_PATH)) {
  let manifestContent = fs.readFileSync(ANDROID_MANIFEST_PATH, 'utf-8');
  let modified = false;

  for (const perm of REQUIRED_PERMISSIONS) {
    const permTag = `<uses-permission android:name="${perm}" />`;
    if (!manifestContent.includes(perm)) {
      // إدراج الصلاحية قبل أول وسم <application
      manifestContent = manifestContent.replace(
        '<application',
        `    ${permTag}\n    <application`
      );
      modified = true;
      console.log(`  ➕ تمت إضافة الإذن: ${perm}`);
    }
  }

  if (modified) {
    fs.writeFileSync(ANDROID_MANIFEST_PATH, manifestContent, 'utf-8');
    console.log('  ✅ تم تحديث AndroidManifest.xml بنجاح بالأذونات المطلوبة.');
  } else {
    console.log('  ℹ️ جميع أذونات أندرويد موجودة بالفعل في AndroidManifest.xml.');
  }

  // 1.5 إنشاء أيقونة الإشعار الصغيرة (ic_stat_icon_config_sample) إن لم تكن موجودة
  const drawableDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'drawable');
  const iconPath = path.join(drawableDir, 'ic_stat_icon_config_sample.xml');
  if (!fs.existsSync(iconPath)) {
    fs.mkdirSync(drawableDir, { recursive: true });
    const iconXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M12,22c1.1,0 2,-0.9 2,-2h-4c0,1.1 0.9,2 2,2zM18,16v-5c0,-3.07 -1.63,-5.64 -4.5,-6.32L13.5,4c0,-0.83 -0.67,-1.5 -1.5,-1.5s-1.5,0.67 -1.5,1.5v0.68C7.64,5.36 6,7.92 6,11v5l-2,2v1h16v-1l-2,-2z" />
</vector>
`;
    fs.writeFileSync(iconPath, iconXml, 'utf-8');
    console.log('  🔔 تم إنشاء أيقونة الإشعار ic_stat_icon_config_sample.xml');
  }

  // 2. فحص ونسخ ملف صوت المنبّه alarm.wav
  if (fs.existsSync(SOURCE_SOUND_PATH)) {
    if (!fs.existsSync(RES_RAW_DIR)) {
      fs.mkdirSync(RES_RAW_DIR, { recursive: true });
    }
    fs.copyFileSync(SOURCE_SOUND_PATH, TARGET_SOUND_PATH);
    console.log('  🔊 تم نسخ ملف صوت المنبّه alarm.wav إلى res/raw/');
  } else {
    console.log('  ⚠️ تنبيه: لم يتم العثور على resources/alarm.wav. يرجى إضافة ملف صوت بصيغة WAV لتفعيل الرنين المخصص على أندرويد.');
  }
} else {
  console.log('  ℹ️ لم يتم العثور على مجلد أندرويد بعد (نفّذ npm run android:add أولاً لإضافته).');
}


// 3. أيقونة التطبيق (تستبدل أيقونة Capacitor الافتراضية)
const ICONS_SRC = path.join(process.cwd(), 'native-assets', 'android-icons');
const RES_DIR = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(ICONS_SRC) && fs.existsSync(RES_DIR)) {
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const from = path.join(ICONS_SRC, `mipmap-${d}`);
    const to = path.join(RES_DIR, `mipmap-${d}`);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
  }
  fs.mkdirSync(path.join(RES_DIR, 'values'), { recursive: true });
  fs.copyFileSync(path.join(ICONS_SRC, 'ic_launcher_background.xml'), path.join(RES_DIR, 'values', 'ic_launcher_background.xml'));
  console.log('  🖼️ تم تركيب أيقونة التطبيق.');
}

console.log('✨ [RAFEEQI] اكتمل فحص وتصحيح منصة أندرويد.');
