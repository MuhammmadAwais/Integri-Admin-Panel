import React, { useState, useEffect, useRef } from 'react';
import { PromptsService, NewsService } from 'api/backendApi';
import { gsap } from 'gsap';
import { Cpu, Save, TerminalSquare, AlertCircle, Loader, Globe, Database, AlertTriangle, CheckCircle2, Info, PlusCircle } from 'lucide-react';
import MainCard from 'components/MainCard';

const REQUIRED_PLACEHOLDERS = [
  {
    code: '<EXISTING_MEMORY_JSON>',
    label: "User's current memory object",
    description: 'The JSON string representing existing long-term memory'
  },
  {
    code: '<USER_LANGUAGE_CODE>',
    label: "User language code",
    description: 'Language identifier, e.g. "en", "de"'
  },
  {
    code: '<TODAY_DATE>',
    label: "Today's date",
    description: 'Current date string, e.g. "2026-07-29"'
  },
  {
    code: '<SHORT_TERM_VALID_UNTIL>',
    label: "Short-term validity date",
    description: 'Expiration date string, e.g. "2026-08-05"'
  }
];

const renderSourceBadge = (src) => {
  if (!src) return null;
  let bg = 'rgba(212,175,55,0.15)';
  let color = '#D4AF37';
  let border = '1px solid rgba(212,175,55,0.3)';
  let label = src.toUpperCase();
  let title = 'Source of prompt data';

  if (src === 'cache') {
    bg = 'rgba(40, 167, 69, 0.15)';
    color = '#4cd137';
    border = '1px solid rgba(40, 167, 69, 0.35)';
    label = '⚡ CACHE (REDIS)';
    title = 'Served from Redis (fast path, set on every save)';
  } else if (src === 'database') {
    bg = 'rgba(0, 168, 255, 0.15)';
    color = '#00a8ff';
    border = '1px solid rgba(0, 168, 255, 0.35)';
    label = '🗄️ DATABASE (DYNAMODB)';
    title = 'Redis was empty/expired, read from DynamoDB and re-cached';
  } else if (src === 'default_code') {
    bg = 'rgba(255, 159, 67, 0.15)';
    color = '#ff9f43';
    border = '1px solid rgba(255, 159, 67, 0.35)';
    label = '📄 DEFAULT CODE (FALLBACK)';
    title = 'Nothing has ever been saved; hardcoded fallback from app/prompts/prompts.py';
  }

  return (
    <span 
      style={{
        fontSize: '0.75rem',
        color,
        background: bg,
        border,
        padding: '3px 10px',
        borderRadius: '12px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        cursor: 'help'
      }}
      title={title}
    >
      {label}
    </span>
  );
};

