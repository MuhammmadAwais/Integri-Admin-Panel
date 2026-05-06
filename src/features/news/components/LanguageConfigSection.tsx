import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NewsService, CountryLangConfig } from 'api/backendApi';
import { Languages, Save, X, Check, Search, Globe } from 'lucide-react';
import CountryFlag from 'components/CountryFlag';

type Toast = { message: string; type: 'success' | 'error' } | null;

export default function LanguageConfigSection({ countryDetails }: { countryDetails: Record<string, any> }) {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<Toast>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [tempLanguages, setTempLanguages] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: configsData, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['allLangConfigs'],
    queryFn: NewsService.fetchAllCountryLangConfigs
  });

  const { data: supportedLanguages } = useQuery({
    queryKey: ['supportedLanguages'],
    queryFn: NewsService.fetchSupportedLanguages
  });

  const updateMutation = useMutation({
    mutationFn: ({ country, languages }: { country: string, languages: string[] }) => 
      NewsService.updateCountryLanguages(country, languages),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allLangConfigs'] });
      setToast({ message: 'Pipeline configuration updated successfully!', type: 'success' });
      setIsModalOpen(false);
    },
    onError: () => {
      setToast({ message: 'Failed to update configuration.', type: 'error' });
    }
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  const openModal = (config: CountryLangConfig) => {
    setSelectedCountry(config.country);
    setTempLanguages([...config.languages]);
    setIsModalOpen(true);
  };

  const toggleLanguage = (code: string) => {
    setTempLanguages(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSave = () => {
    updateMutation.mutate({ country: selectedCountry, languages: tempLanguages });
  };

  const filteredLangs = supportedLanguages?.languages.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="mt-5 position-relative">
      {/* Toast Notification */}
      {toast && (
        <div 
          className="position-fixed top-0 start-50 translate-middle-x mt-4 p-3 rounded shadow-lg" 
          style={{ 
            zIndex: 1100, 
            background: toast.type === 'success' ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)',
            color: '#fff',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            minWidth: '300px',
            textAlign: 'center',
            fontWeight: 600
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Languages size={20} color="#D4AF37" />
        <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
          Language Configurations
        </h3>
      </div>
      <p style={{ color: 'var(--news-text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
        Manage active translation targets for each country. These determine which languages articles will be translated into.
      </p>

      {/* Part A: Translation Overview Table */}
      <div style={{ background: 'var(--news-glass-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--news-glass-border)', borderRadius: 4, overflow: 'hidden', boxShadow: 'var(--news-card-shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--news-table-header-bg)', borderBottom: '1px solid var(--news-glass-border)', color: 'var(--news-text-dim)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <tr>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Country</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Native</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Active Translations</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Updated At</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingConfigs ? (
              [1, 2, 3].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid var(--news-glass-border)' }}>
                  <td colSpan={5} style={{ padding: '20px' }}>
                    <div className="nv-skeleton" style={{ height: 20, borderRadius: 2 }} />
                  </td>
                </tr>
              ))
            ) : (
              configsData?.configs.map((config) => (
                <tr 
                  key={config.country}
                  onClick={() => openModal(config)}
                  style={{ 
                    borderBottom: '1px solid var(--news-glass-border)', 
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--news-table-header-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--news-text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <CountryFlag country={config.country} size={28} />
                      {config.country}
                    </div>
                  </td>

                  {/* Native Language Column */}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ 
                      color: config.missing_native_language ? '#ff4d6d' : '#D4AF37', 
                      fontSize: '0.8rem', 
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {countryDetails[config.country]?.locale || config.country.substring(0, 2)}
                    </span>
                  </td>

                  <td style={{ padding: '14px 20px' }}>
                    {config.missing_native_language ? (
                      <span style={{ color: '#ff4d6d', fontSize: '0.75rem', fontWeight: 600 }}>Missing Native</span>
                    ) : (
                      <span style={{ color: '#2ecc71', fontSize: '0.75rem', fontWeight: 600 }}>Ready</span>
                    )}
                  </td>

                  {/* Language chips */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {config.languages.length === 0 ? (
                        <span style={{ color: 'var(--news-text-dim)', fontStyle: 'italic', fontSize: '0.8rem' }}>None configured</span>
                      ) : (
                        config.languages.map(lang => (
                          <span key={lang} style={{ background: 'var(--news-table-header-bg)', border: '1px solid var(--news-glass-border)', color: 'var(--news-text-main)', padding: '3px 9px', borderRadius: 3, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.3px' }}>
                            {lang.toUpperCase()}
                          </span>
                        ))
                      )}
                    </div>
                  </td>

                  {/* Updated At Column */}
                  <td style={{ padding: '14px 20px', color: 'var(--news-text-dim)', fontSize: '0.75rem' }}>
                    {config.updated_at ? new Date(config.updated_at).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Part B: Language Editor Modal (Glassmorphism Portal) */}
      {isModalOpen && createPortal(
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" 
          style={{ zIndex: 9999, background: 'var(--news-panel-overlay)', backdropFilter: 'blur(12px)' }}
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="sharp-border shadow-lg" 
            style={{ 
              width: '90%', 
              maxWidth: '650px', 
              maxHeight: '85vh', 
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--news-modal-bg)', 
              border: '1px solid var(--news-glass-border)', 
              borderRadius: '4px',
              overflow: 'hidden',
              animation: 'modalEntrance 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="d-flex justify-content-between align-items-center p-4 pb-3" style={{ borderBottom: '1px solid var(--news-glass-border)' }}>
              <div>
                <h4 style={{ color: '#D4AF37', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Localization Matrix</h4>
                <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.82rem', marginTop: '4px' }}>
                  Managing translations for <strong style={{ color: 'var(--news-text-main)' }}>{selectedCountry}</strong>
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--news-text-dim)', cursor: 'pointer', padding: 4 }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div 
              style={{ 
                padding: '24px', 
                overflowY: 'auto', 
                flex: 1,
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--news-scroll-thumb) var(--news-scroll-track)'
              }}
              className="news-modal-scroll"
            >
              {/* Native Language Highlight */}
              <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px dashed rgba(212,175,55,0.3)', borderRadius: 4, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#D4AF37', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Native Pipeline Language</div>
                  <div style={{ color: 'var(--news-text-main)', fontSize: '0.95rem', fontWeight: 700 }}>
                    {countryDetails[selectedCountry]?.locale?.toUpperCase() || selectedCountry.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <Globe size={24} color="#D4AF37" style={{ opacity: 0.5 }} />
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--news-text-dim)' }} />
                <input 
                  type="text" 
                  placeholder="Search languages..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', background: 'var(--news-input-bg)', border: '1px solid var(--news-glass-border)', color: 'var(--news-text-main)', padding: '10px 12px 10px 40px', borderRadius: 4, outline: 'none', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ color: 'var(--news-text-main)', fontWeight: 700, fontSize: '0.85rem', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select Translation Targets
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                gap: 12 
              }}>
                {filteredLangs.map((lang) => {
                  const isSelected = tempLanguages.includes(lang.code);
                  const isNative = lang.code === countryDetails[selectedCountry]?.locale;
                  
                  return (
                    <div 
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      style={{
                        background: isSelected ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSelected ? '#D4AF37' : 'var(--news-glass-border)'}`,
                        color: isSelected ? (isSelected && isNative ? '#fff' : '#D4AF37') : 'var(--news-text-main)',
                        padding: '10px 14px',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 0 10px rgba(212,175,55,0.1)' : 'none',
                        position: 'relative'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lang.name}
                      </span>
                      {isSelected ? <Check size={14} color="#D4AF37" /> : <div style={{ width: 14 }} />}
                      {isNative && (
                        <div style={{ position: 'absolute', top: -6, right: -6, background: '#D4AF37', color: '#000', fontSize: '0.5rem', padding: '2px 4px', borderRadius: 2, fontWeight: 900 }}>NATIVE</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 d-flex justify-content-end gap-3" style={{ borderTop: '1px solid var(--news-glass-border)', background: 'var(--news-table-header-bg)' }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: '1px solid var(--news-glass-border)', color: 'var(--news-text-dim)', padding: '8px 20px', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={updateMutation.isPending}
                style={{ 
                  background: '#D4AF37', 
                  color: '#000', 
                  border: 'none', 
                  padding: '8px 28px', 
                  borderRadius: 4, 
                  fontWeight: 800, 
                  cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateMutation.isPending ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {updateMutation.isPending ? 'Saving...' : <><Save size={18} /> Update Pipeline</>}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes modalEntrance {
              from { opacity: 0; transform: scale(0.95) translateY(10px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
}
