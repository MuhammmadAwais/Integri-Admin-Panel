import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NewsService } from 'api/backendApi';
import { AlertTriangle, Globe, X, Check, Search, Save } from 'lucide-react';
import 'features/news/styles/news.scss';

type Toast = { message: string; type: 'success' | 'error' } | null;

export default function LanguageConfigSection() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<Toast>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [tempLanguages, setTempLanguages] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ==========================================
  // QUERIES
  // ==========================================
  const { data: supportedLangsData, isLoading: isLoadingSupported } = useQuery({
    queryKey: ['supported-languages'],
    queryFn: () => NewsService.fetchSupportedLanguages(),
    staleTime: Infinity, // Caches globally as it rarely changes
  });

  const { data: configsData, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['all-country-langs'],
    queryFn: () => NewsService.fetchAllCountryLangConfigs()
  });

  // Fetch specific country config when modal opens
  const { data: specificConfigData, isLoading: isLoadingSpecificConfig } = useQuery({
    queryKey: ['country-lang-config', selectedCountry],
    queryFn: () => NewsService.fetchCountryLangConfig(selectedCountry as string),
    enabled: !!selectedCountry && isModalOpen,
  });

  // Sync modal state with fetched data
  useEffect(() => {
    if (specificConfigData?.config) {
      setTempLanguages([...specificConfigData.config.languages]);
    }
  }, [specificConfigData]);

  // ==========================================
  // MUTATIONS
  // ==========================================
  const updateLangsMutation = useMutation({
    mutationFn: ({ country, languages }: { country: string; languages: string[] }) => 
      NewsService.updateCountryLanguages(country, languages),
    onMutate: async (variables) => {
      // Optimistic Updates
      await queryClient.cancelQueries({ queryKey: ['all-country-langs'] });
      const previous = queryClient.getQueryData(['all-country-langs']);
      
      queryClient.setQueryData(['all-country-langs'], (old: any) => {
        if (!old || !old.configs) return old;
        return {
          ...old,
          configs: old.configs.map((c: any) => 
            c.country === variables.country 
              ? { ...c, languages: variables.languages }
              : c
          )
        };
      });
      return { previous };
    },
    onError: (err: any, variables, context) => {
      queryClient.setQueryData(['all-country-langs'], context?.previous);
      
      // Handle specifically unsupported language errors if the API throws
      if (err?.response?.data?.detail === 'value_error' || err?.message?.includes('value_error')) {
        showToast('Error: Unsupported language code provided.', 'error');
      } else {
        showToast('Failed to update languages.', 'error');
      }
    },
    onSuccess: () => {
      showToast('Languages updated successfully.', 'success');
      setIsModalOpen(false);
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['all-country-langs'] });
      // Also invalidate specific country cache so it re-fetches next time opened
      queryClient.invalidateQueries({ queryKey: ['country-lang-config', variables.country] });
    }
  });

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleRowClick = (country: string) => {
    setSelectedCountry(country);
    setSearchTerm('');
    setTempLanguages([]); // Reset temp array
    setIsModalOpen(true);
  };

  const toggleLanguage = (code: string) => {
    setTempLanguages(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSave = () => {
    if (!selectedCountry) return;
    updateLangsMutation.mutate({ country: selectedCountry, languages: tempLanguages });
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================
  const configs = configsData?.configs || [];
  const supportedLangs = supportedLangsData?.languages || [];
  
  const filteredLangs = supportedLangs.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ marginTop: 40, marginBottom: 40 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'success' ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)',
          color: '#fff', padding: '12px 24px', borderRadius: 4, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)'
        }}>
          {toast.message}
        </div>
      )}

      <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.2rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Globe size={20} color="#D4AF37" /> Language Configurations
      </h3>
      <p style={{ color: 'var(--news-text-muted)', fontSize: '0.85rem', marginBottom: 24 }}>
        Manage target translation languages for each country pipeline.
      </p>

      {/* Part A: Translation Overview Table */}
      <div style={{ background: 'var(--news-card-bg)', border: '1px solid var(--news-card-border)', borderRadius: 4, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--news-card-border)', color: 'var(--news-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Country</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Active Translations</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingConfigs ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '12px 16px', width: 200 }}><div className="nv-skeleton" style={{ height: 20 }} /></td>
                  <td style={{ padding: '12px 16px', width: 150 }}><div className="nv-skeleton" style={{ height: 20 }} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div className="nv-skeleton" style={{ height: 24, width: 40, borderRadius: 12 }} />
                      <div className="nv-skeleton" style={{ height: 24, width: 40, borderRadius: 12 }} />
                    </div>
                  </td>
                </tr>
              ))
            ) : configs.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--news-text-dim)' }}>No configurations found.</td></tr>
            ) : (
              configs.map((config) => (
                <tr 
                  key={config.country} 
                  onClick={() => handleRowClick(config.country)}
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.03)', 
                    color: 'var(--news-text-main)', 
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{config.country}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {config.is_default && (
                        <span style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)', padding: '2px 6px', borderRadius: 2, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          Global Default
                        </span>
                      )}
                      {config.missing_native_language && (
                        <span title="Missing Native Language" style={{ color: '#f39c12', display: 'flex', alignItems: 'center' }}>
                          <AlertTriangle size={16} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {config.languages.length === 0 ? (
                        <span style={{ color: 'var(--news-text-dim)', fontStyle: 'italic' }}>None</span>
                      ) : (
                        config.languages.map(lang => (
                          <span key={lang} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500 }}>
                            {lang.toUpperCase()}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Part B: Language Editor Modal (Glassmorphism) */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#121212', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 4,
            width: 600, maxWidth: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#D4AF37', margin: 0, fontSize: '1.2rem' }}>Configure Languages</h3>
                <p style={{ margin: '4px 0 0 0', color: 'var(--news-text-muted)', fontSize: '0.8rem' }}>{selectedCountry}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--news-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }} className="obsidian-scroll">
              {isLoadingSupported || isLoadingSpecificConfig ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                  {[...Array(12)].map((_, i) => <div key={i} className="nv-skeleton" style={{ height: 36, borderRadius: 18 }} />)}
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative', marginBottom: 20 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--news-text-dim)' }} />
                    <input 
                      type="text" 
                      placeholder="Search languages..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px 8px 36px', borderRadius: 4, outline: 'none', fontSize: '0.85rem' }}
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                    {filteredLangs.map(lang => {
                      const isSelected = tempLanguages.includes(lang.code);
                      return (
                        <div 
                          key={lang.code}
                          onClick={() => toggleLanguage(lang.code)}
                          style={{
                            background: isSelected ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isSelected ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.1)'}`,
                            color: isSelected ? '#D4AF37' : 'var(--news-text-main)',
                            padding: '8px 12px',
                            borderRadius: 18,
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lang.name} <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>({lang.code})</span>
                          </span>
                          {isSelected && <Check size={14} />}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: 24, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={updateLangsMutation.isPending || isLoadingSpecificConfig}
                style={{ background: '#D4AF37', border: 'none', color: '#000', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Save size={14} /> {updateLangsMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
