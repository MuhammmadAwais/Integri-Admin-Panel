import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ModelsService, CustomGptService, type CustomGpt } from 'api/backendApi';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import {
  Cpu, Info, Layers, Zap, Globe, Box, Terminal, Activity,
  Bot, Eye, EyeOff, CheckCircle, XCircle, RefreshCw, Hash,
  Check, X, AlertTriangle, Loader2, Sparkles, Users, Calendar,
  BookOpen, ChevronRight, ToggleRight, Plus, Trash2,
  ChevronDown, Search, Wand2, Save
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { gsap } from 'gsap';
import ElitePortal from 'components/EliteUI/ElitePortal';
import { showToast } from 'components/EliteUI/EliteToastContainer';

// ─── Provider map (model → provider) derived from the AVAILABLE_MODELS constant ──
// Keep this co-located so it's easy to update when models change.
const MODEL_PROVIDER_MAP: Record<string, string> = {
  // Integri
  integri: 'openai',
  // OpenAI
  'gpt-5.2': 'openai', 'gpt-5.4': 'openai', 'gpt-5.4-mini': 'openai',
  'gpt-5.4-nano': 'openai', 'gpt-5.1': 'openai', 'gpt-5-nano': 'openai',
  'gpt-4o-mini': 'openai', 'gpt-4o-mini-search-preview': 'openai',
  'gpt-4o-mini-deep-research': 'openai', 'gpt-4.1-nano': 'openai',
  // Gemini
  'gemini-2.5-flash': 'gemini', 'gemini-2.5-flash-lite': 'gemini',
  'gemini-3-flash-preview': 'gemini',
  // Grok
  'grok-3-mini': 'grok', 'grok-4-1-fast-reasoning': 'grok',
  'grok-4-1-fast-non-reasoning': 'grok', 'grok-4-fast-reasoning': 'grok',
  'grok-4-fast-non-reasoning': 'grok',
  // Claude
  'claude-haiku-3': 'claude', 'claude-haiku-4.5': 'claude',
  // DeepSeek
  'deepseek-reasoner': 'deepseek', 'deepseek-chat': 'deepseek',
  // Perplexity
  'perplexity-sonar': 'perplexity', 'sonar-reasoning': 'perplexity',
  // Mistral
  'mistral-medium-2505': 'mistral',
  // GLM
  'glm-4.6': 'glm', 'glm-4.7': 'glm',
};

const deriveProvider = (modelId: string): string => {
  if (MODEL_PROVIDER_MAP[modelId]) return MODEL_PROVIDER_MAP[modelId];
  const lower = modelId.toLowerCase();
  if (lower.startsWith('gpt') || lower.startsWith('o3')) return 'openai';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('grok')) return 'grok';
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('deepseek')) return 'deepseek';
  if (lower.includes('sonar') || lower.includes('perplexity')) return 'perplexity';
  if (lower.includes('mistral')) return 'mistral';
  if (lower.includes('glm')) return 'glm';
  return 'openai';
};

// ─── Provider Logo ──────────────────────────────────────────────────────────

const ModelLogo = ({ groupName, isDark }: { groupName: string; isDark: boolean }) => {
  const [imgError, setImgError] = useState(false);

  let imgPath = '';
  if (groupName === 'OpenAI (GPT & o-series)') {
    imgPath = isDark ? '/dark-theme-openai.png' : '/light-theme-openai.png';
  } else if (groupName === 'Anthropic (Claude)') {
    imgPath = '/claude.png';
  } else if (groupName === 'Google (Gemini)') {
    imgPath = '/gemini.png';
  } else if (groupName === 'xAI (Grok)') {
    imgPath = isDark ? '/dark-theme-grok.png' : '/light-theme-grok.png';
  } else if (groupName === 'DeepSeek') {
    imgPath = '/deepseek.png';
  } else if (groupName === 'Mistral') {
    imgPath = '/mistral.png';
  } else if (groupName === 'Perplexity (Sonar)') {
    imgPath = '/perplexity.png';
  } else if (groupName === 'Integri Core') {
    imgPath = isDark ? '/dark-theme-logo.png' : '/light-theme-logo.png';
  }

  if (imgError || !imgPath) {
    return <Cpu size={28} color={isDark ? '#D4AF37' : '#000'} style={{ opacity: 0.8 }} className="flex-shrink-0" />;
  }

  return (
    <img
      src={imgPath}
      alt={groupName}
      onError={() => setImgError(true)}
      style={{ width: '28px', height: '28px', objectFit: 'contain' }}
      className="flex-shrink-0"
    />
  );
};

// ─── Auto-growing textarea ───────────────────────────────────────────────────

interface AutoTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  minRows?: number;
  maxRows?: number;
  isDark: boolean;
  gold: string;
  textPrimary: string;
  id?: string;
  disabled?: boolean;
}

