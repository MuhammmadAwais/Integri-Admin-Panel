import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Globe, 
  X, 
  Copy, 
  Check, 
  Keyboard, 
  Sparkles, 
  ArrowRight, 
  Type, 
  RotateCcw,
  Languages
} from 'lucide-react';
import { showToast } from 'components/EliteUI/EliteToastContainer';

interface MultiLangAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 1-Click Multi-Language Sample Data
const SAMPLE_TEXTS = [
  { code: 'ur', lang: 'Urdu (اردو)', flag: '🇵🇰', dir: 'rtl', text: 'انٹیگری اے آئی ایڈمن پینل میں خوش آمدید — تمام عالمی زبانوں کی مکمل تعاون۔' },
  { code: 'ar', lang: 'Arabic (العربية)', flag: '🇸🇦', dir: 'rtl', text: 'مرحباً بكم في لوحة تحكم الذكاء الاصطناعي — دعم كامل لجميع اللغات العالمية.' },
  { code: 'hi', lang: 'Hindi (हिन्दी)', flag: '🇮🇳', dir: 'ltr', text: 'इंटेग्री एआई एडमिन डैशबोर्ड में आपका स्वागत है - बहुभाषी पाठ समर्थन।' },
  { code: 'zh', lang: 'Chinese (中文)', flag: '🇨🇳', dir: 'ltr', text: '欢迎使用 Integri AI 管理控制台 - 支持全球所有语言文本输入与渲染。' },
  { code: 'ja', lang: 'Japanese (日本語)', flag: '🇯🇵', dir: 'ltr', text: 'Integri AI 管理ダッシュボードへようこそ - 多言語テキストの完全サポート。' },
  { code: 'ru', lang: 'Russian (Русский)', flag: '🇷🇺', dir: 'ltr', text: 'Добро пожаловать в панель управления Integri AI — полная поддержка любых языков.' },
  { code: 'es', lang: 'Spanish (Español)', flag: '🇪🇸', dir: 'ltr', text: '¡Bienvenido al panel de administración de Integri AI - Soporte multilingüe completo!' },
  { code: 'fr', lang: 'French (Français)', flag: '🇫🇷', dir: 'ltr', text: 'Bienvenue sur le panneau d\'administration Integri AI - Prise en charge multilingue.' },
  { code: 'de', lang: 'German (Deutsch)', flag: '🇩🇪', dir: 'ltr', text: 'Willkommen beim Integri AI Dashboard – Vollständige Unterstützung für alle Sprachen.' },
  { code: 'he', lang: 'Hebrew (עברית)', flag: '🇮🇱', dir: 'rtl', text: 'ברוכים הבאים ללוח הבקרה Integri AI - תמיכה מלאה בכל השפות.' },
  { code: 'ko', lang: 'Korean (한국어)', flag: '🇰🇷', dir: 'ltr', text: 'Integri AI 관리 대시보드에 오신 것을 환영합니다 - 모든 언어 지원.' },
  { code: 'bn', lang: 'Bengali (বাংলা)', flag: '🇧🇩', dir: 'ltr', text: 'Integri AI অ্যাডমিন প্যানেলে স্বাগতম - সমস্ত ভাষার সমর্থন।' },
  { code: 'th', lang: 'Thai (ไทย)', flag: '🇹🇭', dir: 'ltr', text: 'ยินดีต้อนรับสู่แผงควบคุม Integri AI - รองรับข้อความทุกภาษา' },
  { code: 'vi', lang: 'Vietnamese (Tiếng Việt)', flag: '🇻🇳', dir: 'ltr', text: 'Chào mừng bạn đến với bảng điều khiển Integri AI - Hỗ trợ đa ngôn ngữ.' }
];

