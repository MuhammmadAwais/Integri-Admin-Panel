import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NewsService, TopicConfig } from 'api/backendApi';
// @ts-ignore
import MainCard from 'components/MainCard';
import { Settings, X, Plus, Filter, Search, Globe, ChevronRight } from 'lucide-react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

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
    <div className="d-flex flex-wrap gap-2 align-items-center" style={{ border: '1px solid rgba(212,175,55,0.2)', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="d-flex align-items-center gap-1" style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(212,175,55,0.1)', color: '#D4AF37', fontSize: '0.8rem', border: '1px solid rgba(212,175,55,0.3)' }}>
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
        style={{ border: 'none', outline: 'none', background: 'transparent', color: '#e0d5b8', fontSize: '0.85rem', flex: 1, minWidth: '150px' }}
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
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2" style={{ border: '1px solid rgba(212,175,55,0.2)', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
        {items.map((item) => (
          <span key={item} className="d-flex align-items-center gap-1" style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(212,175,55,0.1)', color: '#D4AF37', fontSize: '0.8rem', border: '1px solid rgba(212,175,55,0.3)' }}>
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
          style={{ border: 'none', outline: 'none', background: 'transparent', color: '#e0d5b8', fontSize: '0.85rem', flex: 1, minWidth: '200px' }}
        />
      </div>
      {availableSuggestions.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-2">
          <span style={{ color: '#a8956b', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}>Suggestions:</span>
          {availableSuggestions.slice(0, 8).map(suggestion => (
            <span 
              key={suggestion} 
              onClick={() => addTopic(suggestion)}
              style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#a8956b', fontSize: '0.75rem', border: '1px dashed rgba(255,255,255,0.2)', transition: 'all 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#D4AF37'}
              onMouseOut={(e) => e.currentTarget.style.color = '#a8956b'}
            >
              <Plus size={10} className="me-1" />{suggestion}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default function TopicConfigSection() {
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
      <MainCard 
        title={
          <div className="d-flex align-items-center gap-2">
            <Filter size={20} color="#D4AF37" />
            <span style={{ color: '#D4AF37' }}>Topic & Fetch Configuration</span>
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead style={{ background: 'rgba(212,175,55,0.05)' }}>
              <tr>
                <th style={{ color: '#D4AF37', borderBottom: 'none', paddingLeft: '24px' }}>Country</th>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Active Topics</th>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Search Terms</th>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Domain Filters</th>
                <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Raw Limit</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td colSpan={5} className="padding-left-24px">
                      <div className="placeholder-glow">
                        <span className="placeholder col-12 bg-secondary"></span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : allConfigsData?.configs.map((config) => (
                <tr 
                  key={config.country} 
                  onClick={() => openModal(config)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s ease' }}
                  className="hover-row"
                >
                  <td style={{ color: '#e0d5b8', borderBottom: 'none', paddingLeft: '24px' }}>
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontWeight: 600 }}>{config.country}</span>
                      {config.is_default && (
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(212,175,55,0.1)', color: '#D4AF37', fontSize: '0.65rem', border: '1px solid rgba(212,175,55,0.3)', textTransform: 'uppercase' }}>Default</span>
                      )}
                    </div>
                  </td>
                  <td style={{ borderBottom: 'none' }}>
                    <div className="d-flex flex-wrap gap-1">
                      {config.topics.slice(0, 3).map(t => (
                        <span key={t} style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#a8956b', fontSize: '0.75rem' }}>{t}</span>
                      ))}
                      {config.topics.length > 3 && <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#a8956b', fontSize: '0.75rem' }}>+{config.topics.length - 3}</span>}
                    </div>
                  </td>
                  <td style={{ color: '#a8956b', borderBottom: 'none', fontSize: '0.85rem' }}>
                    {config.search_terms.length} Terms
                  </td>
                  <td style={{ color: '#a8956b', borderBottom: 'none', fontSize: '0.85rem' }}>
                    {config.domains.length} Inc / {config.exclude_domains.length} Exc
                  </td>
                  <td style={{ color: '#e0d5b8', borderBottom: 'none', fontWeight: 600 }}>
                    {config.raw_limit_per_topic}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MainCard>

      {/* Advanced Topic Editor Modal */}
      {selectedConfig && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" 
          style={{ zIndex: 1050, background: 'rgba(5,5,5,0.8)', backdropFilter: 'blur(8px)' }}
        >
          <div className="glass-morphism sharp-border p-4" style={{ width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
              <div>
                <h4 style={{ color: '#D4AF37', margin: 0 }}>Advanced Topic Editor</h4>
                <p style={{ color: '#a8956b', margin: 0, fontSize: '0.85rem', marginTop: '4px' }}>Configuring fetch pipeline for <strong style={{ color: '#e0d5b8' }}>{selectedConfig.country}</strong></p>
              </div>
              <X size={24} color="#a8956b" style={{ cursor: 'pointer' }} onClick={closeModal} />
            </div>

            <Row className="g-4">
              <Col md={12}>
                <label style={{ color: '#e0d5b8', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={16} color="#D4AF37" /> Main Topics
                </label>
                <p style={{ color: '#a8956b', fontSize: '0.75rem', marginBottom: '8px' }}>Select from supported categories or enter custom slugs. Unlisted slugs route as search queries.</p>
                <HybridTopicInput items={topics} onChange={setTopics} supportedTopics={supportedTopics} />
              </Col>

              <Col md={12}>
                <label style={{ color: '#e0d5b8', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Search size={16} color="#D4AF37" /> Custom Search Terms
                </label>
                <p style={{ color: '#a8956b', fontSize: '0.75rem', marginBottom: '8px' }}>Specific keywords to monitor in this region (e.g., "Tech Summit 2026"). Press enter to add.</p>
                <InputToChip items={searchTerms} onChange={setSearchTerms} placeholder="Add search term..." allowDuplicates={false} />
              </Col>

              <Col md={6}>
                <label style={{ color: '#e0d5b8', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={16} color="#D4AF37" /> Included Domains
                </label>
                <p style={{ color: '#a8956b', fontSize: '0.75rem', marginBottom: '8px' }}>Only fetch articles from these specific websites.</p>
                <InputToChip items={domains} onChange={setDomains} placeholder="e.g., reuters.com" />
              </Col>

              <Col md={6}>
                <label style={{ color: '#e0d5b8', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <X size={16} color="#DC143C" /> Excluded Domains
                </label>
                <p style={{ color: '#a8956b', fontSize: '0.75rem', marginBottom: '8px' }}>Articles from these websites will never be fetched.</p>
                <InputToChip items={excludeDomains} onChange={setExcludeDomains} placeholder="e.g., tabloid.com" />
              </Col>

              <Col md={12}>
                <label style={{ color: '#e0d5b8', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Settings size={16} color="#D4AF37" /> Fetch Tuning
                </label>
                <p style={{ color: '#a8956b', fontSize: '0.75rem', marginBottom: '8px' }}>Raw article limit per topic per run (Min: 1, Max: 50).</p>
                <input 
                  type="number" 
                  min="1" 
                  max="50" 
                  value={rawLimit}
                  onChange={(e) => setRawLimit(parseInt(e.target.value) || 1)}
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', padding: '8px 12px', borderRadius: '4px', width: '100px', outline: 'none' }}
                />
              </Col>
            </Row>

            <div className="d-flex justify-content-end gap-3 mt-4 pt-3" style={{ borderTop: '1px solid rgba(212,175,55,0.2)' }}>
              <button 
                className="btn btn-link" 
                style={{ color: '#a8956b', textDecoration: 'none' }}
                onClick={closeModal}
                disabled={updateMutation.isPending}
              >
                Cancel
              </button>
              <button 
                className="btn d-flex align-items-center gap-2" 
                style={{ background: '#D4AF37', color: '#050505', fontWeight: 600, border: 'none', borderRadius: '4px', padding: '8px 20px' }}
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Configuration'} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
