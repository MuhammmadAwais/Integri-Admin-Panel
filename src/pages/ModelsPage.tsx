import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ModelsService } from 'api/backendApi';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import MainCard from 'components/MainCard';
import { Cpu, Info, Layers } from 'lucide-react';

export default function ModelsPage() {
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

  return (
    <div className="position-relative" style={{ minHeight: '80vh' }}>
      <Row className="mb-4">
        <Col md={12}>
          <div className="glass-morphism sharp-border p-4 d-flex align-items-center gap-3">
            <Info size={24} color="#D4AF37" />
            <div>
              <h4 style={{ color: '#D4AF37', margin: 0, fontWeight: 600 }}>Active Intelligence Models</h4>
              <p style={{ color: '#a8956b', margin: 0, marginTop: '4px' }}>
                These are the currently active AI models available across the Integri platform. Tiers and access permissions are managed via the User Tier configurations.
              </p>
            </div>
          </div>
        </Col>
      </Row>

      {isLoading ? (
        <Row className="g-4">
          {[1, 2, 3].map(group => (
            <Col md={12} key={`group-${group}`}>
              <h5 style={{ color: '#D4AF37', marginBottom: '1rem' }} className="placeholder-glow">
                <span className="placeholder col-2 bg-secondary"></span>
              </h5>
              <Row className="g-3">
                {[1, 2, 3, 4].map(card => (
                  <Col md={3} sm={6} key={`card-${card}`}>
                    <div className="glass-morphism sharp-border p-3 h-100 placeholder-glow">
                       <span className="placeholder col-8 bg-secondary mb-2 d-block"></span>
                       <span className="placeholder col-4 bg-secondary"></span>
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>
          ))}
        </Row>
      ) : isError || !models ? (
        <div className="text-center p-5 mt-5 text-danger">Failed to load active AI models.</div>
      ) : (
        <Row className="g-4">
          {Object.entries(groupedModels).map(([groupName, groupModels]) => (
            <Col md={12} key={groupName}>
              <h5 style={{ color: '#D4AF37', marginBottom: '1rem', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} /> {groupName}
              </h5>
              <Row className="g-3">
                {groupModels.map(model => (
                  <Col md={3} sm={6} key={model}>
                    <div className="glass-morphism sharp-border p-3 h-100 d-flex align-items-start gap-3 transition hover-scale" style={{ cursor: 'default' }}>
                      <Cpu size={20} color="#D4AF37" style={{ opacity: 0.8 }} className="flex-shrink-0 mt-1" />
                      <div>
                        <div style={{ color: '#e0d5b8', fontWeight: 600, fontSize: '0.95rem', wordBreak: 'break-all' }}>
                          {model}
                        </div>
                        <div style={{ color: '#a8956b', fontSize: '0.75rem', marginTop: '4px', textTransform: 'uppercase' }}>
                          Status: Active
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