export default function PromptsPage() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Country Prompts State
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [countryPrompt, setCountryPrompt] = useState('');
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryEditing, setCountryEditing] = useState(false);
  const [countryEditValue, setCountryEditValue] = useState('');
  const [countrySaving, setCountrySaving] = useState(false);

  // Memory Extraction Prompt State
  const [memoryPrompt, setMemoryPrompt] = useState('');
  const [memorySource, setMemorySource] = useState(''); // 'cache', 'database', 'default_code'
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memoryEditing, setMemoryEditing] = useState(false);
  const [memoryEditValue, setMemoryEditValue] = useState('');
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryWarning, setMemoryWarning] = useState(null);
  const [memorySuccess, setMemorySuccess] = useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [defaultData, othersData, voiceData, countriesData, memoryData] = await Promise.all([
          PromptsService.getDefaultPrompt().catch(() => null),
          PromptsService.getOthersPrompt().catch(() => null),
          PromptsService.getVoicePrompt().catch(() => null),
          NewsService.fetchAdminCountries().catch(() => null),
          PromptsService.getMemoryExtractionPrompt().catch(() => null)
        ]);
        
        const arr = [];
        if (defaultData) arr.push({ id: 'default', name: 'Default Prompt', ...defaultData });
        if (othersData) arr.push({ id: 'others', name: 'Wait/Others Prompt', ...othersData });
        if (voiceData) arr.push({ id: 'voice', name: 'Voice Engine Prompt', ...voiceData });

        setPrompts(arr);

        if (countriesData && countriesData.supported_countries) {
          const sortedCountries = Object.keys(countriesData.supported_countries).sort();
          setCountries(sortedCountries);
          if (sortedCountries.length > 0) {
            const initialCountry = sortedCountries[0];
            setSelectedCountry(initialCountry);
            setCountryLoading(true);
            try {
              const cp = await PromptsService.getCountrySummaryPrompt(initialCountry);
              const text = typeof cp === 'string' ? cp : (cp?.prompt || '');
              setCountryPrompt(text);
            } catch (err) {
              console.error("Failed to load country summary prompt for initial country:", err);
            } finally {
              setCountryLoading(false);
            }
          }
        }

        if (memoryData) {
          const text = typeof memoryData === 'string' ? memoryData : (memoryData?.prompt || '');
          setMemoryPrompt(text);
          setMemorySource(memoryData?.source || '');
        }
        setMemoryLoading(false);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to securely access Prompts Intelligence.');
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // GSAP Entrance
  useEffect(() => {
    if (!loading && prompts.length > 0 && containerRef.current) {
      const cards = containerRef.current.querySelectorAll('.prompt-card');
      gsap.fromTo(cards, 
        { opacity: 0, y: 30, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.1, ease: 'power4.out', clearProps: 'all' }
      );
    }
  }, [loading, prompts]);

  const handleEdit = (promptItem) => {
    setEditingId(promptItem.id);
    setEditForm({
      prompt: promptItem.prompt || promptItem.instructions || '',
      model: promptItem.model || 'gpt-4o',
      provider: promptItem.provider || 'openai'
    });
  };

  const handleSave = async (id) => {
    setSaving(true);
    try {
      await PromptsService.updatePrompt(id, editForm);
      // Optimistic update
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...editForm } : p));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to commit prompt update");
    } finally {
      setSaving(false);
    }
  };

  const handleCountryChange = async (country) => {
    setSelectedCountry(country);
    setCountryLoading(true);
    setCountryEditing(false);
    try {
      const cp = await PromptsService.getCountrySummaryPrompt(country);
      const text = typeof cp === 'string' ? cp : (cp?.prompt || '');
      setCountryPrompt(text);
    } catch (err) {
      console.error("Failed to load country summary prompt:", err);
      setCountryPrompt('');
    } finally {
      setCountryLoading(false);
    }
  };

  const handleCountryEdit = () => {
    setCountryEditing(true);
    setCountryEditValue(countryPrompt);
  };

  const handleCountrySave = async () => {
    setCountrySaving(true);
    try {
      await PromptsService.updateCountrySummaryPrompt(selectedCountry, countryEditValue);
      // Optimistic update
      setCountryPrompt(countryEditValue);
      setCountryEditing(false);
    } catch (err) {
      console.error("Failed to save country summary prompt:", err);
    } finally {
      setCountrySaving(false);
    }
  };

  const handleMemoryEdit = () => {
    setMemoryEditing(true);
    setMemoryEditValue(memoryPrompt);
    setMemoryWarning(null);
    setMemorySuccess(null);
  };

  const handleMemorySave = async () => {
    setMemorySaving(true);
    setMemoryWarning(null);
    setMemorySuccess(null);
    try {
      const res = await PromptsService.updateMemoryExtractionPrompt(memoryEditValue);
      if (res && res.warning) {
        setMemoryWarning(res.warning);
      }
      const msg = (res && res.message) ? res.message : 'Memory extraction prompt updated and cached';
      setMemorySuccess(msg);
      setMemoryPrompt(memoryEditValue);
      setMemorySource('cache'); // As per docs, after saving it is cached in Redis
      setMemoryEditing(false);
    } catch (err) {
      console.error("Failed to save memory extraction prompt:", err);
      setMemoryWarning("Failed to commit prompt update. Please try again.");
    } finally {
      setMemorySaving(false);
    }
  };

  const handleInsertPlaceholder = (code) => {
    if (!memoryEditValue.includes(code)) {
      setMemoryEditValue(prev => {
        const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
        return prev + (needsSpace ? ' ' : '') + code;
      });
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <Loader className="spin" size={48} color="#D4AF37" style={{ animation: 'spin 2s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="mb-4 d-flex align-items-center gap-3">
        <Cpu size={32} color="#D4AF37" />
        <h2 style={{ color: '#D4AF37', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Intelligence Core Prompts
        </h2>
      </div>
      
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2" style={{ background: 'rgba(220, 20, 60, 0.1)', color: '#DC143C', border: '1px solid #DC143C' }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="row" ref={containerRef}>
        {prompts.map((prompt, index) => {
          let bentoClass = "col-lg-6";
          if (prompts.length === 3) {
            bentoClass = index === 0 ? "col-lg-8" : index === 1 ? "col-lg-4" : "col-lg-12";
          } else if (prompts.length === 1) {
            bentoClass = "col-lg-12";
          }
          return (
          <div className={`${bentoClass} col-12 mb-4`} key={prompt.id}>
            <div 
              className="card prompt-card h-100" 
              style={{ 
                background: 'rgba(5,5,5,0.75)', 
                backdropFilter: 'blur(12px)', 
                border: '0.5px solid rgba(212,175,55,0.4)', 
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
            >
              <div className="card-header d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                <div className="d-flex align-items-center gap-2">
                  <TerminalSquare size={16} color="#a8956b" />
                  <strong style={{ color: '#D4AF37', letterSpacing: '0.05em' }}>{prompt.name || prompt.id}</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a8956b', background: 'rgba(212,175,55,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                  {prompt.model || 'gpt-4o'}
                </div>
              </div>
              <div className="card-body">
                {editingId === prompt.id ? (
                  <div>
                    <div className="form-group mb-3">
                      <label style={{ color: '#a8956b', fontSize: '0.8rem', marginBottom: '8px' }}>SYSTEM INSTRUCTIONS</label>
                      <textarea 
                        className="form-control" 
                        dir="auto"
                        value={editForm.prompt || ''} 
                        onChange={(e) => setEditForm({...editForm, prompt: e.target.value})}
                        style={{ background: '#0a0a0a', color: '#e0d5b8', border: '1px solid rgba(212,175,55,0.3)', minHeight: '120px' }}
                      />
                    </div>
                    <div className="d-flex justify-content-end gap-2">
                      <button className="btn btn-sm" style={{ color: '#e0d5b8', cursor: 'pointer' }} onClick={() => setEditingId(null)}>Cancel</button>
                      <button 
                        className="btn btn-sm d-flex align-items-center gap-2" 
                        style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid #D4AF37', cursor: 'pointer' }}
                        onClick={() => handleSave(prompt.id)}
                        disabled={saving}
                      >
                        <Save size={14} /> {saving ? 'Committing...' : 'Commit Protocol'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div 
                      style={{ 
                        color: '#e0d5b8', 
                        fontSize: '0.9rem', 
                        fontFamily: 'monospace', 
                        background: '#0a0a0a', 
                        padding: '12px', 
                        borderRadius: '4px',
                        border: '1px solid rgba(212,175,55,0.1)',
                        minHeight: '80px',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {prompt.prompt || prompt.instructions || 'No implicit instructions defined.'}
                    </div>
                    <div className="d-flex justify-content-end mt-3">
                      <button 
                        className="btn btn-sm" 
                        style={{ color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer' }}
                        onClick={() => handleEdit(prompt)}
                      >
                        Configure Logic
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })}
        {prompts.length === 0 && !error && (
          <div className="col-12 text-center p-5" style={{ color: '#a8956b' }}>
            No Prompts synchronized.
          </div>
        )}
      </div>

      {/* Memory Extraction Prompt Section */}
      <div className="row mt-2">
        <div className="col-12 mb-4">
          <div 
            className="card h-100" 
            style={{ 
              background: 'rgba(5,5,5,0.75)', 
              backdropFilter: 'blur(12px)', 
              border: '0.5px solid rgba(212,175,55,0.4)', 
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            <div className="card-header d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
              <div className="d-flex align-items-center gap-2">
                <Database size={16} color="#a8956b" />
                <strong style={{ color: '#D4AF37', letterSpacing: '0.05em' }}>MEMORY EXTRACTION PROMPT</strong>
              </div>
              <div className="d-flex align-items-center gap-2">
                {renderSourceBadge(memorySource)}
              </div>
            </div>
            <div className="card-body">
              {memoryLoading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '120px' }}>
                  <Loader className="spin" size={24} color="#D4AF37" style={{ animation: 'spin 2s linear infinite' }} />
                </div>
              ) : (
                <div>
                  {/* Required Placeholders & UI/UX Guidelines Banner */}
                  <div 
                    className="mb-3 p-3" 
                    style={{ 
                      background: 'rgba(212, 175, 55, 0.08)', 
                      border: '1px solid rgba(212, 175, 55, 0.25)', 
                      borderRadius: '6px' 
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-2" style={{ color: '#D4AF37', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.04em' }}>
                        <Info size={16} />
                        <span>REQUIRED PLACEHOLDERS & PROTOCOL GUIDELINES</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#a8956b' }}>
                        {memoryEditing ? 'Click pill to insert missing placeholder' : 'Live validation check'}
                      </span>
                    </div>
                    <p style={{ color: '#e0d5b8', fontSize: '0.8rem', margin: '0 0 12px 0', lineHeight: 1.4, opacity: 0.9 }}>
                      The prompt value must retain these four placeholders — the memory service substitutes them via <code style={{ color: '#D4AF37', background: 'rgba(0,0,0,0.4)', padding: '2px 5px', borderRadius: '3px', border: '1px solid rgba(212,175,55,0.2)' }}>str.replace()</code> right before the extraction call. If any placeholder is missing, the API returns a warning.
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      {REQUIRED_PLACEHOLDERS.map((ph) => {
                        const isPresent = (memoryEditing ? memoryEditValue : memoryPrompt).includes(ph.code);
                        return (
                          <div
                            key={ph.code}
                            onClick={() => memoryEditing && handleInsertPlaceholder(ph.code)}
                            title={`${ph.description}${memoryEditing ? ' (Click to append if missing)' : ''}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: isPresent ? 'rgba(40, 167, 69, 0.15)' : 'rgba(255, 193, 7, 0.15)',
                              color: isPresent ? '#4cd137' : '#ffc107',
                              border: isPresent ? '1px solid rgba(40, 167, 69, 0.4)' : '1px solid rgba(255, 193, 7, 0.4)',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              cursor: memoryEditing ? 'pointer' : 'default',
                              transition: 'all 0.2s ease',
                              userSelect: 'none'
                            }}
                          >
                            <span>{isPresent ? '✓' : '⚠'}</span>
                            <span>{ph.code}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.8, fontFamily: 'sans-serif', fontWeight: 400 }}>
                              ({ph.label})
                            </span>
                            {memoryEditing && !isPresent && (
                              <PlusCircle size={13} style={{ marginLeft: '2px' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Warning feedback alert */}
                  {memoryWarning && (
                    <div className="alert d-flex align-items-center gap-2 mb-3" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#ffc107', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '0.85rem' }}>
                      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                      <div>
                        <strong>Warning from Memory Service:</strong> {memoryWarning}
                      </div>
                    </div>
                  )}

                  {/* Success feedback alert */}
                  {memorySuccess && (
                    <div className="alert d-flex align-items-center gap-2 mb-3" style={{ background: 'rgba(40, 167, 69, 0.15)', color: '#4cd137', border: '1px solid #4cd137', borderRadius: '6px', fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                      <div>{memorySuccess}</div>
                    </div>
                  )}

                  {memoryEditing ? (
                    <div>
                      <div className="form-group mb-3">
                        <label style={{ color: '#a8956b', fontSize: '0.8rem', marginBottom: '8px' }}>MEMORY EXTRACTION SYSTEM INSTRUCTIONS</label>
                        <textarea 
                          className="form-control" 
                          value={memoryEditValue} 
                          onChange={(e) => setMemoryEditValue(e.target.value)}
                          style={{ background: '#0a0a0a', color: '#e0d5b8', border: '1px solid rgba(212,175,55,0.3)', minHeight: '220px', fontFamily: 'monospace' }}
                        />
                      </div>
                      <div className="d-flex justify-content-end gap-2">
                        <button 
                          className="btn btn-sm" 
                          style={{ color: '#e0d5b8', cursor: 'pointer' }} 
                          onClick={() => {
                            setMemoryEditing(false);
                            setMemoryWarning(null);
                            setMemorySuccess(null);
                          }}
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn btn-sm d-flex align-items-center gap-2" 
                          style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid #D4AF37', cursor: 'pointer' }}
                          onClick={handleMemorySave}
                          disabled={memorySaving}
                        >
                          <Save size={14} /> {memorySaving ? 'Committing...' : 'Commit Protocol'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div 
                        style={{ 
                          color: '#e0d5b8', 
                          fontSize: '0.9rem', 
                          fontFamily: 'monospace', 
                          background: '#0a0a0a', 
                          padding: '12px', 
                          borderRadius: '4px',
                          border: '1px solid rgba(212,175,55,0.1)',
                          minHeight: '120px',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {memoryPrompt || 'No implicit instructions defined.'}
                      </div>
                      <div className="d-flex justify-content-end mt-3">
                        <button 
                          className="btn btn-sm" 
                          style={{ color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer' }}
                          onClick={handleMemoryEdit}
                        >
                          Configure Logic
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Country Summary Prompt Section (Without GSAP, Lag-free, Instant, No Toasts) */}
      {countries.length > 0 && (
        <div className="row mt-2">
          <div className="col-12 mb-4">
            <div 
              className="card h-100" 
              style={{ 
                background: 'rgba(5,5,5,0.75)', 
                backdropFilter: 'blur(12px)', 
                border: '0.5px solid rgba(212,175,55,0.4)', 
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
            >
              <div className="card-header d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                <div className="d-flex align-items-center gap-2">
                  <Globe size={16} color="#a8956b" />
                  <strong style={{ color: '#D4AF37', letterSpacing: '0.05em' }}>COUNTRY SUMMARY PROMPT</strong>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span style={{ color: '#a8956b', fontSize: '0.8rem', fontWeight: 600 }}>COUNTRY:</span>
                  <select 
                    value={selectedCountry}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    style={{ 
                      background: '#0a0a0a', 
                      color: '#e0d5b8', 
                      border: '1px solid rgba(212,175,55,0.3)', 
                      borderRadius: '4px',
                      padding: '4px 28px 4px 8px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='%23a8956b' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>")`,
                      backgroundPosition: 'right 4px center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '16px',
                    }}
                  >
                    {countries.map(c => (
                      <option key={c} value={c} style={{ background: '#0a0a0a', color: '#e0d5b8' }}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="card-body">
                {countryLoading ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '120px' }}>
                    <Loader className="spin" size={24} color="#D4AF37" style={{ animation: 'spin 2s linear infinite' }} />
                  </div>
                ) : countryEditing ? (
                  <div>
                    <div className="form-group mb-3">
                      <label style={{ color: '#a8956b', fontSize: '0.8rem', marginBottom: '8px' }}>COUNTRY PROMPT INSTRUCTIONS ({selectedCountry})</label>
                      <textarea 
                        className="form-control" 
                        value={countryEditValue} 
                        onChange={(e) => setCountryEditValue(e.target.value)}
                        style={{ background: '#0a0a0a', color: '#e0d5b8', border: '1px solid rgba(212,175,55,0.3)', minHeight: '120px' }}
                      />
                    </div>
                    <div className="d-flex justify-content-end gap-2">
                      <button className="btn btn-sm" style={{ color: '#e0d5b8', cursor: 'pointer' }} onClick={() => setCountryEditing(false)}>Cancel</button>
                      <button 
                        className="btn btn-sm d-flex align-items-center gap-2" 
                        style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid #D4AF37', cursor: 'pointer' }}
                        onClick={handleCountrySave}
                        disabled={countrySaving}
                      >
                        <Save size={14} /> {countrySaving ? 'Committing...' : 'Commit Protocol'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div 
                      style={{ 
                        color: '#e0d5b8', 
                        fontSize: '0.9rem', 
                        fontFamily: 'monospace', 
                        background: '#0a0a0a', 
                        padding: '12px', 
                        borderRadius: '4px',
                        border: '1px solid rgba(212,175,55,0.1)',
                        minHeight: '80px',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {countryPrompt || 'No implicit instructions defined.'}
                    </div>
                    <div className="d-flex justify-content-end mt-3">
                      <button 
                        className="btn btn-sm" 
                        style={{ color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer' }}
                        onClick={handleCountryEdit}
                      >
                        Configure Logic
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