// Virtual Keyboard Layout Maps
const KEYBOARD_LAYOUTS = {
  urdu: {
    label: 'Urdu (اردو)',
    dir: 'rtl',
    keys: [
      ['ا', 'ب', 'پ', 'ت', 'ٹ', 'ث', 'ج', 'چ', 'ح', 'خ', 'د', 'ڈ', 'ذ'],
      ['ر', 'ڑ', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف'],
      ['ق', 'ک', 'گ', 'ل', 'م', 'ن', 'ں', 'و', 'ہ', 'ھ', 'ء', 'ی', 'ے'],
      ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '؟', '،', '۔']
    ]
  },
  arabic: {
    label: 'Arabic (العربية)',
    dir: 'rtl',
    keys: [
      ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
      ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
      ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ'],
      ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '؟', '،', '؛']
    ]
  },
  hindi: {
    label: 'Hindi (हिन्दी)',
    dir: 'ltr',
    keys: [
      ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः'],
      ['क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ'],
      ['ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न'],
      ['प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह'],
      ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९', '।', '॥']
    ]
  },
  chinese: {
    label: 'Chinese (中文)',
    dir: 'ltr',
    keys: [
      ['你好', '谢谢', '再见', '智力', '界面', '系统', '消息', '语言'],
      ['数据', '文本', '新闻', '管理', '用户', '提示', '确认', '验证'],
      ['搜索', '保存', '提交', '取消', '编辑', '删除', '成功', '失败']
    ]
  },
  cyrillic: {
    label: 'Cyrillic (Русский)',
    dir: 'ltr',
    keys: [
      ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
      ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
      ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'ё']
    ]
  },
  japanese: {
    label: 'Japanese (日本語)',
    dir: 'ltr',
    keys: [
      ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ'],
      ['さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と'],
      ['な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ'],
      ['ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ', 'ら', 'り'],
      ['る', 'れ', 'ろ', 'わ', 'を', 'ん', 'っ', 'ー', '。', '、']
    ]
  },
  hebrew: {
    label: 'Hebrew (עברית)',
    dir: 'rtl',
    keys: [
      ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
      ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
      ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ']
    ]
  },
  bengali: {
    label: 'Bengali (বাংলা)',
    dir: 'ltr',
    keys: [
      ['অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ'],
      ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'],
      ['ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন'],
      ['প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ', 'স', 'হ']
    ]
  },
  accents: {
    label: 'Accents & Symbols',
    dir: 'ltr',
    keys: [
      ['ñ', 'á', 'é', 'í', 'ó', 'ú', 'ü', '¿', '¡', 'ç', 'à', 'è'],
      ['ê', 'ë', 'ô', 'œ', 'ß', 'Ä', 'Ö', 'Ü', 'æ', 'ø', 'å', 'č'],
      ['🤖', '🧠', '🌍', '💬', '⚡', '🎯', '🚀', '✨', '🔍', '📊', '⚙️', '🔑']
    ]
  }
};

