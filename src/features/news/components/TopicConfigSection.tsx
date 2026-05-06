import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NewsService, TopicConfig } from 'api/backendApi';
// @ts-ignore
import MainCard from 'components/MainCard';
import CountryFlag from 'components/CountryFlag';
import { X, Plus, Filter, Search, Globe, Save } from 'lucide-react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

const TOPIC_COLORS = [
  'rgba(212, 175, 55, 0.15)', // Gold
  'rgba(46, 204, 113, 0.15)',  // Emerald
  'rgba(52, 152, 219, 0.15)',  // Blue
  'rgba(155, 89, 182, 0.15)',  // Amethyst
  'rgba(230, 126, 34, 0.15)',  // Orange
];

const TOPIC_TEXT_COLORS = [
  '#D4AF37',
  '#2ecc71',
  '#3498db',
  '#9b59b2',
  '#e67e22',
];

const getTopicStyle = (index: number) => ({
  background: TOPIC_COLORS[index % TOPIC_COLORS.length],
  color: TOPIC_TEXT_COLORS[index % TOPIC_TEXT_COLORS.length],
  border: `1px solid ${TOPIC_TEXT_COLORS[index % TOPIC_TEXT_COLORS.length]}44`,
  padding: '2px 8px',
  borderRadius: 3,
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.3px',
  textTransform: 'uppercase' as const
});

const InputToChip = ({ items, onChange, placeholder, allowDuplicates = false }: { items: string[], onChange: (items: string[]) => void, placeholder: string, allowDuplicates?: boolean }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const newItem = inputValue.trim().toLowerCase();
      if (allowDuplicates || !items.includes(newItem)) {
        onChange([...items, newItem]);
      }
      setInputValue('');
    }
  };

  const removeChip = (indexToRemove: number) => {
    onChange(items.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="d-flex flex-wrap gap-2 align-items-center" style={{ border: '1px solid var(--news-glass-border)', padding: '10px', borderRadius: '4px', background: 'var(--news-input-bg)' }}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="d-flex align-items-center gap-1" style={{ padding: '4px 10px', borderRadius: '4px', background: 'var(--news-table-header-bg)', color: 'var(--news-text-main)', fontSize: '0.8rem', border: '1px solid var(--news-glass-border)', cursor: 'default' }}>
          {item}
          <X size={14} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={() => removeChip(index)} />
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--news-text-main)', fontSize: '0.85rem', flex: 1, minWidth: '150px' }}
      />
    </div>
  );
};

