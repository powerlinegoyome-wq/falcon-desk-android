import React, { useState, useEffect } from 'react';
import { useChatStore, playFalconCry } from '../../store/useChatStore';
import { Switch } from '../Common/Switch';
import { FlagTR, FlagGB, FlagSA, FlagES } from '../Common/Flags';
import { useI18n } from '../../locales/i18n';
import logoImg from '../../assets/logo.png';
import {
  X,
  Key,
  Shield,
  MessageSquareQuote,
  Zap,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Save,
  Play,
  Square,
  Moon,
  Sun,
  Volume2,
  Sparkles,
  Globe,
  Check,
} from 'lucide-react';
import { DatabaseStats, QuickReply, SupportedLanguage } from '../../../types';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    settings,
    saveSettings,
    setTheme,
    setLanguage,
    botStatus,
    startBot,
    stopBot,
    quickReplies,
    saveQuickReply,
    deleteQuickReply,
  } = useChatStore();

  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'appearance' | 'language' | 'bot' | 'autoReply' | 'quickReplies' | 'storage'>('appearance');
  const [tokenInput, setTokenInput] = useState(settings.botToken || '');
  const [allowedChatId, setAllowedChatId] = useState(settings.allowedChatId || '');
  const [whitelistEnabled, setWhitelistEnabled] = useState(settings.whitelistEnabled || false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success?: boolean; error?: string; username?: string } | null>(null);

  const [autoReplyEnabled, setAutoReplyEnabled] = useState(settings.autoReplyEnabled);
  const [autoReplyMessage, setAutoReplyMessage] = useState(settings.autoReplyMessage);
  const [playSound, setPlaySound] = useState(settings.playSound);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(settings.theme || 'dark');

  // Quick Replies local form
  const [newShortcut, setNewShortcut] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);

  // Storage stats
  const [stats, setStats] = useState<DatabaseStats | null>(null);

  useEffect(() => {
    if (isSettingsOpen) {
      setTokenInput(settings.botToken || '');
      setAllowedChatId(settings.allowedChatId || '');
      setWhitelistEnabled(settings.whitelistEnabled || false);
      setAutoReplyEnabled(settings.autoReplyEnabled);
      setAutoReplyMessage(settings.autoReplyMessage);
      setPlaySound(settings.playSound);
      setCurrentTheme(settings.theme || 'dark');
      loadStats();
    }
  }, [isSettingsOpen, settings.botToken, settings.allowedChatId, settings.whitelistEnabled, settings.autoReplyEnabled, settings.autoReplyMessage, settings.playSound, settings.theme]);

  const loadStats = async () => {
    try {
      const s = await window.electronAPI.getDatabaseStats();
      setStats(s);
    } catch {}
  };

  if (!isSettingsOpen) return null;

  const activeLang = settings.language || 'tr';

  const handleThemeChange = async (theme: 'dark' | 'light') => {
    setCurrentTheme(theme);
    await setTheme(theme);
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
  };

  const handleSaveBotConfig = async () => {
    if (!tokenInput.trim()) return;

    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const res = await window.electronAPI.botVerifyToken(tokenInput.trim());
      if (res.success && res.botInfo) {
        setVerifyResult({ success: true, username: res.botInfo.username });
        await saveSettings({
          botToken: tokenInput.trim(),
          allowedChatId: allowedChatId.trim(),
          whitelistEnabled: Boolean(allowedChatId.trim() ? whitelistEnabled : false),
        });
        await startBot();
      } else {
        setVerifyResult({ success: false, error: res.error || t('settings.botConfig.invalidToken') });
      }
    } catch (err: any) {
      setVerifyResult({ success: false, error: err.message || 'Error' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveAutoReply = async () => {
    await saveSettings({
      autoReplyEnabled,
      autoReplyMessage: autoReplyMessage.trim(),
    });
    alert(t('settings.autoReply.savedAlert'));
  };

  const handleSaveQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcut.trim() || !newTitle.trim() || !newText.trim()) return;

    const shortcut = newShortcut.startsWith('/') ? newShortcut.trim() : `/${newShortcut.trim()}`;
    await saveQuickReply({
      id: editingReplyId || undefined,
      shortcut,
      title: newTitle.trim(),
      text: newText.trim(),
    });

    setNewShortcut('');
    setNewTitle('');
    setNewText('');
    setEditingReplyId(null);
  };

  const handleEditQuickReply = (qr: QuickReply) => {
    setEditingReplyId(qr.id);
    setNewShortcut(qr.shortcut);
    setNewTitle(qr.title);
    setNewText(qr.text);
  };

  const handleClearDatabase = async () => {
    if (confirm(t('actions.resetHistoryConfirm'))) {
      await window.electronAPI.clearDatabase();
      await loadStats();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-[#0D0D0D] border border-[#222222] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] animate-scale-in">
        {/* Header with Falcon Desk Logo */}
        <div className="h-14 px-5 border-b border-[#1A1A1A] flex items-center justify-between bg-[#0A0A0A]">
          <div className="flex items-center space-x-3 text-[#EDEDED] font-semibold text-sm">
            <img src={logoImg} alt="Falcon Desk" className="w-6 h-6 rounded-lg object-contain" />
            <span>{t('settings.title')}</span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-xl text-[#888888] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 6-Column Distributed Tabs (Scrollable on Mobile) */}
        <div className="flex overflow-x-auto sm:grid sm:grid-cols-6 border-b border-[#1A1A1A] bg-[#0A0A0A] px-2 text-center">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'appearance'
                ? 'border-[#3B82F6] text-[#3B82F6]'
                : 'border-transparent text-[#888888] hover:text-[#EDEDED]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('settings.tabs.appearance')}</span>
          </button>

          <button
            onClick={() => setActiveTab('language')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'language'
                ? 'border-[#3B82F6] text-[#3B82F6]'
                : 'border-transparent text-[#888888] hover:text-[#EDEDED]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t('settings.tabs.language')}</span>
          </button>

          <button
            onClick={() => setActiveTab('bot')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'bot'
                ? 'border-[#3B82F6] text-[#3B82F6]'
                : 'border-transparent text-[#888888] hover:text-[#EDEDED]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{t('settings.tabs.bot')}</span>
          </button>

          <button
            onClick={() => setActiveTab('autoReply')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'autoReply'
                ? 'border-[#3B82F6] text-[#3B82F6]'
                : 'border-transparent text-[#888888] hover:text-[#EDEDED]'
            }`}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>{t('settings.tabs.autoReply')}</span>
          </button>

          <button
            onClick={() => setActiveTab('quickReplies')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'quickReplies'
                ? 'border-[#3B82F6] text-[#3B82F6]'
                : 'border-transparent text-[#888888] hover:text-[#EDEDED]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t('settings.tabs.quickReplies')}</span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'storage'
                ? 'border-[#3B82F6] text-[#3B82F6]'
                : 'border-transparent text-[#888888] hover:text-[#EDEDED]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{t('settings.tabs.storage')}</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-[#0D0D0D]">
          {/* TAB 0: Appearance & Theme */}
          {activeTab === 'appearance' && (
            <div className="space-y-5">
              {/* Theme Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#EDEDED] mb-2.5">
                  {t('settings.theme.title')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Dark Mode Card */}
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                      currentTheme === 'dark'
                        ? 'bg-[#181818] border-[#3B82F6] ring-1 ring-[#3B82F6]'
                        : 'bg-[#121212] border-[#222222] hover:border-[#444444]'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-[#000000] text-[#3B82F6] border border-[#222222]">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-[#EDEDED]">{t('settings.theme.dark')}</div>
                  </button>

                  {/* Light Mode Card */}
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`p-3.5 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                      currentTheme === 'light'
                        ? 'bg-white border-[#3B82F6] ring-1 ring-[#3B82F6]'
                        : 'bg-[#121212] border-[#222222] hover:border-[#444444]'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-[#EDEDED]">{t('settings.theme.light')}</div>
                  </button>
                </div>
              </div>

              {/* Sound Notifications */}
              <div className="p-3.5 bg-[#121212] border border-[#222222] rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-[#1A1A1A] text-[#3B82F6]">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-[#EDEDED]">{t('settings.sound.title')}</div>
                </div>
                <Switch
                  checked={playSound}
                  onChange={(val) => {
                    setPlaySound(val);
                    saveSettings({ playSound: val });
                  }}
                  color="blue"
                />
              </div>
            </div>
          )}

          {/* TAB 1: Language Selection */}
          {activeTab === 'language' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#EDEDED] mb-3 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-[#3B82F6]" />
                  <span>{t('settings.language.title')}</span>
                </label>
                <div className="grid grid-cols-2 gap-3.5">
                  {/* Türkçe */}
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('tr')}
                    className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all focus:outline-none ${
                      activeLang === 'tr'
                        ? 'bg-[#181818] border-[#3B82F6] ring-1 ring-[#3B82F6] text-[#EDEDED] shadow-lg shadow-blue-500/10'
                        : 'bg-[#121212] border-[#222222] text-[#888888] hover:border-[#444444] hover:text-[#EDEDED]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <FlagTR className="w-8 h-6 shadow" />
                      <div className="text-sm font-semibold text-[#EDEDED]">Türkçe</div>
                    </div>
                    {activeLang === 'tr' && (
                      <div className="w-5 h-5 rounded-full bg-[#3B82F6] flex items-center justify-center text-white">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* English */}
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('en')}
                    className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all focus:outline-none ${
                      activeLang === 'en'
                        ? 'bg-[#181818] border-[#3B82F6] ring-1 ring-[#3B82F6] text-[#EDEDED] shadow-lg shadow-blue-500/10'
                        : 'bg-[#121212] border-[#222222] text-[#888888] hover:border-[#444444] hover:text-[#EDEDED]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <FlagGB className="w-8 h-6 shadow" />
                      <div className="text-sm font-semibold text-[#EDEDED]">English</div>
                    </div>
                    {activeLang === 'en' && (
                      <div className="w-5 h-5 rounded-full bg-[#3B82F6] flex items-center justify-center text-white">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* العربية */}
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('ar')}
                    className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all focus:outline-none ${
                      activeLang === 'ar'
                        ? 'bg-[#181818] border-[#3B82F6] ring-1 ring-[#3B82F6] text-[#EDEDED] shadow-lg shadow-blue-500/10'
                        : 'bg-[#121212] border-[#222222] text-[#888888] hover:border-[#444444] hover:text-[#EDEDED]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <FlagSA className="w-8 h-6 shadow" />
                      <div className="text-sm font-semibold text-[#EDEDED]">العربية</div>
                    </div>
                    {activeLang === 'ar' && (
                      <div className="w-5 h-5 rounded-full bg-[#3B82F6] flex items-center justify-center text-white">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Español */}
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('es')}
                    className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all focus:outline-none ${
                      activeLang === 'es'
                        ? 'bg-[#181818] border-[#3B82F6] ring-1 ring-[#3B82F6] text-[#EDEDED] shadow-lg shadow-blue-500/10'
                        : 'bg-[#121212] border-[#222222] text-[#888888] hover:border-[#444444] hover:text-[#EDEDED]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <FlagES className="w-8 h-6 shadow" />
                      <div className="text-sm font-semibold text-[#EDEDED]">Español</div>
                    </div>
                    {activeLang === 'es' && (
                      <div className="w-5 h-5 rounded-full bg-[#3B82F6] flex items-center justify-center text-white">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Bot & Chat ID */}
          {activeTab === 'bot' && (
            <div className="space-y-4">
              {/* Bot Token */}
              <div>
                <label className="block text-xs font-medium text-[#EDEDED] mb-1.5">
                  {t('settings.botConfig.tokenLabel')}
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={t('settings.botConfig.tokenPlaceholder')}
                  className="w-full bg-[#121212] border border-[#222222] rounded-2xl px-3.5 py-2.5 text-xs text-[#EDEDED] placeholder-[#888888] focus:outline-none focus:border-[#3B82F6] font-mono select-text"
                />
              </div>

              {/* Allowed Chat ID Whitelist */}
              <div className="p-3.5 bg-[#121212] border border-[#222222] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-[#EDEDED]">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>{t('settings.botConfig.whitelistTitle')}</span>
                  </div>
                  <Switch
                    checked={whitelistEnabled}
                    onChange={(val) => setWhitelistEnabled(val)}
                    color="green"
                  />
                </div>

                <input
                  type="text"
                  value={allowedChatId}
                  onChange={(e) => setAllowedChatId(e.target.value)}
                  placeholder={t('settings.botConfig.whitelistPlaceholder')}
                  className="w-full bg-[#181818] border border-[#262626] rounded-xl px-3 py-2 text-xs text-[#EDEDED] placeholder-[#888888] focus:outline-none focus:border-[#3B82F6] select-text font-mono"
                />
              </div>

              {/* Save & Verify Button */}
              <button
                onClick={handleSaveBotConfig}
                disabled={isVerifying || !tokenInput.trim()}
                className="w-full py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#1A1A1A] text-white disabled:text-[#555555] text-xs font-semibold rounded-2xl transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 disabled:shadow-none"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('actions.verifying')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('actions.saveAndStart')}</span>
                  </>
                )}
              </button>

              {verifyResult && (
                <div
                  className={`p-3 rounded-2xl border text-xs flex items-center space-x-2.5 ${
                    verifyResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {verifyResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>@{verifyResult.username}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      <span>{verifyResult.error}</span>
                    </>
                  )}
                </div>
              )}

              {/* Bot Status Indicator Card */}
              <div className="bg-[#121212] border border-[#222222] rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-[#EDEDED]">{t('settings.botConfig.statusTitle')}</div>
                  <div className="text-[11px] text-[#888888] mt-0.5">
                    {botStatus.isConnected ? (
                      <span className="text-emerald-400 font-medium">
                        {t('settings.botConfig.active')} (@{botStatus.botInfo?.username})
                      </span>
                    ) : botStatus.isConnecting ? (
                      <span className="text-amber-400">{t('app.connecting')}</span>
                    ) : (
                      <span className="text-[#888888]">{t('settings.botConfig.stopped')}</span>
                    )}
                  </div>
                </div>

                {botStatus.isConnected ? (
                  <button
                    onClick={() => stopBot()}
                    className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-medium flex items-center space-x-1.5"
                  >
                    <Square className="w-3 h-3 fill-rose-400" />
                    <span>{t('actions.stop')}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => startBot()}
                    disabled={!settings.botToken}
                    className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#1A1A1A] text-white disabled:text-[#555555] rounded-xl text-xs font-medium flex items-center space-x-1.5"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>{t('actions.start')}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Auto Reply */}
          {activeTab === 'autoReply' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between p-3.5 bg-[#121212] border border-[#222222] rounded-2xl">
                <div>
                  <div className="text-xs font-medium text-[#EDEDED]">
                    {t('settings.autoReply.switchLabel')}
                  </div>
                </div>
                <Switch
                  checked={autoReplyEnabled}
                  onChange={(val) => setAutoReplyEnabled(val)}
                  color="blue"
                />
              </div>

              {autoReplyEnabled && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[#EDEDED]">
                    {t('settings.autoReply.textLabel')}
                  </label>
                  <textarea
                    rows={4}
                    value={autoReplyMessage}
                    onChange={(e) => setAutoReplyMessage(e.target.value)}
                    placeholder={t('settings.autoReply.placeholder')}
                    className="w-full bg-[#121212] border border-[#222222] rounded-2xl p-3 text-xs text-[#EDEDED] focus:outline-none focus:border-[#3B82F6] leading-relaxed select-text"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleSaveAutoReply}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-blue-500/20"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('actions.save')}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Quick Replies */}
          {activeTab === 'quickReplies' && (
            <div className="space-y-3.5">
              <form onSubmit={handleSaveQuickReply} className="p-3.5 bg-[#121212] border border-[#222222] rounded-2xl space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value)}
                    placeholder={t('settings.quickReplies.shortcutPlaceholder')}
                    className="bg-[#181818] border border-[#262626] rounded-xl px-3 py-2 text-xs text-[#EDEDED] placeholder-[#888888] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t('settings.quickReplies.titlePlaceholder')}
                    className="bg-[#181818] border border-[#262626] rounded-xl px-3 py-2 text-xs text-[#EDEDED] placeholder-[#888888] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>

                <textarea
                  rows={2}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder={t('settings.quickReplies.textPlaceholder')}
                  className="w-full bg-[#181818] border border-[#262626] rounded-xl p-2.5 text-xs text-[#EDEDED] placeholder-[#888888] focus:outline-none focus:border-[#3B82F6]"
                />

                <div className="flex justify-end space-x-2">
                  {editingReplyId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingReplyId(null);
                        setNewShortcut('');
                        setNewTitle('');
                        setNewText('');
                      }}
                      className="px-3 py-1.5 text-xs text-[#888888]"
                    >
                      {t('actions.cancel')}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold"
                  >
                    {editingReplyId ? t('actions.update') : t('actions.add')}
                  </button>
                </div>
              </form>

              <div className="divide-y divide-[#222222] border border-[#222222] rounded-2xl overflow-hidden bg-[#121212] max-h-48 overflow-y-auto">
                {quickReplies.map((qr) => (
                  <div key={qr.id} className="p-3 px-3.5 flex items-center justify-between hover:bg-[#181818] transition-colors">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-[#EDEDED]">{qr.title}</span>
                        <span className="font-mono text-[10px] text-[#3B82F6]">{qr.shortcut}</span>
                      </div>
                      <p className="text-[11px] text-[#888888] truncate mt-0.5">{qr.text}</p>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button
                        onClick={() => handleEditQuickReply(qr)}
                        className="px-2 py-1 text-xs text-[#888888] hover:text-[#EDEDED]"
                      >
                        {t('actions.edit')}
                      </button>
                      <button
                        onClick={() => deleteQuickReply(qr.id)}
                        className="p-1 text-[#888888] hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Storage */}
          {activeTab === 'storage' && (
            <div className="space-y-3.5">
              {stats && (
                <div className="p-4 bg-[#121212] border border-[#222222] rounded-2xl space-y-2">
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 bg-[#181818] rounded-xl border border-[#262626]">
                      <div className="text-sm font-bold text-[#3B82F6]">{stats.chatsCount}</div>
                      <div className="text-[10px] text-[#888888]">{t('settings.storage.chats')}</div>
                    </div>
                    <div className="p-2.5 bg-[#181818] rounded-xl border border-[#262626]">
                      <div className="text-sm font-bold text-emerald-400">{stats.messagesCount}</div>
                      <div className="text-[10px] text-[#888888]">{t('settings.storage.messages')}</div>
                    </div>
                    <div className="p-2.5 bg-[#181818] rounded-xl border border-[#262626]">
                      <div className="text-sm font-bold text-amber-400">{stats.mediaSizeFormatted}</div>
                      <div className="text-[10px] text-[#888888]">{t('settings.storage.media')}</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleClearDatabase}
                className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('actions.resetHistory')}</span>
              </button>
            </div>
          )}
        </div>

        {/* App Version Footer */}
        <div className="px-6 py-2.5 border-t border-[#1A1A1A] flex items-center justify-between text-[11px] bg-[#0D0D0D] rounded-b-3xl select-none">
          <span className="text-[#666666]">Falcon Desk Android v1.1.0</span>
          <span className="text-[#444444]">Open Source</span>
        </div>
      </div>
    </div>
  );
};