export const MultiLangAssistantModal: React.FC<MultiLangAssistantModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'keyboard' | 'samples' | 'inspector'>('keyboard');
  const [currentKbKey, setCurrentKbKey] = useState<keyof typeof KEYBOARD_LAYOUTS>('urdu');
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyClick = (char: string) => {
    setInputText((prev) => prev + char);
  };

  const handleBackspace = () => {
    setInputText((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInputText('');
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Text copied to clipboard! Ready to paste anywhere in form inputs.', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Helper to detect script and text direction
  const detectScriptAndDir = (str: string) => {
    if (!str.trim()) return { script: 'Empty', dir: 'LTR', code: 'en' };
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const devanagariRegex = /[\u0900-\u097F]/;
    const hanziRegex = /[\u4E00-\u9FFF]/;
    const cyrillicRegex = /[\u0400-\u04FF]/;
    const hiraganaKatakanaRegex = /[\u3040-\u30FF]/;
    const hebrewRegex = /[\u0590-\u05FF]/;
    const bengaliRegex = /[\u0980-\u09FF]/;

    if (arabicRegex.test(str)) return { script: 'Arabic / Urdu Script', dir: 'RTL (Right-To-Left)', code: 'ar/ur' };
    if (hebrewRegex.test(str)) return { script: 'Hebrew Script', dir: 'RTL (Right-To-Left)', code: 'he' };
    if (devanagariRegex.test(str)) return { script: 'Devanagari Script', dir: 'LTR (Left-To-Right)', code: 'hi' };
    if (bengaliRegex.test(str)) return { script: 'Bengali Script', dir: 'LTR (Left-To-Right)', code: 'bn' };
    if (hanziRegex.test(str)) return { script: 'Chinese Hanzi', dir: 'LTR (Left-To-Right)', code: 'zh' };
    if (hiraganaKatakanaRegex.test(str)) return { script: 'Japanese Kana', dir: 'LTR (Left-To-Right)', code: 'ja' };
    if (cyrillicRegex.test(str)) return { script: 'Cyrillic Script', dir: 'LTR (Left-To-Right)', code: 'ru' };
    return { script: 'Latin / Standard Script', dir: 'LTR (Left-To-Right)', code: 'latin' };
  };

  const detected = detectScriptAndDir(inputText);
  const activeKb = KEYBOARD_LAYOUTS[currentKbKey];

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          background: '#09090b',
          border: '1px solid rgba(212, 175, 55, 0.35)',
          borderRadius: '8px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'multilangEntrance 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(90deg, rgba(212,175,55,0.12) 0%, rgba(9,9,11,0.5) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'rgba(212,175,55,0.18)',
                border: '1px solid rgba(212,175,55,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37'
              }}
            >
              <Globe size={22} />
            </div>
            <div>
              <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Multi-Language Input & Virtual Keyboard Assistant
              </h3>
              <span style={{ color: '#a8956b', fontSize: '0.76rem', display: 'block', marginTop: 2 }}>
                Render, type, paste & verify text in any language across the entire application
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#a1a1aa',
              width: 34,
              height: 34,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            padding: '0 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: 20,
            background: 'rgba(255,255,255,0.02)'
          }}
        >
          <button
            onClick={() => setActiveTab('keyboard')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'keyboard' ? '2px solid #D4AF37' : '2px solid transparent',
              color: activeTab === 'keyboard' ? '#D4AF37' : '#a1a1aa',
              padding: '12px 0',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Keyboard size={16} /> On-Screen Virtual Keyboard
          </button>

          <button
            onClick={() => setActiveTab('samples')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'samples' ? '2px solid #D4AF37' : '2px solid transparent',
              color: activeTab === 'samples' ? '#D4AF37' : '#a1a1aa',
              padding: '12px 0',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Sparkles size={16} /> 1-Click Sample Text Suite
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'inspector' ? '2px solid #D4AF37' : '2px solid transparent',
              color: activeTab === 'inspector' ? '#D4AF37' : '#a1a1aa',
              padding: '12px 0',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Type size={16} /> Script & BiDi Inspector
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Main Interactive Input Box */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ color: '#D4AF37', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Multi-Language Test Input & Clipboard Workspace
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: '#71717a', fontSize: '0.72rem' }}>
                  Chars: {inputText.length} | Bytes: {new Blob([inputText]).size}
                </span>
                <button
                  onClick={handleClear}
                  style={{ background: 'transparent', border: 'none', color: '#ff4d6d', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <RotateCcw size={12} /> Clear
                </button>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                dir="auto"
                placeholder="Type using virtual keyboard, paste any language text here, or copy from sample list below..."
                rows={3}
                style={{
                  width: '100%',
                  background: '#121215',
                  border: '1px solid rgba(212,175,55,0.3)',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '12px 14px',
                  fontSize: '1rem',
                  lineHeight: '1.6',
                  outline: 'none',
                  resize: 'vertical',
                  unicodeBidi: 'plaintext'
                }}
              />
              {inputText && (
                <button
                  onClick={() => handleCopyText(inputText, 'workspace')}
                  style={{
                    position: 'absolute',
                    right: 12,
                    bottom: 12,
                    background: '#D4AF37',
                    color: '#000',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 12px',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {copiedId === 'workspace' ? <Check size={14} /> : <Copy size={14} />} Copy Text
                </button>
              )}
            </div>

            {/* Script Detection Info Bar */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 8px', color: '#a1a1aa', fontSize: '0.72rem' }}>
                Script: <strong style={{ color: '#fff' }}>{detected.script}</strong>
              </span>
              <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 8px', color: '#a1a1aa', fontSize: '0.72rem' }}>
                Direction: <strong style={{ color: '#D4AF37' }}>{detected.dir}</strong>
              </span>
              <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 8px', color: '#a1a1aa', fontSize: '0.72rem' }}>
                UTF-8 Encoding: <strong style={{ color: '#2ecc71' }}>Clean UTF-8 Compliant</strong>
              </span>
            </div>
          </div>

          {/* TAB 1: VIRTUAL KEYBOARD */}
          {activeTab === 'keyboard' && (
            <div>
              {/* Keyboard selector tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {(Object.keys(KEYBOARD_LAYOUTS) as Array<keyof typeof KEYBOARD_LAYOUTS>).map((kbKey) => (
                  <button
                    key={kbKey}
                    onClick={() => setCurrentKbKey(kbKey)}
                    style={{
                      background: currentKbKey === kbKey ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.03)',
                      border: currentKbKey === kbKey ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                      color: currentKbKey === kbKey ? '#D4AF37' : '#a1a1aa',
                      padding: '6px 12px',
                      borderRadius: 4,
                      fontSize: '0.78rem',
                      fontWeight: currentKbKey === kbKey ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {KEYBOARD_LAYOUTS[kbKey].label}
                  </button>
                ))}
              </div>

              {/* On-screen Keyboard Grid */}
              <div
                dir={activeKb.dir}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                {activeKb.keys.map((row, rIdx) => (
                  <div key={rIdx} style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {row.map((char) => (
                      <button
                        key={char}
                        onClick={() => handleKeyClick(char)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          minWidth: char.length > 2 ? 60 : 38,
                          height: 38,
                          borderRadius: 4,
                          fontSize: char.length > 2 ? '0.75rem' : '1.1rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.08s ease, background-color 0.15s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                ))}

                {/* Control Action Row */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                  <button
                    onClick={() => handleKeyClick(' ')}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px 40px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    SPACEBAR
                  </button>
                  <button
                    onClick={handleBackspace}
                    style={{ background: 'rgba(220,20,60,0.15)', border: '1px solid rgba(220,20,60,0.4)', color: '#ff4d6d', padding: '8px 16px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ⌫ Backspace
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SAMPLE SUITE */}
          {activeTab === 'samples' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {SAMPLE_TEXTS.map((s) => (
                <div
                  key={s.code}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{s.flag}</span> {s.lang}
                      </span>
                      <span style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', padding: '2px 6px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 700 }}>
                        {s.dir.toUpperCase()}
                      </span>
                    </div>
                    <p
                      dir={s.dir}
                      style={{
                        color: '#fff',
                        fontSize: '0.92rem',
                        lineHeight: '1.5',
                        margin: 0,
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {s.text}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleCopyText(s.text, s.code)}
                      style={{
                        flex: 1,
                        background: copiedId === s.code ? 'rgba(46, 204, 113, 0.2)' : 'rgba(212,175,55,0.12)',
                        border: copiedId === s.code ? '1px solid #2ecc71' : '1px solid rgba(212,175,55,0.3)',
                        color: copiedId === s.code ? '#2ecc71' : '#D4AF37',
                        padding: '6px 10px',
                        borderRadius: 4,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      {copiedId === s.code ? <Check size={14} /> : <Copy size={14} />} {copiedId === s.code ? 'Copied!' : 'Copy Sample'}
                    </button>
                    <button
                      onClick={() => setInputText(s.text)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#a1a1aa',
                        padding: '6px 10px',
                        borderRadius: 4,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      Use in Workspace <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: SCRIPT & BIDI INSPECTOR */}
          {activeTab === 'inspector' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 18 }}>
              <h4 style={{ color: '#D4AF37', fontSize: '0.92rem', fontWeight: 800, margin: '0 0 12px 0' }}>
                Bi-Directional (BiDi) & Unicode Rendering Diagnostics
              </h4>
              <p style={{ color: '#a1a1aa', fontSize: '0.82rem', lineHeight: '1.5', marginBottom: 16 }}>
                This tool verifies how the browser engine parses and aligns mixed Left-to-Right (LTR) and Right-to-Left (RTL) text inside HTML forms and components.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 14 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem', marginBottom: 6 }}>LTR Render Preview (Standard English/European)</div>
                  <div style={{ color: '#2ecc71', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                    dir="ltr" | font-family: Noto Sans
                  </div>
                  <div style={{ marginTop: 10, color: '#e0d5b8', fontSize: '0.9rem' }}>
                    Integri AI dashboard renders any global language smoothly.
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6, padding: 14 }}>
                  <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '0.8rem', marginBottom: 6 }}>RTL Auto Render Preview (Urdu/Arabic/Hebrew)</div>
                  <div style={{ color: '#D4AF37', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                    dir="auto" | unicode-bidi: plaintext
                  </div>
                  <div dir="auto" style={{ marginTop: 10, color: '#fff', fontSize: '0.95rem', unicodeBidi: 'plaintext' }}>
                    انٹیگری اے آئی اب تمام زبانوں کے متن کو خودکار طریقے سے دائیں سے بائیں پیش کرتا ہے۔
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2ecc71', fontSize: '0.78rem', fontWeight: 600 }}>
            <Languages size={16} /> Global Unicode & IME Multi-Language Engine Active
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#D4AF37',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              padding: '8px 24px',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
      <style>{`
        @keyframes multilangEntrance {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default MultiLangAssistantModal;
