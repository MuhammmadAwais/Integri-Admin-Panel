import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ModelsService } from 'api/backendApi';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Cpu, Info, Layers, Zap, Globe, Box, Terminal, Activity } from 'lucide-react';
import { useSelector } from 'react-redux';

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

export default function ModelsPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark);

  const { data: models, isLoading, isError } = useQuery({
    queryKey: ['aiModels'],
    queryFn: ModelsService.fetchModels,
  });

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

    // Remove empty groups
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

  return (
    <div className="position-relative" style={{ minHeight: '80vh', paddingBottom: '40px' }}>
      {/* ── Internal Styles for Hover & Glassmorphism ── */}
      <style>{`
        .models-header-card {
          background: ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)'};
          backdrop-filter: blur(10px);
          border: 1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(212, 175, 55, 0.6)'};
          border-radius: 4px;
        }
        
        .model-card {
          background: ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)'};
          backdrop-filter: blur(10px);
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          border-radius: 4px;
          transition: all 0.3s ease;
          cursor: default;
        }
        
        .model-card:hover {
          background: ${isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)'};
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)'};
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
      `}</style>

      {/* ── Header ── */}
      <Row className="mb-5">
        <Col md={12}>
          <div className="models-header-card p-4 d-flex align-items-center gap-3">
            <Info size={26} color="#D4AF37" className="flex-shrink-0" />
            <div>
              <h4 style={{ color: isDark ? '#D4AF37' : '#b48a04', margin: 0, fontWeight: 700 }}>Active Intelligence Models</h4>
              <p style={{ color: isDark ? '#a8956b' : '#52525b', margin: 0, marginTop: '6px', fontSize: '0.9rem', fontWeight: 500 }}>
                These are the currently active AI models available across the Integri platform. Tiers and access permissions are managed via the User Tier configurations.
              </p>
            </div>
          </div>
        </Col>
      </Row>

      {/* ── Content ── */}
      {isLoading ? (
        <Row className="g-5">
          {[1, 2, 3].map(group => (
            <Col md={12} key={`group-${group}`}>
              <h5 style={{ color: '#D4AF37', marginBottom: '1.2rem' }} className="placeholder-glow">
                <span className="placeholder col-2 bg-secondary rounded"></span>
              </h5>
              <Row className="g-3">
                {[1, 2, 3, 4].map(card => (
                  <Col xl={3} lg={4} md={6} sm={12} key={`card-${card}`}>
                    <div className="model-card p-3 h-100 placeholder-glow d-flex gap-3 align-items-center">
                       <span className="placeholder rounded-circle bg-secondary" style={{ width: '28px', height: '28px' }}></span>
                       <div className="flex-grow-1">
                         <span className="placeholder col-10 bg-secondary mb-2 d-block rounded"></span>
                         <span className="placeholder col-6 bg-secondary rounded"></span>
                       </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>
          ))}
        </Row>
      ) : isError || !models ? (
        <div className="text-center p-5 mt-5 text-danger font-weight-bold">Failed to load active AI models.</div>
      ) : (
        <Row className="g-5">
          {Object.entries(groupedModels).map(([groupName, groupModels]) => (
            <Col md={12} key={groupName}>
              <h5 
                style={{ 
                  color: isDark ? '#D4AF37' : '#b48a04', 
                  marginBottom: '1.2rem', 
                  borderBottom: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.4)'}`, 
                  paddingBottom: '0.6rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontWeight: 700
                }}
              >
                {getGroupIcon(groupName)} {groupName}
              </h5>
              <Row className="g-3">
                {groupModels.map(model => (
                  <Col xl={3} lg={4} md={6} sm={12} key={model}>
                    <div className="model-card p-3 h-100 d-flex align-items-center gap-3">
                      
                      <ModelLogo groupName={groupName} isDark={isDark} />
                      
                      <div className="d-flex flex-column justify-content-center overflow-hidden">
                        <div 
                          style={{ 
                            color: isDark ? '#ffffff' : '#000000', 
                            fontWeight: 700, 
                            fontSize: '0.9rem', 
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={model}
                        >
                          {model}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <span style={{ color: isDark ? '#71717a' : '#a1a1aa', fontSize: '0.7rem', fontWeight: 600 }}>
                            STATUS:
                          </span>
                          <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            ACTIVE
                          </span>
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
    </div>
  );
}