const AutoTextarea: React.FC<AutoTextareaProps> = ({
  value, onChange, placeholder, minRows = 2, maxRows = 8, isDark, gold, textPrimary, id, disabled
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineH = 22;
    const minH = minRows * lineH + 20;
    const maxH = maxRows * lineH + 20;
    el.style.height = Math.min(maxH, Math.max(minH, el.scrollHeight)) + 'px';
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  }, [value, minRows, maxRows]);

  return (
    <textarea
      id={id}
      ref={ref}
      disabled={disabled}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        // Allow Shift+Enter for newlines; plain Enter does nothing special
        if (e.key === 'Enter' && !e.shiftKey) {
          // default textarea behaviour — just let it add a newline
        }
      }}
      placeholder={placeholder}
      style={{
        width: '100%',
        resize: 'none',
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'}`,
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '0.875rem',
        color: textPrimary,
        outline: 'none',
        lineHeight: '1.55',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        scrollbarWidth: 'thin',
        scrollbarColor: `${gold}60 transparent`,
        opacity: disabled ? 0.5 : 1,
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = gold;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${gold}20`;
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
};

// ─── Model Picker Dropdown ───────────────────────────────────────────────────

interface ModelPickerProps {
  models: string[];
  value: string;
  onChange: (model: string) => void;
  isDark: boolean;
  gold: string;
  textPrimary: string;
  textMuted: string;
  disabled?: boolean;
}

const ModelPicker: React.FC<ModelPickerProps> = ({
  models, value, onChange, isDark, gold, textPrimary, textMuted, disabled
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      gsap.fromTo(
        listRef.current,
        { opacity: 0, y: -8, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out' }
      );
    }
  }, [open]);

  const filtered = models.filter(m => m.toLowerCase().includes(search.toLowerCase()));
  const provider = value ? deriveProvider(value) : null;

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(o => !o); setSearch(''); } }}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${open ? gold : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)')}`,
          boxShadow: open ? `0 0 0 3px ${gold}20` : 'none',
          borderRadius: '10px',
          padding: '10px 14px',
          color: value ? textPrimary : textMuted,
          fontSize: '0.875rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {value || 'Pick a model…'}
          {provider && (
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 4,
              background: `${gold}18`, color: gold, border: `1px solid ${gold}35`,
              textTransform: 'uppercase', letterSpacing: '0.5px'
            }}>{provider}</span>
          )}
        </span>
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1000,
            background: isDark ? '#111116' : '#fff',
            border: `1px solid ${isDark ? 'rgba(212,175,55,0.25)' : 'rgba(212,175,55,0.4)'}`,
            borderRadius: '12px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{
            padding: '10px 12px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Search size={14} color={textMuted} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models…"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: textPrimary, fontSize: '0.85rem', flex: 1,
              }}
            />
          </div>
          {/* List */}
          <div style={{
            maxHeight: '240px', overflowY: 'auto',
            scrollbarWidth: 'thin', scrollbarColor: `${gold}60 transparent`,
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: textMuted, fontSize: '0.82rem' }}>
                No models match "{search}"
              </div>
            ) : filtered.map(m => {
              const prov = deriveProvider(m);
              const isSelected = m === value;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { onChange(m); setOpen(false); setSearch(''); }}
                  style={{
                    width: '100%', textAlign: 'left', background: isSelected
                      ? (isDark ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.08)')
                      : 'transparent',
                    border: 'none', padding: '9px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'background 0.15s',
                    color: isSelected ? gold : textPrimary,
                    fontSize: '0.85rem',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{m}</span>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                    background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                    color: textMuted, textTransform: 'uppercase'
                  }}>{prov}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Create Agent Modal ──────────────────────────────────────────────────────

interface CreateAgentModalProps {
  isDark: boolean;
  models: string[];
  onClose: () => void;
  onCreated: () => void;
}

interface AgentFormData {
  name: string;
  description: string;
  instructions: string;
  starters: string[];  // conversation starters
  model: string;
  isPublic: boolean;
}

type FormStep = 'details' | 'confirm';

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ isDark, models, onClose, onCreated }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gold = '#D4AF37';
  const textPrimary = isDark ? '#f4f4f5' : '#111827';
  const textMuted = isDark ? '#71717a' : '#9ca3af';

  const [step, setStep] = useState<FormStep>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<AgentFormData>({
    name: '',
    description: '',
    instructions: '',
    starters: [''],
    model: models[0] ?? '',
    isPublic: true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AgentFormData, string>>>({});

  // Mount animation
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const tl = gsap.timeline();
    tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power2.out' });
    tl.fromTo(
      panelRef.current,
      { x: '100%', opacity: 0 },
      { x: '0%', opacity: 1, duration: 0.42, ease: 'power3.out' },
      '-=0.15'
    );
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const handleClose = useCallback((animated = true) => {
    if (isSubmitting) return;
    if (!animated) { onClose(); return; }
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(panelRef.current, { x: '100%', opacity: 0, duration: 0.32, ease: 'power3.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.2 }, '-=0.15');
  }, [onClose, isSubmitting]);

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'A name is required';
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!form.instructions.trim()) errs.instructions = 'Instructions are required';
    else if (form.instructions.trim().length < 10) errs.instructions = 'Instructions should be more descriptive';
    if (!form.model) errs.model = 'Please pick a model';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validate()) setStep('confirm');
  };

  const handleBack = () => setStep('details');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const cleanStarters = form.starters.map(s => s.trim()).filter(Boolean);
      await CustomGptService.createAgent({
        name: form.name.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        conversation_starters: cleanStarters.length ? cleanStarters : undefined,
        recommended_model: form.model,
        recommended_provider: deriveProvider(form.model),
        is_public: form.isPublic,
      });
      showToast(`"${form.name.trim()}" agent created!`, 'success');
      onCreated();
      handleClose(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to create agent';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setField = <K extends keyof AgentFormData>(k: K, v: AgentFormData[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  const addStarter = () => setForm(f => ({ ...f, starters: [...f.starters, ''] }));
  const removeStarter = (i: number) =>
    setForm(f => ({ ...f, starters: f.starters.filter((_, idx) => idx !== i) }));
  const updateStarter = (i: number, v: string) =>
    setForm(f => ({ ...f, starters: f.starters.map((s, idx) => idx === i ? v : s) }));

  const provider = form.model ? deriveProvider(form.model) : '—';
  const cleanStarters = form.starters.map(s => s.trim()).filter(Boolean);

  return (
    <ElitePortal>
      <div
        ref={overlayRef}
        onClick={() => handleClose(true)}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          zIndex: 9998, display: 'flex', justifyContent: 'flex-end',
        }}
      >
        <div
          ref={panelRef}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '560px',
            height: '100vh',
            background: isDark ? '#0d0d11' : '#f8f8fb',
            borderLeft: `1px solid ${isDark ? 'rgba(212,175,55,0.22)' : 'rgba(212,175,55,0.4)'}`,
            boxShadow: '-24px 0 64px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '22px 24px 18px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(212,175,55,0.04)' : 'rgba(212,175,55,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '10px',
                background: 'linear-gradient(135deg, #D4AF37 0%, #a8832a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(212,175,55,0.35)',
              }}>
                <Wand2 size={20} color="#000" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: gold }}>
                  New Agent
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: textMuted }}>
                  {step === 'details' ? 'Fill in the details below' : 'Review before creating'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleClose(true)}
              disabled={isSubmitting}
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                border: 'none', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                color: textMuted, padding: '6px', display: 'flex', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = textPrimary; }}
              onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = textMuted; }}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Step indicator ── */}
          <div style={{
            padding: '12px 24px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0,
          }}>
            {(['details', 'confirm'] as FormStep[]).map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: step === s ? gold : (i < (['details', 'confirm'] as FormStep[]).indexOf(step) ? gold : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 700,
                    color: step === s ? '#000' : (isDark ? textMuted : '#999'),
                    transition: 'all 0.25s',
                  }}>
                    {i < (['details', 'confirm'] as FormStep[]).indexOf(step) ? <Check size={12} color="#000" /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: '0.78rem', fontWeight: 600,
                    color: step === s ? gold : textMuted,
                    textTransform: 'capitalize',
                  }}>{s}</span>
                </div>
                {i < 1 && (
                  <div style={{
                    flex: 1, height: '1px',
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ── Scrollable body ── */}
          <div style={{
            flex: 1, overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: `${gold}50 transparent`,
            padding: '24px',
          }}>
            {step === 'details' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Name */}
                <FieldBlock label="Agent Name" required error={errors.name} isDark={isDark} gold={gold} textMuted={textMuted}>
                  <input
                    id="agent-name"
                    type="text"
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    placeholder="e.g. Research Assistant"
                    maxLength={80}
                    style={{
                      width: '100%',
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${errors.name ? '#ef4444' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)')}`,
                      borderRadius: '10px', padding: '10px 14px',
                      fontSize: '0.875rem', color: textPrimary,
                      outline: 'none', fontFamily: 'inherit',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = gold; e.currentTarget.style.boxShadow = `0 0 0 3px ${gold}20`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.name ? '#ef4444' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'); e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.72rem', color: textMuted, marginTop: '4px' }}>{form.name.length}/80</div>
                </FieldBlock>

                {/* Description */}
                <FieldBlock label="Description" error={errors.description} isDark={isDark} gold={gold} textMuted={textMuted}
                  hint="Optional — a brief summary of what this agent does">
                  <AutoTextarea
                    id="agent-description"
                    value={form.description}
                    onChange={v => setField('description', v)}
                    placeholder="This agent helps with market research and summarises trends…"
                    minRows={2} maxRows={5}
                    isDark={isDark} gold={gold} textPrimary={textPrimary}
                  />
                </FieldBlock>

                {/* Instructions */}
                <FieldBlock label="Instructions" required error={errors.instructions} isDark={isDark} gold={gold} textMuted={textMuted}
                  hint="Tell the agent exactly how to behave. Shift+Enter for new line.">
                  <AutoTextarea
                    id="agent-instructions"
                    value={form.instructions}
                    onChange={v => setField('instructions', v)}
                    placeholder={"You are an expert research assistant. Always cite sources when possible. Respond concisely and accurately.\n\nWhen asked for analysis, structure your response with clear sections…"}
                    minRows={4} maxRows={10}
                    isDark={isDark} gold={gold} textPrimary={textPrimary}
                  />
                </FieldBlock>

                {/* Model */}
                <FieldBlock label="Model" required error={errors.model} isDark={isDark} gold={gold} textMuted={textMuted}
                  hint="The AI model this agent runs on. Provider is derived automatically.">
                  <ModelPicker
                    models={models}
                    value={form.model}
                    onChange={v => setField('model', v)}
                    isDark={isDark} gold={gold} textPrimary={textPrimary} textMuted={textMuted}
                  />
                </FieldBlock>

                {/* Publicity */}
                <FieldBlock label="Visibility" isDark={isDark} gold={gold} textMuted={textMuted}
                  hint="Public agents are visible to all users on the platform.">
                  <div 
                    onClick={() => setField('isPublic', !form.isPublic)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${form.isPublic ? gold : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)')}`,
                      borderRadius: '10px', padding: '10px 14px',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', color: textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {form.isPublic ? <Eye size={16} color={gold} /> : <EyeOff size={16} color={textMuted} />}
                      {form.isPublic ? 'Public (Visible to everyone)' : 'Private (Admin only)'}
                    </span>
                    <div style={{
                      width: '36px', height: '20px', borderRadius: '10px',
                      background: form.isPublic ? gold : (isDark ? '#3f3f46' : '#d1d5db'),
                      position: 'relative', transition: 'background 0.2s'
                    }}>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: '2px', left: form.isPublic ? '18px' : '2px',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                  </div>
                </FieldBlock>

                {/* Conversation starters */}
                <FieldBlock label="Conversation Starters" isDark={isDark} gold={gold} textMuted={textMuted}
                  hint="Suggested prompts users see when they open this agent (leave blank to auto-generate)">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.starters.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={s}
                          onChange={e => updateStarter(i, e.target.value)}
                          placeholder={`Starter ${i + 1}…`}
                          maxLength={120}
                          style={{
                            flex: 1,
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
                            borderRadius: '8px', padding: '8px 12px',
                            fontSize: '0.84rem', color: textPrimary,
                            outline: 'none', fontFamily: 'inherit',
                          }}
                          onFocus={e => { e.currentTarget.style.borderColor = gold; e.currentTarget.style.boxShadow = `0 0 0 3px ${gold}18`; }}
                          onBlur={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => removeStarter(i)}
                          disabled={form.starters.length === 1}
                          style={{
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '7px', padding: '7px', cursor: form.starters.length === 1 ? 'not-allowed' : 'pointer',
                            color: '#ef4444', display: 'flex', transition: 'all 0.15s',
                            opacity: form.starters.length === 1 ? 0.35 : 1,
                          }}
                          onMouseEnter={e => { if (form.starters.length > 1) e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {form.starters.length < 6 && (
                      <button
                        type="button"
                        onClick={addStarter}
                        style={{
                          background: 'transparent',
                          border: `1px dashed ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.5)'}`,
                          borderRadius: '8px', padding: '7px 12px',
                          color: gold, fontSize: '0.8rem', fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                          transition: 'all 0.18s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.07)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Plus size={13} /> Add another starter
                      </button>
                    )}
                  </div>
                </FieldBlock>
              </div>
            ) : (
              /* ── Confirm step ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
                  borderRadius: '10px', padding: '14px 16px',
                  display: 'flex', gap: '10px', alignItems: 'flex-start'
                }}>
                  <Sparkles size={16} color={gold} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ margin: 0, fontSize: '0.875rem', color: isDark ? '#e4e4e7' : '#374151', lineHeight: 1.5 }}>
                    Review your agent's configuration. Once created you can update it anytime.
                  </p>
                </div>

                {[
                  { label: 'Name', value: form.name },
                  { label: 'Description', value: form.description || '(none)' },
                  { label: 'Model', value: form.model },
                  { label: 'Provider', value: provider },
                  { label: 'Visibility', value: form.isPublic ? 'Public' : 'Private' },
                ].map(row => (
                  <ConfirmRow key={row.label} label={row.label} value={row.value} isDark={isDark} gold={gold} textPrimary={textPrimary} textMuted={textMuted} />
                ))}

                {/* Instructions preview */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Instructions
                  </div>
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: '9px', padding: '12px',
                    fontSize: '0.82rem', color: isDark ? '#d4d4d8' : '#374151',
                    lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: '160px', overflowY: 'auto',
                    scrollbarWidth: 'thin', scrollbarColor: `${gold}60 transparent`,
                  }}>
                    {form.instructions.trim()}
                  </div>
                </div>

                {/* Starters */}
                {cleanStarters.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      Conversation Starters ({cleanStarters.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {cleanStarters.map((s, i) => (
                        <div key={i} style={{
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                          borderRadius: '7px', padding: '7px 12px',
                          fontSize: '0.82rem', color: isDark ? '#a1a1aa' : '#6b7280',
                          fontStyle: 'italic',
                        }}>
                          "{s}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
            background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.8)',
            display: 'flex', gap: '12px', justifyContent: 'flex-end', flexShrink: 0,
          }}>
            {step === 'details' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleClose(true)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}`,
                    borderRadius: '9px', padding: '10px 22px',
                    color: textMuted, fontSize: '0.875rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    background: `linear-gradient(135deg, ${gold} 0%, #a8832a 100%)`,
                    border: 'none', borderRadius: '9px', padding: '10px 26px',
                    color: '#000', fontSize: '0.875rem', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
                    boxShadow: `0 4px 16px rgba(212,175,55,0.35)`,
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 22px rgba(212,175,55,0.55)`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 4px 16px rgba(212,175,55,0.35)`; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  Review <ChevronRight size={15} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}`,
                    borderRadius: '9px', padding: '10px 22px',
                    color: textMuted, fontSize: '0.875rem', fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer', transition: 'all 0.18s',
                  }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    background: isSubmitting
                      ? 'rgba(212,175,55,0.35)'
                      : `linear-gradient(135deg, ${gold} 0%, #a8832a 100%)`,
                    border: 'none', borderRadius: '9px', padding: '10px 26px',
                    color: '#000', fontSize: '0.875rem', fontWeight: 800,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: isSubmitting ? 'none' : `0 4px 16px rgba(212,175,55,0.35)`,
                    transition: 'all 0.18s',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting
                    ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</>
                    : <><CheckCircle size={15} /> Create Agent</>
                  }
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </ElitePortal>
  );
};

// ─── Confirm row helper ──────────────────────────────────────────────────────

const ConfirmRow = ({ label, value, isDark, gold, textPrimary, textMuted }: {
  label: string; value: string; isDark: boolean; gold: string; textPrimary: string; textMuted: string;
}) => (
  <div style={{
    display: 'flex', alignItems: 'baseline', gap: '10px',
    padding: '9px 14px',
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    borderRadius: '8px',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
  }}>
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, minWidth: '90px' }}>{label}</span>
    <span style={{ fontSize: '0.875rem', color: textPrimary, fontWeight: 600, wordBreak: 'break-word' }}>{value}</span>
  </div>
);

// ─── Field block helper ──────────────────────────────────────────────────────

const FieldBlock: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  isDark: boolean;
  gold: string;
  textMuted: string;
  children: React.ReactNode;
}> = ({ label, required, error, hint, isDark, gold, textMuted, children }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '7px' }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: isDark ? '#e4e4e7' : '#374151' }}>
        {label}
      </label>
      {required && <span style={{ color: '#ef4444', fontSize: '0.8rem', lineHeight: 1 }}>*</span>}
    </div>
    {hint && !error && (
      <p style={{ margin: '0 0 7px', fontSize: '0.74rem', color: textMuted, lineHeight: 1.45 }}>{hint}</p>
    )}
    {children}
    {error && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
        <AlertTriangle size={12} color="#ef4444" />
        <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>{error}</span>
      </div>
    )}
  </div>
);

