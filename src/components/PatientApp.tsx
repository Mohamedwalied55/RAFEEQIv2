/**
 * واجهة المريض المنفصلة بالكامل (PatientApp)
 * تبويبات: اليوم، الأدوية، القياسات، التقارير، المساعد، الحاسبة، الإعدادات، من نحن
 * كود الربط RAF-XXXXXXXXXX يظهر في الإعدادات مع زرار نسخ ومشاركة عبر واتساب
 */
import React, { useState } from 'react';
import {
  Medication,
  DoseLog,
  VitalMeasurement,
  DailyReminder,
  WaterReminderConfig,
  CaregiverConfig,
  AppSettings,
  UserProfile,
} from '../types';
import { Header } from './Header';
import { Navigation, MainTabType } from './Navigation';
import { TodayTab } from './TodayTab';
import { MedsTab } from './MedsTab';
import { MeasuresTab } from './MeasuresTab';
import { ReportsTab } from './ReportsTab';
import { AIAssistantTab } from './AIAssistantTab';
import { CalculatorTab } from './CalculatorTab';
import { SettingsTab } from './SettingsTab';
import { AboutTab } from './AboutTab';
import { AlarmModal } from './AlarmModal';
import { PermissionsWizard } from './PermissionsWizard';

interface PatientAppProps {
  profile: UserProfile;
  medications: Medication[];
  doseLogs: Record<string, DoseLog>;
  vitals: VitalMeasurement[];
  reminders: DailyReminder[];
  water: WaterReminderConfig;
  caregiverConfig: CaregiverConfig;
  settings: AppSettings;
  activeAlarm: {
    med: Medication;
    time: string;
    doseKey: string;
  } | null;
  onTakeDose: (medId: string, doseKey: string, doseAmount?: number) => void;
  onSnoozeDose: (medId: string, doseKey: string, minutes: number) => void;
  onSkipDose: (medId: string, doseKey: string) => void;
  onCloseAlarm: () => void;
  onAddMedication: (med: Medication) => void;
  onUpdateMedication: (med: Medication) => void;
  onDeleteMedication: (id: string) => void;
  onAddVital: (vital: VitalMeasurement) => void;
  onDeleteVital: (id: string) => void;
  onUpdateWater: (water: WaterReminderConfig) => void;
  onToggleReminder: (id: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onUpdateCaregiver: (cfg: CaregiverConfig) => void;
  onRunTestAlarm: () => void;
  onSignOut: () => void;
  onOpenAuth: () => void;
}

export const PatientApp: React.FC<PatientAppProps> = ({
  profile,
  medications,
  doseLogs,
  vitals,
  reminders,
  water,
  caregiverConfig,
  settings,
  activeAlarm,
  onTakeDose,
  onSnoozeDose,
  onSkipDose,
  onCloseAlarm,
  onAddMedication,
  onUpdateMedication,
  onDeleteMedication,
  onAddVital,
  onDeleteVital,
  onUpdateWater,
  onToggleReminder,
  onUpdateSettings,
  onUpdateCaregiver,
  onRunTestAlarm,
  onSignOut,
  onOpenAuth,
}) => {
  const [currentTab, setCurrentTab] = useState<MainTabType>('today');
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0D1715] text-slate-800 dark:text-slate-100 flex flex-col antialiased transition-colors duration-200">
      {/* هيدر المريض (أخضر زمردي مع كود الربط وزر الاختبار) */}
      <Header
        profile={profile}
        onOpenPermissions={() => setIsPermissionsOpen(true)}
        onTestAlarm={onRunTestAlarm}
      />

      {/* المحتوى الرئيسي للمريض */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-3 pb-[max(env(safe-area-inset-bottom,0px)+80px,96px)]">
        {currentTab === 'today' && (
          <TodayTab
            medications={medications}
            doseLogs={doseLogs}
            reminders={reminders}
            water={water}
            caregiverConfig={caregiverConfig}
            patientName={profile.displayName}
            onTakeDose={onTakeDose}
            onSnoozeDose={onSnoozeDose}
            onSkipDose={onSkipDose}
            onUpdateWater={onUpdateWater}
            onToggleReminder={onToggleReminder}
          />
        )}

        {currentTab === 'meds' && (
          <MedsTab
            medications={medications}
            onAddMedication={onAddMedication}
            onUpdateMedication={onUpdateMedication}
            onDeleteMedication={onDeleteMedication}
          />
        )}

        {currentTab === 'measures' && (
          <MeasuresTab
            vitals={vitals}
            onAddVital={onAddVital}
            onDeleteVital={onDeleteVital}
          />
        )}

        {currentTab === 'reports' && (
          <ReportsTab
            patientName={profile.displayName}
            medications={medications}
            doseLogs={doseLogs}
            vitals={vitals}
            caregiverConfig={caregiverConfig}
          />
        )}

        {currentTab === 'assistant' && <AIAssistantTab />}

        {currentTab === 'calculator' && <CalculatorTab medications={medications} />}

        {currentTab === 'settings' && (
          <SettingsTab
            settings={settings}
            caregiverConfig={caregiverConfig}
            profile={profile}
            onUpdateSettings={onUpdateSettings}
            onUpdateCaregiver={onUpdateCaregiver}
            onOpenPermissions={() => setIsPermissionsOpen(true)}
            onTestAlarm={onRunTestAlarm}
            onOpenAuth={onOpenAuth}
            onSignOut={onSignOut}
          />
        )}

        {currentTab === 'about' && <AboutTab />}
      </main>

      {/* شريط المريض السفلي */}
      <Navigation currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* شاشة المنبّه الحركية عند حلول موعد الجرعة للمريض فقط */}
      {activeAlarm && (
        <AlarmModal
          medication={activeAlarm.med}
          scheduledTime={activeAlarm.time}
          doseKey={activeAlarm.doseKey}
          onTakeDose={onTakeDose}
          onSnoozeDose={onSnoozeDose}
          onSkipDose={onSkipDose}
          onClose={onCloseAlarm}
        />
      )}

      {/* معالج الأذونات والمنبّه */}
      <PermissionsWizard
        isOpen={isPermissionsOpen}
        onClose={() => setIsPermissionsOpen(false)}
      />
    </div>
  );
};
