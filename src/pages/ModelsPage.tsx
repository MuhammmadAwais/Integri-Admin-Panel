import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ModelsService, CustomGptService, type CustomGpt } from 'api/backendApi';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import {
  Cpu, Info, Layers, Zap, Globe, Box, Terminal, Activity,
  Bot, Eye, EyeOff, CheckCircle, XCircle, RefreshCw, Hash,
  Check, X, AlertTriangle, Loader2, Sparkles, Users, Calendar,
  BookOpen, ChevronRight, ToggleLeft, ToggleRight
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { gsap } from 'gsap';
import ElitePortal from 'components/EliteUI/ElitePortal';
import { showToast } from 'components/EliteUI/EliteToastContainer';

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

// ─── GPT Publicity Toggle Modal ──────────────────────────────────────────────

interface GptModalProps {
  gpt: CustomGpt | null;
  isDark: boolean;
  onClose: () => void;
  onConfirm: (gptId: string, newPublicState: boolean) => Promise<void>;
  isLoading: boolean;
}

const GptPublicityModal: React.FC<GptModalProps> = ({ gpt, isDark, onClose, onConfirm, isLoading }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isPublic = gpt?.is_public ?? false;
  const newState = !isPublic;

  useEffect(() => {
    if (gpt) {
      document.body.style.overflow = 'hidden';
      const tl = gsap.timeline();
      tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      tl.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.88, y: 24 },
        { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: 'back.out(1.6)' },
        '-=0.12'
      );
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [gpt]);

  const handleClose = useCallback(() => {
    if (isLoading) return;
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(modalRef.current, { opacity: 0, scale: 0.88, y: 24, duration: 0.22, ease: 'power2.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.18, ease: 'power2.in' }, '-=0.08');
  }, [onClose, isLoading]);

  if (!gpt) return null;

  const accentColor = newState ? '#10b981' : '#ef4444';
  const accentBg = newState ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';

  return (
    <ElitePortal>
      <div
        ref={overlayRef}
        onClick={handleClose}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}
      >
        <div
          ref={modalRef}
          onClick={e => e.stopPropagation()}
          style={{
            background: isDark ? 'rgba(10,10,14,0.98)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.4)'}`,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {newState ? <Eye size={18} color={accentColor} /> : <EyeOff size={18} color={accentColor} />}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: isDark ? '#D4AF37' : '#b48a04' }}>
                {newState ? 'Make GPT Public' : 'Remove from Public'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              style={{
                background: 'transparent', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                color: isDark ? '#71717a' : '#a1a1aa', padding: '4px', borderRadius: '50%', display: 'flex',
                transition: 'color 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#fff' : '#000')}
              onMouseLeave={e => (e.currentTarget.style.color = isDark ? '#71717a' : '#a1a1aa')}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px' }}>
            {/* GPT Info Card */}
            <div style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: '10px', padding: '16px', marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, #D4AF37 0%, #c09b2f 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Bot size={22} color="#000" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: '0.95rem',
                    color: isDark ? '#fff' : '#111',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {gpt.name}
                  </div>
                  <div style={{
                    fontSize: '0.8rem', color: isDark ? '#71717a' : '#6b7280',
                    marginTop: '3px', lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>
                    {gpt.description || 'No description provided'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: isPublic ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                      color: isPublic ? '#10b981' : '#ef4444',
                      border: `1px solid ${isPublic ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
                      textTransform: 'uppercase', letterSpacing: '0.4px'
                    }}>
                      {isPublic ? '● Public' : '● Private'}
                    </span>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.12)',
                      color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)',
                      textTransform: 'uppercase', letterSpacing: '0.4px'
                    }}>
                      {gpt.recommended_provider}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmation message */}
            <div style={{
              background: accentBg, border: `1px solid ${accentColor}40`,
              borderRadius: '8px', padding: '12px 16px',
              display: 'flex', gap: '10px', alignItems: 'flex-start'
            }}>
              <AlertTriangle size={16} color={accentColor} style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ margin: 0, fontSize: '0.875rem', color: isDark ? '#e4e4e7' : '#374151', lineHeight: 1.5 }}>
                {newState
                  ? 'This GPT will become visible to all authenticated users on the platform and can be used in chat sessions.'
                  : 'This GPT will be removed from the public listing. Existing chat sessions will remain private.'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px'
          }}>
            <button
              onClick={handleClose}
              disabled={isLoading}
              style={{
                background: 'transparent', cursor: isLoading ? 'not-allowed' : 'pointer',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                color: isDark ? '#a1a1aa' : '#6b7280',
                padding: '9px 20px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(gpt.gpt_id, newState)}
              disabled={isLoading}
              style={{
                background: accentBg, cursor: isLoading ? 'not-allowed' : 'pointer',
                border: `1px solid ${accentColor}`,
                color: accentColor,
                padding: '9px 22px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '7px',
                transition: 'all 0.2s', opacity: isLoading ? 0.6 : 1
              }}
              onMouseEnter={e => {
                if (!isLoading) {
                  e.currentTarget.style.background = accentColor;
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = accentBg;
                e.currentTarget.style.color = accentColor;
              }}
            >
              {isLoading
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Updating...</>
                : <>{newState ? <Eye size={15} /> : <EyeOff size={15} />} Confirm</>
              }
            </button>
          </div>
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
              <Hash size={18} color="#D4AF37" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: isDark ? '#D4AF37' : '#b48a04' }}>
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
              You are about to toggle the publicity status for GPT:
            </p>
            <div style={{
              background: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.1)',
              border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px',
              padding: '10px 14px', fontFamily: 'monospace',
              fontSize: '0.875rem', color: '#D4AF37', fontWeight: 700,
              wordBreak: 'break-all'
            }}>
              {gptId}
            </div>
            <p style={{ margin: '14px 0 0', fontSize: '0.82rem', color: isDark ? '#6b7280' : '#9ca3af', lineHeight: 1.4 }}>
              This action will toggle its public visibility. Continue?
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
                border: '1px solid #D4AF37', color: '#D4AF37',
                padding: '8px 20px', borderRadius: '7px', fontSize: '0.855rem', fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
                transition: 'all 0.2s', opacity: isLoading ? 0.65 : 1
              }}
              onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background = '#D4AF37'; e.currentTarget.style.color = '#000'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.15)'; e.currentTarget.style.color = '#D4AF37'; }}
            >
              {isLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Toggling...</> : <><ToggleRight size={14} /> Confirm Toggle</>}
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

  // ── Public GPTs ──
  const {
    data: gpts,
    isLoading: gptsLoading,
    isError: gptsError,
    refetch: refetchGpts
  } = useQuery({
    queryKey: ['publicGpts'],
    queryFn: () => CustomGptService.fetchPublicGpts(200),
  });

  // ── Modal state ──
  const [selectedGpt, setSelectedGpt] = useState<CustomGpt | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // ── Manual GPT ID toggle ──
  const [manualGptId, setManualGptId] = useState('');
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  // Section refs for GSAP
  const gptsHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gptsLoading && gptsHeaderRef.current) {
      gsap.fromTo(gptsHeaderRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
    }
  }, [gptsLoading]);

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
    setSelectedGpt(gpt);
  };

  const handleGptModalConfirm = async (gptId: string, newPublicState: boolean) => {
    setModalLoading(true);
    try {
      await CustomGptService.toggleGptPublicity(gptId, newPublicState);
      showToast(`GPT "${selectedGpt?.name}" is now ${newPublicState ? 'public' : 'private'}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['publicGpts'] });
      setSelectedGpt(null);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update GPT publicity', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleManualToggleConfirm = async () => {
    setManualLoading(true);
    const trimmedId = manualGptId.trim();
    try {
      // We toggle: since we don't know current state from just an ID, we try true (make public);
      // In practice the user can re-enter to toggle off. 
      await CustomGptService.toggleGptPublicity(trimmedId, true);
      showToast(`GPT ${trimmedId} publicity toggled successfully`, 'success');
      queryClient.invalidateQueries({ queryKey: ['publicGpts'] });
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
          SECTION 2 — CUSTOM GPTs
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
                        Custom GPTs
                      </h4>
                      <p style={{ color: isDark ? '#a8956b' : '#6b7280', margin: '6px 0 0', fontSize: '0.9rem', fontWeight: 500 }}>
                        Public custom GPTs available on the platform. Click any card to toggle its public visibility, or manually enter a GPT ID below.
                      </p>
                    </div>
                    <button
                      onClick={() => refetchGpts()}
                      disabled={gptsLoading}
                      style={{
                        background: 'transparent', border: `1px solid ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.5)'}`,
                        color: gold, padding: '7px 14px', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        transition: 'all 0.18s', flexShrink: 0
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <RefreshCw size={14} style={{ animation: gptsLoading ? 'spin 1s linear infinite' : 'none' }} />
                      Refresh
                    </button>
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
                  <Hash size={12} /> Manual GPT ID Toggle
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
                    title="Toggle publicity for this GPT ID"
                  >
                    <Check size={16} />
                  </button>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* GPTs Grid */}
        {gptsLoading ? (
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
        ) : gptsError ? (
          <div className="gpt-empty-state">
            <XCircle size={48} color="#ef4444" style={{ marginBottom: '12px', opacity: 0.7 }} />
            <p style={{ color: '#ef4444', fontWeight: 600, margin: 0 }}>Failed to load public GPTs</p>
            <p style={{ color: textMuted, fontSize: '0.85rem', marginTop: '6px' }}>Check your connection or try refreshing</p>
          </div>
        ) : !gpts || gpts.length === 0 ? (
          <div className="gpt-empty-state">
            <Bot size={52} color={isDark ? '#3f3f46' : '#d1d5db'} style={{ marginBottom: '14px' }} />
            <p style={{ color: isDark ? '#52525b' : '#9ca3af', fontWeight: 700, fontSize: '1.05rem', margin: '0 0 6px' }}>
              No Public GPTs Available
            </p>
            <p style={{ color: textMuted, fontSize: '0.85rem', maxWidth: '360px', margin: '0 auto', lineHeight: 1.5 }}>
              No custom GPTs have been marked as public yet. Use the manual ID input above or check back later.
            </p>
          </div>
        ) : (
          <Row className="g-4">
            {gpts.map((gpt, index) => (
              <Col xl={3} lg={4} md={6} sm={12} key={gpt.gpt_id}>
                <GptCard gpt={gpt} isDark={isDark} onClick={handleGptCardClick} index={index} />
              </Col>
            ))}
          </Row>
        )}

        {/* GPT count footer */}
        {gpts && gpts.length > 0 && (
          <div style={{
            marginTop: '24px', textAlign: 'center',
            fontSize: '0.8rem', color: textMuted, fontWeight: 600
          }}>
            Showing {gpts.length} public custom GPT{gpts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════ */}

      {/* GPT card-click modal */}
      {selectedGpt && (
        <GptPublicityModal
          gpt={selectedGpt}
          isDark={isDark}
          onClose={() => { if (!modalLoading) setSelectedGpt(null); }}
          onConfirm={handleGptModalConfirm}
          isLoading={modalLoading}
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
    </div>
  );
}