// ─── GPT Detail & Management Slide-Over ─────────────────────────────────────

interface GptDetailModalProps {
  gptId: string;
  isDark: boolean;
  models: string[];
  onClose: () => void;
  onUpdated: () => void;
}

const GptDetailModal: React.FC<GptDetailModalProps> = ({ gptId, isDark, models, onClose, onUpdated }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gold = '#D4AF37';
  const textPrimary = isDark ? '#f4f4f5' : '#111827';
  const textMuted = isDark ? '#71717a' : '#9ca3af';

  const [details, setDetails] = useState<CustomGpt | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    instructions: '',
    starters: [''],
    model: '',
  });

  // Mount animation
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const tl = gsap.timeline();
    tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    tl.fromTo(
      panelRef.current,
      { x: '100%', opacity: 0 },
      { x: '0%', opacity: 1, duration: 0.38, ease: 'power3.out' },
      '-=0.12'
    );
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // Fetch Details
  useEffect(() => {
    const fetchDetails = async () => {
      setLoadingDetails(true);
      try {
        const data = await CustomGptService.getGptDetails(gptId);
        setDetails(data);
        setEditForm({
          name: data.name || '',
          description: data.description || '',
          instructions: data.instructions || '',
          starters: data.conversation_starters && data.conversation_starters.length ? [...data.conversation_starters] : [''],
          model: data.recommended_model || models[0] || '',
        });
      } catch (err) {
        showToast('Failed to load GPT details', 'error');
        handleClose(false);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [gptId]);

  const handleClose = useCallback((animated = true) => {
    if (isSaving || isDeleting) return;
    if (!animated) { onClose(); return; }
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(panelRef.current, { x: '100%', opacity: 0, duration: 0.28, ease: 'power3.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.18 }, '-=0.1');
  }, [onClose, isSaving, isDeleting]);

  const handleTogglePublicity = async () => {
    if (!details) return;
    setIsSaving(true);
    const targetState = !details.is_public;
    try {
      const updated = await CustomGptService.toggleGptPublicity(gptId, targetState);
      setDetails(updated);
      showToast(`"${details.name}" is now ${targetState ? 'public' : 'private'}`, 'success');
      onUpdated();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update visibility', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    if (!editForm.instructions.trim()) {
      showToast('Instructions are required', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const cleanStarters = editForm.starters.map(s => s.trim()).filter(Boolean);
      const updated = await CustomGptService.updateGpt(gptId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        instructions: editForm.instructions.trim(),
        conversation_starters: cleanStarters,
        recommended_model: editForm.model,
        recommended_provider: deriveProvider(editForm.model),
      });
      setDetails(updated);
      setIsEditing(false);
      showToast(`Agent "${updated.name}" updated successfully`, 'success');
      onUpdated();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update agent', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await CustomGptService.deleteGpt(gptId);
      showToast('Agent deleted successfully', 'success');
      onUpdated();
      handleClose(true);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to delete agent', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const updateStarter = (i: number, v: string) => {
    setEditForm(f => ({ ...f, starters: f.starters.map((s, idx) => idx === i ? v : s) }));
  };
  const addStarter = () => setEditForm(f => ({ ...f, starters: [...f.starters, ''] }));
  const removeStarter = (i: number) => setEditForm(f => ({ ...f, starters: f.starters.filter((_, idx) => idx !== i) }));

  return (
    <ElitePortal>
      <div
        ref={overlayRef}
        onClick={() => handleClose(true)}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          zIndex: 9998, display: 'flex', justifyContent: 'flex-end',
        }}
      >
        <div
          ref={panelRef}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '560px',
            height: '100vh',
            background: isDark ? '#0d0d11' : '#f8f8fb',
            borderLeft: `1px solid ${isDark ? 'rgba(212,175,55,0.22)' : 'rgba(212,175,55,0.4)'}`,
            boxShadow: '-24px 0 64px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '22px 24px 18px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(212,175,55,0.04)' : 'rgba(212,175,55,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '10px',
                background: 'linear-gradient(135deg, #D4AF37 0%, #a8832a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(212,175,55,0.35)', flexShrink: 0
              }}>
                <Bot size={20} color="#000" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: gold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {loadingDetails ? 'Agent Settings' : details?.name}
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: textMuted }}>
                  {isEditing ? 'Modify agent configurations' : 'Detailed configuration settings'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleClose(true)}
              disabled={isSaving || isDeleting}
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                border: 'none', borderRadius: '8px', cursor: (isSaving || isDeleting) ? 'not-allowed' : 'pointer',
                color: textMuted, padding: '6px', display: 'flex', transition: 'all 0.18s',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative' }}>
            {loadingDetails ? (
              <div className="d-flex flex-column justify-content-center align-items-center" style={{ height: '70%' }}>
                <Loader2 size={36} color={gold} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ marginTop: '12px', color: textMuted, fontSize: '0.875rem' }}>Loading agent specifications…</span>
              </div>
            ) : showDeleteConfirm ? (
              <div className="d-flex flex-column justify-content-center align-items-center text-center" style={{ height: '70%', padding: '20px' }}>
                <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
                <h4 style={{ color: textPrimary, fontWeight: 700, marginBottom: '8px' }}>Are you absolutely sure?</h4>
                <p style={{ color: textMuted, fontSize: '0.875rem', maxWidth: '360px', lineHeight: 1.5, marginBottom: '24px' }}>
                  This will permanently delete the agent <strong>"{details?.name}"</strong>. This action is irreversible.
                </p>
                <div className="d-flex gap-3">
                  <button
                    className="btn"
                    disabled={isDeleting}
                    style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`, color: textMuted }}
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn d-flex align-items-center gap-2"
                    disabled={isDeleting}
                    style={{ background: '#ef4444', color: '#fff' }}
                    onClick={handleDelete}
                  >
                    {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Delete Agent
                  </button>
                </div>
              </div>
            ) : isEditing ? (
              /* Edit Form Mode */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Name */}
                <FieldBlock label="Agent Name" required isDark={isDark} gold={gold} textMuted={textMuted}>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Research Assistant"
                    maxLength={80}
                    style={{
                      width: '100%',
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'}`,
                      borderRadius: '10px', padding: '10px 14px',
                      fontSize: '0.875rem', color: textPrimary,
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </FieldBlock>

                {/* Description */}
                <FieldBlock label="Description" isDark={isDark} gold={gold} textMuted={textMuted}>
                  <AutoTextarea
                    value={editForm.description}
                    onChange={v => setEditForm(prev => ({ ...prev, description: v }))}
                    placeholder="Brief description of the agent's functionality…"
                    minRows={2} maxRows={4}
                    isDark={isDark} gold={gold} textPrimary={textPrimary}
                  />
                </FieldBlock>

                {/* Instructions */}
                <FieldBlock label="Instructions" required isDark={isDark} gold={gold} textMuted={textMuted}>
                  <AutoTextarea
                    value={editForm.instructions}
                    onChange={v => setEditForm(prev => ({ ...prev, instructions: v }))}
                    placeholder="Define the behavior, rules, and logic for this custom agent…"
                    minRows={4} maxRows={8}
                    isDark={isDark} gold={gold} textPrimary={textPrimary}
                  />
                </FieldBlock>

                {/* Model */}
                <FieldBlock label="Recommended Model" required isDark={isDark} gold={gold} textMuted={textMuted}>
                  <ModelPicker
                    models={models || []}
                    value={editForm.model}
                    onChange={v => setEditForm(prev => ({ ...prev, model: v }))}
                    isDark={isDark} gold={gold} textPrimary={textPrimary} textMuted={textMuted}
                  />
                </FieldBlock>

                {/* Conversation Starters */}
                <FieldBlock label="Conversation Starters" isDark={isDark} gold={gold} textMuted={textMuted}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {editForm.starters.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={s}
                          onChange={e => updateStarter(i, e.target.value)}
                          placeholder={`Starter ${i + 1}…`}
                          maxLength={120}
                          style={{
                            flex: 1,
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
                            borderRadius: '8px', padding: '8px 12px',
                            fontSize: '0.84rem', color: textPrimary,
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeStarter(i)}
                          disabled={editForm.starters.length === 1}
                          style={{
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '7px', padding: '7px', cursor: editForm.starters.length === 1 ? 'not-allowed' : 'pointer',
                            color: '#ef4444', display: 'flex', opacity: editForm.starters.length === 1 ? 0.35 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {editForm.starters.length < 6 && (
                      <button
                        type="button"
                        onClick={addStarter}
                        style={{
                          background: 'transparent',
                          border: `1px dashed ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.5)'}`,
                          borderRadius: '8px', padding: '7px 12px',
                          color: gold, fontSize: '0.8rem', fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <Plus size={13} /> Add starter
                      </button>
                    )}
                  </div>
                </FieldBlock>
              </div>
            ) : (
              /* View Details Mode */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {/* Details Section */}
                <div style={{
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: '12px', padding: '16px'
                }}>
                  <ConfirmRow label="Agent Name" value={details?.name || ''} isDark={isDark} gold={gold} textPrimary={textPrimary} textMuted={textMuted} />
                  <div style={{ height: '8px' }} />
                  <ConfirmRow label="Description" value={details?.description || '(none)'} isDark={isDark} gold={gold} textPrimary={textPrimary} textMuted={textMuted} />
                  <div style={{ height: '8px' }} />
                  <ConfirmRow label="Model" value={details?.recommended_model || ''} isDark={isDark} gold={gold} textPrimary={textPrimary} textMuted={textMuted} />
                  <div style={{ height: '8px' }} />
                  <ConfirmRow label="Provider" value={details?.recommended_provider || ''} isDark={isDark} gold={gold} textPrimary={textPrimary} textMuted={textMuted} />
                  <div style={{ height: '8px' }} />
                  <ConfirmRow label="GPT ID" value={details?.gpt_id || ''} isDark={isDark} gold={gold} textPrimary={textPrimary} textMuted={textMuted} />
                  <div style={{ height: '8px' }} />
                  <ConfirmRow label="Publicity" value={details?.is_public ? '● Public (Visible to all users)' : '● Private (Admin only)'} isDark={isDark} gold={gold} textPrimary={details?.is_public ? '#10b981' : '#ef4444'} textMuted={textMuted} />
                </div>

                {/* Instructions Box */}
                <div>
                  <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    System Instructions
                  </h5>
                  <div style={{
                    background: isDark ? '#08080b' : '#f0f0f4',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: '10px', padding: '16px',
                    fontSize: '0.85rem', color: textPrimary, fontFamily: 'monospace',
                    lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto'
                  }}>
                    {details?.instructions}
                  </div>
                </div>

                {/* Starters Box */}
                {details?.conversation_starters && details.conversation_starters.length > 0 && (
                  <div>
                    <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Conversation Starters
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {details.conversation_starters.map((starter, i) => (
                        <div key={i} style={{
                          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                          borderRadius: '8px', padding: '8px 14px',
                          fontSize: '0.82rem', color: isDark ? '#a1a1aa' : '#4b5563', fontStyle: 'italic'
                        }}>
                          "{starter}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Document Database stats */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                  background: isDark ? 'rgba(212,175,55,0.03)' : 'rgba(212,175,55,0.05)',
                  border: `1px solid ${isDark ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.3)'}`,
                  borderRadius: '10px', padding: '12px 16px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: textMuted, fontWeight: 600, textTransform: 'uppercase' }}>Documents Indexed</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: gold }}>{details?.document_count}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: textMuted, fontWeight: 600, textTransform: 'uppercase' }}>Total Text Chunks</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: gold }}>{details?.total_chunks}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!loadingDetails && !showDeleteConfirm && (
            <div style={{
              padding: '16px 24px',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
              background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.8)',
              display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}>
              {isEditing ? (
                <>
                  <button
                    className="btn"
                    disabled={isSaving}
                    style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`, color: textMuted }}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn d-flex align-items-center gap-2"
                    disabled={isSaving}
                    style={{ background: `linear-gradient(135deg, ${gold} 0%, #a8832a 100%)`, color: '#000', fontWeight: 700 }}
                    onClick={handleSave}
                  >
                    {isSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save Configuration
                  </button>
                </>
              ) : (
                <>
                  <div className="d-flex gap-2">
                    <button
                      className="btn"
                      style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                    <button
                      className="btn"
                      style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`, color: textPrimary }}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </button>
                  </div>
                  <button
                    className="btn d-flex align-items-center gap-2"
                    disabled={isSaving}
                    style={{
                      background: details?.is_public ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                      border: `1px solid ${details?.is_public ? '#ef4444' : '#10b981'}`,
                      color: details?.is_public ? '#ef4444' : '#10b981',
                      fontWeight: 700
                    }}
                    onClick={handleTogglePublicity}
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="spin" />
                    ) : details?.is_public ? (
                      <><EyeOff size={14} /> Make Private</>
                    ) : (
                      <><Eye size={14} /> Make Public</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </ElitePortal>
  );
};

// ─── Manual GPT ID Confirmation Modal ────────────────────────────────────────

interface ManualToggleConfirmProps {
  gptId: string;
  isDark: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

const ManualToggleConfirmModal: React.FC<ManualToggleConfirmProps> = ({ gptId, isDark, onClose, onConfirm, isLoading }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const tl = gsap.timeline();
    tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out' });
    tl.fromTo(
      modalRef.current,
      { opacity: 0, scale: 0.9, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)' },
      '-=0.1'
    );
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const handleClose = useCallback(() => {
    if (isLoading) return;
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(modalRef.current, { opacity: 0, scale: 0.9, y: 20, duration: 0.2, ease: 'power2.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.15 }, '-=0.07');
  }, [onClose, isLoading]);

  const gold = '#D4AF37';

  return (
    <ElitePortal>
      <div
        ref={overlayRef}
        onClick={handleClose}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}
      >
        <div
          ref={modalRef}
          onClick={e => e.stopPropagation()}
          style={{
            background: isDark ? 'rgba(10,10,14,0.98)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${isDark ? 'rgba(212,175,55,0.25)' : 'rgba(212,175,55,0.4)'}`,
            borderRadius: '14px', width: '100%', maxWidth: '420px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.4)', overflow: 'hidden'
          }}
        >
          <div style={{
            padding: '18px 22px 14px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Hash size={18} color={gold} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: isDark ? gold : '#b48a04' }}>
                Toggle GPT Publicity
              </h3>
            </div>
            <button
              onClick={handleClose} disabled={isLoading}
              style={{ background: 'transparent', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', color: isDark ? '#71717a' : '#9ca3af', display: 'flex' }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: '22px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '0.9rem', color: isDark ? '#a1a1aa' : '#4b5563', lineHeight: 1.55 }}>
              You're about to toggle the visibility for GPT:
            </p>
            <div style={{
              background: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.1)',
              border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px',
              padding: '10px 14px', fontFamily: 'monospace',
              fontSize: '0.875rem', color: gold, fontWeight: 700,
              wordBreak: 'break-all'
            }}>
              {gptId}
            </div>
            <p style={{ margin: '14px 0 0', fontSize: '0.82rem', color: isDark ? '#6b7280' : '#9ca3af', lineHeight: 1.4 }}>
              This toggles its public visibility. Good to go?
            </p>
          </div>
          <div style={{
            padding: '14px 22px',
            background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
            display: 'flex', gap: '10px', justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleClose} disabled={isLoading}
              style={{
                background: 'transparent', cursor: isLoading ? 'not-allowed' : 'pointer',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                color: isDark ? '#9ca3af' : '#6b7280',
                padding: '8px 18px', borderRadius: '7px', fontSize: '0.855rem', fontWeight: 600
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm} disabled={isLoading}
              style={{
                background: isLoading ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.15)',
                border: `1px solid ${gold}`, color: gold,
                padding: '8px 20px', borderRadius: '7px', fontSize: '0.855rem', fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
                transition: 'all 0.2s', opacity: isLoading ? 0.65 : 1
              }}
              onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background = gold; e.currentTarget.style.color = '#000'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.15)'; e.currentTarget.style.color = gold; }}
            >
              {isLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Toggling…</> : <><ToggleRight size={14} /> Confirm</>}
            </button>
          </div>
        </div>
      </div>
    </ElitePortal>
  );
};

// ─── GPT Card ────────────────────────────────────────────────────────────────

interface GptCardProps {
  gpt: CustomGpt;
  isDark: boolean;
  onClick: (gpt: CustomGpt) => void;
  index: number;
}

const GptCard: React.FC<GptCardProps> = ({ gpt, isDark, onClick, index }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 18, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: 'power2.out', delay: index * 0.055 }
      );
    }
  }, [index]);

  const handleMouseEnter = () => {
    gsap.to(cardRef.current, { y: -4, scale: 1.015, duration: 0.2, ease: 'power2.out' });
  };
  const handleMouseLeave = () => {
    gsap.to(cardRef.current, { y: 0, scale: 1, duration: 0.22, ease: 'power2.inOut' });
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
  };

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(gpt)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
        borderRadius: '14px', padding: '0', overflow: 'hidden',
        cursor: 'pointer', position: 'relative', height: '100%',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)'
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isDark ? 'rgba(212,175,55,0.35)' : 'rgba(212,175,55,0.5)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = isDark ? '0 8px 28px rgba(0,0,0,0.5)' : '0 8px 28px rgba(0,0,0,0.12)';
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)';
      }}
    >
      {/* Top gradient accent */}
      <div style={{
        height: '3px',
        background: gpt.is_public
          ? 'linear-gradient(90deg, #10b981, #34d399)'
          : 'linear-gradient(90deg, #6b7280, #9ca3af)'
      }} />

      <div style={{ padding: '18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #D4AF37 0%, #a8832a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(212,175,55,0.3)'
          }}>
            <Bot size={22} color="#000" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: '0.92rem',
              color: isDark ? '#f4f4f5' : '#111827',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              marginBottom: '3px'
            }} title={gpt.name}>
              {gpt.name}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                background: gpt.is_public ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
                color: gpt.is_public ? '#10b981' : (isDark ? '#9ca3af' : '#6b7280'),
                border: `1px solid ${gpt.is_public ? 'rgba(16,185,129,0.3)' : 'rgba(107,114,128,0.25)'}`,
                textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '3px'
              }}>
                {gpt.is_public ? <Eye size={9} /> : <EyeOff size={9} />}
                {gpt.is_public ? 'Public' : 'Private'}
              </span>
            </div>
          </div>
          {/* Click hint */}
          <div style={{ color: isDark ? '#52525b' : '#d1d5db', display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Description */}
        <p style={{
          margin: '0 0 12px', fontSize: '0.8rem',
          color: isDark ? '#71717a' : '#6b7280',
          lineHeight: 1.45,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          {gpt.description || 'No description provided.'}
        </p>

        {/* Meta grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
          marginBottom: '12px'
        }}>
          {[
            { icon: <Sparkles size={11} />, label: 'Model', val: gpt.recommended_model },
            { icon: <Users size={11} />, label: 'Provider', val: gpt.recommended_provider },
            { icon: <BookOpen size={11} />, label: 'Docs', val: String(gpt.document_count) },
            { icon: <Calendar size={11} />, label: 'Updated', val: formatDate(gpt.updated_at) }
          ].map(({ icon, label, val }) => (
            <div key={label} style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              borderRadius: '7px', padding: '7px 9px'
            }}>
              <div style={{ fontSize: '0.65rem', color: isDark ? '#52525b' : '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                {icon} {label}
              </div>
              <div style={{
                fontSize: '0.78rem', color: isDark ? '#d4d4d8' : '#374151', fontWeight: 600,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }} title={val}>
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* Knowledge base */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          borderRadius: '7px',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`
        }}>
          <span style={{ fontSize: '0.72rem', color: isDark ? '#52525b' : '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            KB Status
          </span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: gpt.knowledge_base_status === 'none' ? (isDark ? '#52525b' : '#9ca3af') : '#D4AF37',
            textTransform: 'uppercase', letterSpacing: '0.4px'
          }}>
            {gpt.knowledge_base_status}
          </span>
        </div>

        {/* Conversation starters preview */}
        {gpt.conversation_starters && gpt.conversation_starters.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '0.65rem', color: isDark ? '#52525b' : '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '5px' }}>
              Starters
            </div>
            <div style={{
              fontSize: '0.75rem', color: isDark ? '#a1a1aa' : '#6b7280',
              fontStyle: 'italic',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }} title={gpt.conversation_starters[0]}>
              "{gpt.conversation_starters[0]}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ModelsPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark);
  const queryClient = useQueryClient();

  // ── AI Models ──
  const { data: models, isLoading: modelsLoading, isError: modelsError } = useQuery({
    queryKey: ['aiModels'],
    queryFn: ModelsService.fetchModels,
  });

  // ── Tab State ──
  const [gptTab, setGptTab] = useState<'all' | 'public' | 'private'>('all');

  // ── All Admin GPTs ──
  const {
    data: allGpts,
    isLoading: allGptsLoading,
    isError: allGptsError,
    refetch: refetchAllGpts
  } = useQuery({
    queryKey: ['allAdminGpts'],
    queryFn: () => CustomGptService.fetchGpts(200),
  });

  // ── Public GPTs ──
  const {
    data: publicGpts,
    isLoading: publicGptsLoading,
    isError: publicGptsError,
    refetch: refetchPublicGpts
  } = useQuery({
    queryKey: ['publicGpts'],
    queryFn: () => CustomGptService.fetchPublicGpts(200),
  });

  const currentGpts = gptTab === 'all' ? allGpts : (gptTab === 'public' ? publicGpts : allGpts?.filter(gpt => !gpt.is_public));
  const currentGptsLoading = gptTab === 'all' || gptTab === 'private' ? allGptsLoading : publicGptsLoading;
  const currentGptsError = gptTab === 'all' || gptTab === 'private' ? allGptsError : publicGptsError;
  const refetchCurrentGpts = gptTab === 'all' || gptTab === 'private' ? refetchAllGpts : refetchPublicGpts;

  // ── Modal state ──
  const [selectedGptId, setSelectedGptId] = useState<string | null>(null);

  // ── Manual GPT ID toggle ──
  const [manualGptId, setManualGptId] = useState('');
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  // ── Create agent panel ──
  const [createOpen, setCreateOpen] = useState(false);

  // Section refs for GSAP
  const gptsHeaderRef = useRef<HTMLDivElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!currentGptsLoading && gptsHeaderRef.current) {
      gsap.fromTo(gptsHeaderRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
    }
  }, [currentGptsLoading]);

  // Pulse the create button on first render
  useEffect(() => {
    if (createBtnRef.current) {
      gsap.fromTo(
        createBtnRef.current,
        { scale: 0.85, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.3 }
      );
    }
  }, []);

  // ── Grouped Models ──
  const groupedModels = useMemo(() => {
    if (!models) return {};

    const groups: Record<string, string[]> = {
      'OpenAI (GPT & o-series)': [],
      'Anthropic (Claude)': [],
      'Google (Gemini)': [],
      'xAI (Grok)': [],
      'DeepSeek': [],
      'Mistral': [],
      'Zhipu (GLM)': [],
      'Perplexity (Sonar)': [],
      'Integri Core': [],
      'Other': []
    };

    models.forEach(model => {
      const lower = model.toLowerCase();
      if (lower.startsWith('gpt') || lower.startsWith('o3')) {
        groups['OpenAI (GPT & o-series)'].push(model);
      } else if (lower.includes('claude')) {
        groups['Anthropic (Claude)'].push(model);
      } else if (lower.includes('gemini')) {
        groups['Google (Gemini)'].push(model);
      } else if (lower.includes('grok')) {
        groups['xAI (Grok)'].push(model);
      } else if (lower.includes('deepseek')) {
        groups['DeepSeek'].push(model);
      } else if (lower.includes('mistral')) {
        groups['Mistral'].push(model);
      } else if (lower.includes('glm')) {
        groups['Zhipu (GLM)'].push(model);
      } else if (lower.includes('sonar')) {
        groups['Perplexity (Sonar)'].push(model);
      } else if (lower === 'integri') {
        groups['Integri Core'].push(model);
      } else {
        groups['Other'].push(model);
      }
    });

    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) delete groups[key];
    });

    return groups;
  }, [models]);

  const getGroupIcon = (groupName: string) => {
    switch (groupName) {
      case 'OpenAI (GPT & o-series)': return <Zap size={18} />;
      case 'Anthropic (Claude)': return <Layers size={18} />;
      case 'Google (Gemini)': return <Globe size={18} />;
      case 'xAI (Grok)': return <Terminal size={18} />;
      case 'DeepSeek': return <Activity size={18} />;
      case 'Integri Core': return <Cpu size={18} />;
      default: return <Box size={18} />;
    }
  };

  // ── Handlers ──

  const handleGptCardClick = (gpt: CustomGpt) => {
    setSelectedGptId(gpt.gpt_id);
  };

  const handleManualToggleConfirm = async () => {
    setManualLoading(true);
    const trimmedId = manualGptId.trim();
    try {
      await CustomGptService.toggleGptPublicity(trimmedId, true);
      showToast(`GPT ${trimmedId} visibility toggled`, 'success');
      queryClient.invalidateQueries({ queryKey: ['publicGpts'] });
      queryClient.invalidateQueries({ queryKey: ['allAdminGpts'] });
      setManualGptId('');
      setManualConfirmOpen(false);
    } catch (err: any) {
      showToast(err?.response?.data?.message || `Failed to toggle GPT ${trimmedId}`, 'error');
      setManualConfirmOpen(false);
    } finally {
      setManualLoading(false);
    }
  };

  // ── Inline Styles / CSS vars ──
  const gold = '#D4AF37';
  const goldDim = isDark ? '#b48a04' : '#b48a04';
  const textPrimary = isDark ? '#f4f4f5' : '#111827';
  const textMuted = isDark ? '#71717a' : '#9ca3af';
  const surfaceBg = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';

  return (
    <div className="position-relative" style={{ minHeight: '80vh', paddingBottom: '60px' }}>
      {/* ── Global Styles ── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .model-card-item {
          background: ${surfaceBg};
          backdrop-filter: blur(10px);
          border: 1px solid ${surfaceBorder};
          border-radius: 8px;
          transition: all 0.22s ease;
          cursor: default;
        }
        .model-card-item:hover {
          background: ${isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)'};
          border-color: ${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)'};
          transform: translateY(-2px);
          box-shadow: 0 6px 22px rgba(0,0,0,0.18);
        }

        .models-header-card {
          background: ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.65)'};
          backdrop-filter: blur(10px);
          border: 1px solid ${isDark ? 'rgba(212,175,55,0.28)' : 'rgba(212,175,55,0.55)'};
          border-radius: 6px;
        }

        .gpts-section-divider {
          border: none;
          height: 1px;
          background: ${isDark ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.3)'};
          margin: 0;
        }

        .manual-input-row input {
          background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'};
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'};
          color: ${textPrimary};
          border-radius: 8px 0 0 8px;
          padding: 9px 14px;
          font-size: 0.875rem;
          outline: none;
          flex: 1;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: monospace;
        }
        .manual-input-row input:focus {
          border-color: ${gold};
          box-shadow: 0 0 0 3px rgba(212,175,55,0.15);
        }
        .manual-input-row input::placeholder {
          color: ${isDark ? '#3f3f46' : '#d1d5db'};
        }
        .manual-submit-btn {
          background: rgba(212,175,55,0.15);
          border: 1px solid ${gold};
          border-left: none;
          color: ${gold};
          padding: 9px 16px;
          border-radius: 0 8px 8px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.18s;
          font-weight: 700;
        }
        .manual-submit-btn:hover:not(:disabled) {
          background: ${gold};
          color: #000;
        }
        .manual-submit-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .gpt-empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .section-group-title {
          color: ${isDark ? gold : goldDim};
          margin-bottom: 1.2rem;
          border-bottom: 1px solid ${isDark ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.35)'};
          padding-bottom: 0.6rem;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
        }

        /* Custom scrollbar for webkit */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.35); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.6); }
      `}</style>

      {/* ═══════════════════════════════════════════════════
          SECTION 1 — AI MODELS
      ═══════════════════════════════════════════════════ */}

      {/* Header */}
      <Row className="mb-4">
        <Col md={12}>
          <div className="models-header-card p-4 d-flex align-items-center gap-3">
            <Info size={26} color={gold} className="flex-shrink-0" />
            <div>
              <h4 style={{ color: isDark ? gold : goldDim, margin: 0, fontWeight: 700 }}>
                Active Intelligence Models
              </h4>
              <p style={{ color: isDark ? '#a8956b' : '#6b7280', margin: '6px 0 0', fontSize: '0.9rem', fontWeight: 500 }}>
                Currently active AI models available across the Integri platform. Tiers and access are managed via User Tier configurations.
              </p>
            </div>
          </div>
        </Col>
      </Row>

      {/* Models content */}
      {modelsLoading ? (
        <Row className="g-5 mb-5">
          {[1, 2, 3].map(group => (
            <Col md={12} key={`group-${group}`}>
              <h5 className="section-group-title placeholder-glow">
                <span className="placeholder col-2 bg-secondary rounded" />
              </h5>
              <Row className="g-3">
                {[1, 2, 3, 4].map(card => (
                  <Col xl={3} lg={4} md={6} sm={12} key={`card-${card}`}>
                    <div className="model-card-item p-3 h-100 placeholder-glow d-flex gap-3 align-items-center">
                      <span className="placeholder rounded-circle bg-secondary" style={{ width: '28px', height: '28px' }} />
                      <div className="flex-grow-1">
                        <span className="placeholder col-10 bg-secondary mb-2 d-block rounded" />
                        <span className="placeholder col-6 bg-secondary rounded" />
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>
          ))}
        </Row>
      ) : modelsError || !models ? (
        <div className="text-center p-5 mt-3 text-danger fw-bold">Failed to load active AI models.</div>
      ) : (
        <Row className="g-5 mb-5">
          {Object.entries(groupedModels).map(([groupName, groupModels]) => (
            <Col md={12} key={groupName}>
              <h5 className="section-group-title">
                {getGroupIcon(groupName)} {groupName}
              </h5>
              <Row className="g-3">
                {(groupModels as string[]).map(model => (
                  <Col xl={3} lg={4} md={6} sm={12} key={model}>
                    <div className="model-card-item p-3 h-100 d-flex align-items-center gap-3">
                      <ModelLogo groupName={groupName} isDark={isDark} />
                      <div className="d-flex flex-column justify-content-center overflow-hidden">
                        <div style={{
                          color: textPrimary, fontWeight: 700, fontSize: '0.9rem',
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis'
                        }} title={model}>
                          {model}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <span style={{ color: textMuted, fontSize: '0.7rem', fontWeight: 600 }}>STATUS:</span>
                          <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACTIVE</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>
          ))}
        </Row>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION DIVIDER
      ═══════════════════════════════════════════════════ */}
      <hr className="gpts-section-divider mb-5" />

      {/* ═══════════════════════════════════════════════════
          SECTION 2 — CUSTOM GPTs / AGENTS
      ═══════════════════════════════════════════════════ */}

      <div ref={gptsHeaderRef}>
        {/* GPTs Header */}
        <Row className="mb-4">
          <Col md={12}>
            <div className="models-header-card p-4">
              <div className="d-flex align-items-start gap-3 flex-wrap">
                <Bot size={26} color={gold} className="flex-shrink-0" style={{ marginTop: '2px' }} />
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                      <h4 style={{ color: isDark ? gold : goldDim, margin: 0, fontWeight: 700 }}>
                        Custom Agents & GPTs
                      </h4>
                      <p style={{ color: isDark ? '#a8956b' : '#6b7280', margin: '6px 0 0', fontSize: '0.9rem', fontWeight: 500 }}>
                        Manage custom agents on the platform. Toggle visibility to public/private, edit settings, or create a new one.
                      </p>

                      {/* Tab Selector */}
                      <div style={{
                        display: 'inline-flex',
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
                        padding: '3px',
                        borderRadius: '8px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
                        marginTop: '14px'
                      }}>
                        <button
                          type="button"
                          onClick={() => setGptTab('all')}
                          style={{
                            background: gptTab === 'all' ? (isDark ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.22)') : 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: gptTab === 'all' ? gold : textMuted,
                            padding: '6px 16px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.18s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Layers size={13} />
                          My Agents ({allGpts?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setGptTab('public')}
                          style={{
                            background: gptTab === 'public' ? (isDark ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.22)') : 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: gptTab === 'public' ? gold : textMuted,
                            padding: '6px 16px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.18s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Globe size={13} />
                          Public List ({publicGpts?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setGptTab('private')}
                          style={{
                            background: gptTab === 'private' ? (isDark ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.22)') : 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: gptTab === 'private' ? gold : textMuted,
                            padding: '6px 16px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.18s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <EyeOff size={13} />
                          Private ({allGpts?.filter(gpt => !gpt.is_public).length || 0})
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Refresh */}
                      <button
                        onClick={() => refetchCurrentGpts()}
                        disabled={currentGptsLoading}
                        style={{
                          background: 'transparent', border: `1px solid ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.5)'}`,
                          color: gold, padding: '7px 14px', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                          transition: 'all 0.18s', flexShrink: 0
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <RefreshCw size={14} style={{ animation: currentGptsLoading ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                      </button>

                      {/* Create Agent button */}
                      <button
                        ref={createBtnRef}
                        id="create-agent-btn"
                        onClick={() => setCreateOpen(true)}
                        style={{
                          background: `linear-gradient(135deg, ${gold} 0%, #a8832a 100%)`,
                          border: 'none', color: '#000',
                          padding: '8px 18px', borderRadius: '9px', fontSize: '0.84rem', fontWeight: 800,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
                          boxShadow: `0 4px 16px rgba(212,175,55,0.4)`,
                          transition: 'all 0.2s', flexShrink: 0,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.boxShadow = `0 6px 24px rgba(212,175,55,0.6)`;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.boxShadow = `0 4px 16px rgba(212,175,55,0.4)`;
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <Plus size={16} /> New Agent
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual GPT ID input */}
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`
              }}>
                <div style={{ fontSize: '0.78rem', color: textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Hash size={12} /> Manual ID Visibility Toggle
                </div>
                <div className="manual-input-row d-flex" style={{ maxWidth: '480px' }}>
                  <input
                    type="text"
                    value={manualGptId}
                    onChange={e => setManualGptId(e.target.value)}
                    placeholder="Enter GPT ID (e.g. gpt-abc123)"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && manualGptId.trim()) setManualConfirmOpen(true);
                    }}
                  />
                  <button
                    className="manual-submit-btn"
                    disabled={!manualGptId.trim()}
                    onClick={() => { if (manualGptId.trim()) setManualConfirmOpen(true); }}
                    title="Toggle visibility for this GPT ID"
                  >
                    <Check size={16} />
                  </button>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* GPTs Grid */}
        {currentGptsLoading ? (
          <Row className="g-4">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <Col xl={3} lg={4} md={6} sm={12} key={n}>
                <div style={{
                  background: surfaceBg, border: `1px solid ${surfaceBorder}`, borderRadius: '14px',
                  overflow: 'hidden', height: '280px'
                }} className="placeholder-glow">
                  <div style={{ height: '3px', background: isDark ? '#27272a' : '#e4e4e7' }} />
                  <div style={{ padding: '18px' }}>
                    <div className="d-flex gap-3 mb-3">
                      <span className="placeholder bg-secondary rounded" style={{ width: 44, height: 44, borderRadius: 10 }} />
                      <div className="flex-grow-1">
                        <span className="placeholder col-8 bg-secondary rounded d-block mb-2" />
                        <span className="placeholder col-5 bg-secondary rounded d-block" style={{ height: '18px' }} />
                      </div>
                    </div>
                    <span className="placeholder col-12 bg-secondary rounded d-block mb-1" />
                    <span className="placeholder col-10 bg-secondary rounded d-block mb-3" />
                    <div className="row g-2">
                      {[1,2,3,4].map(i => <div key={i} className="col-6"><span className="placeholder col-12 bg-secondary rounded d-block" style={{ height: '44px' }} /></div>)}
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        ) : currentGptsError ? (
          <div className="gpt-empty-state">
            <XCircle size={48} color="#ef4444" style={{ marginBottom: '12px', opacity: 0.7 }} />
            <p style={{ color: '#ef4444', fontWeight: 600, margin: 0 }}>Couldn't load agents</p>
            <p style={{ color: textMuted, fontSize: '0.85rem', marginTop: '6px' }}>Check your connection or hit Refresh above</p>
          </div>
        ) : !currentGpts || currentGpts.length === 0 ? (
          <div className="gpt-empty-state">
            <Bot size={52} color={isDark ? '#3f3f46' : '#d1d5db'} style={{ marginBottom: '14px' }} />
            <p style={{ color: isDark ? '#52525b' : '#9ca3af', fontWeight: 700, fontSize: '1.05rem', margin: '0 0 6px' }}>
              {gptTab === 'public' ? 'No Public Agents Yet' : (gptTab === 'private' ? 'No Private Agents Found' : 'No Agents Found')}
            </p>
            <p style={{ color: textMuted, fontSize: '0.85rem', maxWidth: '360px', margin: '0 auto 20px', lineHeight: 1.5 }}>
              {gptTab === 'public' 
                ? "No custom agents are currently marked as public. Select 'My Agents' to view your private ones, or click a private agent's card to toggle its publicity."
                : (gptTab === 'private' ? "You have no private agents. All your agents are currently public." : "You haven't created any agents yet. Get started by clicking the button below.")}
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              style={{
                background: `linear-gradient(135deg, ${gold} 0%, #a8832a 100%)`,
                border: 'none', color: '#000',
                padding: '10px 24px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 800,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
                boxShadow: `0 4px 16px rgba(212,175,55,0.4)`,
              }}
            >
              <Plus size={16} /> Create your first agent
            </button>
          </div>
        ) : (
          <Row className="g-4">
            {currentGpts.map((gpt, index) => (
              <Col xl={3} lg={4} md={6} sm={12} key={gpt.gpt_id}>
                <GptCard gpt={gpt} isDark={isDark} onClick={handleGptCardClick} index={index} />
              </Col>
            ))}
          </Row>
        )}

        {/* GPT count footer */}
        {currentGpts && currentGpts.length > 0 && (
          <div style={{
            marginTop: '24px', textAlign: 'center',
            fontSize: '0.8rem', color: textMuted, fontWeight: 600
          }}>
            Showing {currentGpts.length} {gptTab === 'public' ? 'public' : (gptTab === 'private' ? 'private' : 'total')} agent{currentGpts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════ */}

      {/* GPT card-click modal */}
      {selectedGptId && (
        <GptDetailModal
          gptId={selectedGptId}
          isDark={isDark}
          models={models ?? []}
          onClose={() => setSelectedGptId(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['publicGpts'] });
            queryClient.invalidateQueries({ queryKey: ['allAdminGpts'] });
          }}
        />
      )}

      {/* Manual GPT ID confirmation modal */}
      {manualConfirmOpen && (
        <ManualToggleConfirmModal
          gptId={manualGptId.trim()}
          isDark={isDark}
          onClose={() => { if (!manualLoading) setManualConfirmOpen(false); }}
          onConfirm={handleManualToggleConfirm}
          isLoading={manualLoading}
        />
      )}

      {/* Create Agent slide-over */}
      {createOpen && (
        <CreateAgentModal
          isDark={isDark}
          models={models ?? []}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['publicGpts'] });
            queryClient.invalidateQueries({ queryKey: ['allAdminGpts'] });
          }}
        />
      )}
    </div>
  );
}