const HybridTopicInput = ({ items, onChange, supportedTopics }: { items: string[], onChange: (items: string[]) => void, supportedTopics: string[] }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const newItem = inputValue.trim().toLowerCase();
      if (!items.includes(newItem)) {
        onChange([...items, newItem]);
      }
      setInputValue('');
    }
  };

  const addTopic = (topic: string) => {
    if (!items.includes(topic)) {
      onChange([...items, topic]);
    }
  };

  const removeTopic = (topicToRemove: string) => {
    onChange(items.filter(t => t !== topicToRemove));
  };

  const availableSuggestions = supportedTopics.filter(t => !items.includes(t) && t.includes(inputValue.toLowerCase()));

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2" style={{ border: '1px solid var(--news-glass-border)', padding: '12px', borderRadius: '4px', background: 'var(--news-input-bg)' }}>
        {items.map((item, idx) => (
          <span key={item} className="d-flex align-items-center gap-1" style={getTopicStyle(idx)}>
            {item}
            <X size={14} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={() => removeTopic(item)} />
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type custom slug and press enter..."
          style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--news-text-main)', fontSize: '0.85rem', flex: 1, minWidth: '200px' }}
        />
      </div>
      {availableSuggestions.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-2">
          <span style={{ color: 'var(--news-text-dim)', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}>Suggestions:</span>
          {availableSuggestions.slice(0, 8).map(suggestion => (
            <span 
              key={suggestion} 
              onClick={() => addTopic(suggestion)}
              style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', background: 'var(--news-table-header-bg)', color: 'var(--news-text-muted)', fontSize: '0.75rem', border: '1px dashed var(--news-glass-border)', transition: 'all 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#D4AF37'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--news-text-muted)'}
            >
              <Plus size={10} className="me-1" />{suggestion}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default function TopicConfigSection({ countryDetails }: { countryDetails: Record<string, any> }) {
  const queryClient = useQueryClient();
  const [selectedConfig, setSelectedConfig] = useState<TopicConfig | null>(null);

  // Form State
  const [topics, setTopics] = useState<string[]>([]);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [excludeDomains, setExcludeDomains] = useState<string[]>([]);
  const [rawLimit, setRawLimit] = useState<number>(10);

  const { data: supportedData } = useQuery({
    queryKey: ['supportedTopics'],
    queryFn: NewsService.fetchSupportedTopics
  });

  const { data: allConfigsData, isLoading } = useQuery({
    queryKey: ['allTopicConfigs'],
    queryFn: NewsService.fetchAllTopicConfigs
  });

  const supportedTopics = useMemo(() => {
    if (!supportedData) return [];
    return supportedData.categories.map(c => c.slug);
  }, [supportedData]);

  const updateMutation = useMutation({
    mutationFn: ({ country, config }: { country: string, config: Partial<TopicConfig> }) => 
      NewsService.updateTopicConfig(country, config),
    onMutate: async ({ country, config }) => {
      await queryClient.cancelQueries({ queryKey: ['allTopicConfigs'] });
      const previousConfigs = queryClient.getQueryData(['allTopicConfigs']);
      
      queryClient.setQueryData(['allTopicConfigs'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          configs: old.configs.map((c: TopicConfig) => 
            c.country === country ? { ...c, ...config } : c
          )
        };
      });
      return { previousConfigs };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['allTopicConfigs'], context?.previousConfigs);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['allTopicConfigs'] });
      closeModal();
    }
  });

  useEffect(() => {
    if (selectedConfig) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedConfig]);

  const openModal = (config: TopicConfig) => {
    setSelectedConfig(config);
    setTopics([...config.topics]);
    setSearchTerms([...config.search_terms]);
    setDomains([...config.domains]);
    setExcludeDomains([...config.exclude_domains]);
    setRawLimit(config.raw_limit_per_topic || 10);
  };

  const closeModal = () => {
    setSelectedConfig(null);
  };

  const handleSave = () => {
    if (!selectedConfig) return;
    
    // Validation
    const limit = Math.max(1, Math.min(50, Number(rawLimit) || 10));
    
    updateMutation.mutate({
      country: selectedConfig.country,
      config: {
        topics,
        search_terms: searchTerms,
        domains,
        exclude_domains: excludeDomains,
        raw_limit_per_topic: limit
      }
    });
  };

  return (
    <div className="mt-5 position-relative">
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Filter size={20} color="#D4AF37" />
        <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
          Topic & Fetch Configuration
        </h3>
      </div>
      <p style={{ color: 'var(--news-text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
        Control which topics, search terms, and domains are fetched for each country pipeline.
      </p>

      <div style={{ background: 'var(--news-glass-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--news-glass-border)', borderRadius: 4, overflow: 'hidden', boxShadow: 'var(--news-card-shadow)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--news-table-header-bg)', borderBottom: '1px solid var(--news-glass-border)', color: 'var(--news-text-dim)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <tr>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Country</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Active Topics</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Search Terms</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Domain Filters</th>
              <th style={{ padding: '14px 20px', fontWeight: 700 }}>Raw Limit</th>
            </tr>
          </thead>
          <tbody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--news-glass-border)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="nv-skeleton" style={{ width: 32, height: 24, borderRadius: 2 }} />
                        <div className="nv-skeleton" style={{ height: 18, width: 120 }} />
                      </div>
                    </td>
                    <td colSpan={4} style={{ padding: '14px 20px' }}>
                      <div className="nv-skeleton" style={{ height: 18 }} />
                    </td>
                  </tr>
                ))
              ) : allConfigsData?.configs.map((config) => (
                <tr
                  key={config.country}
                  onClick={() => openModal(config)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--news-glass-border)', transition: 'background-color 0.2s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--news-table-header-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Country column with flag */}
                  <td style={{ borderBottom: 'none', padding: '14px 20px', fontWeight: 700, color: 'var(--news-text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <CountryFlag country={config.country} size={28} />
                      {config.country}
                      {config.is_default && (
                        <span style={{ padding: '2px 7px', borderRadius: 3, background: 'rgba(212,175,55,0.12)', color: '#D4AF37', fontSize: '0.62rem', border: '1px solid rgba(212,175,55,0.3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>Default</span>
                      )}
                    </div>
                  </td>
                  {/* Topics chips */}
                  <td style={{ borderBottom: 'none', padding: '14px 20px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {config.topics.slice(0, 3).map((t, idx) => (
                        <span key={t} style={getTopicStyle(idx)}>{t}</span>
                      ))}
                      {config.topics.length > 3 && (
                        <span style={{ padding: '2px 8px', borderRadius: 3, background: 'var(--news-table-header-bg)', color: 'var(--news-text-dim)', fontSize: '0.72rem', border: '1px solid var(--news-glass-border)' }}>+{config.topics.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: 'var(--news-text-muted)', borderBottom: 'none', fontSize: '0.85rem', padding: '14px 20px' }}>
                    {config.search_terms.length} Terms
                  </td>
                  <td style={{ color: 'var(--news-text-muted)', borderBottom: 'none', fontSize: '0.85rem', padding: '14px 20px' }}>
                    {config.domains.length} Inc / {config.exclude_domains.length} Exc
                  </td>
                  <td style={{ color: 'var(--news-text-main)', borderBottom: 'none', fontWeight: 700, padding: '14px 20px' }}>
                    {config.raw_limit_per_topic}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Advanced Topic Editor Modal (Portal) */}
      {selectedConfig && createPortal(
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" 
          style={{ zIndex: 9999, background: 'var(--news-panel-overlay)', backdropFilter: 'blur(12px)' }}
          onClick={closeModal}
        >
          <div 
            className="sharp-border shadow-lg" 
            style={{ 
              width: '90%', 
              maxWidth: '800px', 
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
                <h4 style={{ color: '#D4AF37', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Advanced Topic Editor</h4>
                <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.85rem', marginTop: '4px' }}>
                  Configuring fetch pipeline for <strong style={{ color: 'var(--news-text-main)' }}>{selectedConfig.country}</strong>
                </p>
              </div>
              <button 
                onClick={closeModal} 
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
              <Row className="g-4">
                <Col md={12}>
                  <div style={{ background: 'rgba(212,175,55,0.03)', padding: '20px', borderRadius: '4px', border: '1px solid var(--news-glass-border)' }}>
                    <label style={{ color: '#D4AF37', fontWeight: 800, fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <Filter size={18} /> Main Topics
                    </label>
                    <p style={{ color: 'var(--news-text-dim)', fontSize: '0.78rem', marginBottom: '16px', lineHeight: 1.5 }}>
                      Select from supported categories or enter custom slugs. Unlisted slugs route as search queries.
                    </p>
                    <HybridTopicInput items={topics} onChange={setTopics} supportedTopics={supportedTopics} />
                  </div>
                </Col>

                <Col md={12}>
                  <div style={{ background: 'rgba(52, 152, 219, 0.03)', padding: '20px', borderRadius: '4px', border: '1px solid var(--news-glass-border)' }}>
                    <label style={{ color: '#3498db', fontWeight: 800, fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <Search size={18} /> Custom Search Terms
                    </label>
                    <p style={{ color: 'var(--news-text-dim)', fontSize: '0.78rem', marginBottom: '16px', lineHeight: 1.5 }}>
                      Fine-tune results with specific keywords. These are merged with selected topics during fetching.
                    </p>
                    <InputToChip items={searchTerms} onChange={setSearchTerms} placeholder="Add search term..." />
                  </div>
                </Col>

                <Col md={6}>
                  <div style={{ background: 'rgba(46, 204, 113, 0.03)', padding: '20px', borderRadius: '4px', border: '1px solid var(--news-glass-border)', height: '100%' }}>
                    <label style={{ color: '#2ecc71', fontWeight: 800, fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <Globe size={18} /> Include Domains
                    </label>
                    <InputToChip items={domains} onChange={setDomains} placeholder="news.google.com..." />
                  </div>
                </Col>

                <Col md={6}>
                  <div style={{ background: 'rgba(231, 76, 60, 0.03)', padding: '20px', borderRadius: '4px', border: '1px solid var(--news-glass-border)', height: '100%' }}>
                    <label style={{ color: '#e74c3c', fontWeight: 800, fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <X size={18} /> Exclude Domains
                    </label>
                    <InputToChip items={excludeDomains} onChange={setExcludeDomains} placeholder="unwanted.com..." />
                  </div>
                </Col>

                <Col md={12}>
                  <div style={{ background: 'var(--news-table-header-bg)', padding: '20px', borderRadius: '4px', border: '1px solid var(--news-glass-border)', marginTop: '8px' }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <label style={{ color: '#D4AF37', fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raw Limit per Topic</label>
                        <p style={{ color: 'var(--news-text-muted)', fontSize: '0.75rem', margin: 0 }}>Max articles to fetch per active topic/term.</p>
                      </div>
                      <input 
                        type="number" 
                        value={rawLimit} 
                        onChange={(e) => setRawLimit(Number(e.target.value))}
                        style={{ 
                          width: '80px', 
                          background: 'var(--news-input-bg)', 
                          border: '1px solid #D4AF37', 
                          color: '#D4AF37', 
                          borderRadius: '4px', 
                          padding: '8px',
                          textAlign: 'center',
                          fontWeight: 700,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Modal Footer */}
            <div className="p-4 d-flex justify-content-end gap-3" style={{ borderTop: '1px solid var(--news-glass-border)', background: 'var(--news-table-header-bg)' }}>
              <button 
                onClick={closeModal} 
                style={{ background: 'transparent', color: 'var(--news-text-dim)', border: '1px solid var(--news-glass-border)', padding: '10px 24px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                className="btn d-flex align-items-center gap-2" 
                style={{ background: '#D4AF37', color: '#000', padding: '10px 32px', borderRadius: '4px', fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
              >
                <Save size={18} /> Save Changes
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
