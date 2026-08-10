import React from 'react';
import { Plus, X } from 'lucide-react';
import { MemorySeedPayload } from 'api/backendApi';

interface MemorySeedFormProps {
  payload: MemorySeedPayload;
  onChange: (payload: MemorySeedPayload) => void;
  isDark?: boolean;
}

export const sanitizeMemoryPayload = (payload: MemorySeedPayload): MemorySeedPayload => {
  const sanitized: any = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      if (value.trim() !== '') {
        sanitized[key] = value.trim();
      }
    } else if (Array.isArray(value)) {
      if (key === 'interests') {
        const validInterests = value.filter((i: any) => i.name && i.name.trim() !== '');
        if (validInterests.length > 0) sanitized[key] = validInterests;
      } else if (key === 'notable_facts' || key === 'languages_spoken' || key === 'domains') {
        const validArr = value.filter((s: string) => typeof s === 'string' && s.trim() !== '');
        if (validArr.length > 0) sanitized[key] = validArr;
      } else if (value.length > 0) {
        sanitized[key] = value;
      }
    } else if (value !== undefined && value !== null) {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const TagInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  isDark?: boolean;
}> = ({ tags = [], onChange, placeholder, isDark }) => {
  const [inputValue, setInputValue] = React.useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '،' || e.key === '，') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const val = inputValue.trim().replace(/[,،，]/g, '');
    if (val && !tags.includes(val)) {
      const newTags = [...tags, val];
      onChange(newTags);
      setInputValue('');
    }
  };

  const removeTag = (indexToRemove: number) => {
    const newTags = tags.filter((_, idx) => idx !== indexToRemove);
    onChange(newTags);
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '6px 8px',
    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: '6px',
    alignItems: 'center',
    minHeight: '40px'
  };

  const inputStyle: React.CSSProperties = {
    flex: '1 1 120px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: isDark ? '#e0d5b8' : '#333',
    fontSize: '0.85rem',
    padding: '4px 0'
  };

  const pillStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(212,175,55,0.15)',
    border: '1px solid rgba(212,175,55,0.4)',
    color: '#D4AF37',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 600,
  };

  const deleteBtnStyle: React.CSSProperties = {
    marginLeft: '6px',
    cursor: 'pointer',
    opacity: 0.8,
    display: 'inline-flex',
    alignItems: 'center',
    border: 'none',
    background: 'none',
    padding: 0,
    color: '#D4AF37'
  };

  return (
    <div style={containerStyle}>
      {tags.map((tag, idx) => (
        <span key={tag} style={pillStyle}>
          {tag}
          <button type="button" onClick={() => removeTag(idx)} style={deleteBtnStyle}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        dir="auto"
        placeholder={tags.length === 0 ? placeholder : ''}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        style={inputStyle}
      />
    </div>
  );
};

export const MemorySeedForm: React.FC<MemorySeedFormProps> = ({ payload, onChange, isDark = true }) => {
  const handleChange = (field: keyof MemorySeedPayload, value: any) => {
    onChange({ ...payload, [field]: value });
  };

  const handleArrayChange = (field: keyof MemorySeedPayload, value: string) => {
    const arr = value.split(',').map(s => s.trim()).filter(Boolean);
    if (value === '') {
      onChange({ ...payload, [field]: [] });
    } else {
      handleChange(field, arr);
    }
  };

  const addInterest = () => {
    const interests = payload.interests || [];
    handleChange('interests', [...interests, { name: '', score: 1 }]);
  };

  const updateInterest = (index: number, key: string, value: any) => {
    const interests = [...(payload.interests || [])];
    interests[index] = { ...interests[index], [key]: value };
    handleChange('interests', interests);
  };

  const removeInterest = (index: number) => {
    const interests = [...(payload.interests || [])];
    interests.splice(index, 1);
    handleChange('interests', interests);
  };

  const addFact = () => {
    const facts = payload.notable_facts || [];
    handleChange('notable_facts', [...facts, '']);
  };

  const updateFact = (index: number, value: string) => {
    const facts = [...(payload.notable_facts || [])];
    facts[index] = value;
    handleChange('notable_facts', facts);
  };

  const removeFact = (index: number) => {
    const facts = [...(payload.notable_facts || [])];
    facts.splice(index, 1);
    handleChange('notable_facts', facts);
  };

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
    border: '1px solid rgba(212,175,55,0.3)',
    color: isDark ? '#e0d5b8' : '#333',
    padding: '8px 12px',
    borderRadius: '6px',
    width: '100%',
    fontSize: '0.9rem',
    outline: 'none',
  };

  const labelStyle = {
    color: '#a8956b',
    fontSize: '0.8rem',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
    display: 'block',
    fontWeight: 600,
  };

  return (
    <div className="memory-seed-form row g-3">
      <div className="col-md-6">
        <label style={labelStyle}>Estimated Age</label>
        <input 
          style={inputStyle} 
          placeholder="e.g. 25-34" 
          maxLength={20}
          value={payload.estimated_age || ''} 
          onChange={e => handleChange('estimated_age', e.target.value)} 
        />
      </div>
      <div className="col-md-6">
        <label style={labelStyle}>Gender</label>
        <input 
          style={inputStyle} 
          placeholder="e.g. female" 
          maxLength={50}
          value={payload.gender || ''} 
          onChange={e => handleChange('gender', e.target.value)} 
        />
      </div>
      <div className="col-md-6">
        <label style={labelStyle}>Occupation</label>
        <input 
          style={inputStyle} 
          placeholder="e.g. product manager" 
          maxLength={200}
          value={payload.occupation || ''} 
          onChange={e => handleChange('occupation', e.target.value)} 
        />
      </div>
      <div className="col-md-6">
        <label style={labelStyle}>City</label>
        <input 
          style={inputStyle} 
          placeholder="e.g. Karachi" 
          maxLength={100}
          value={payload.city || ''} 
          onChange={e => handleChange('city', e.target.value)} 
        />
      </div>
      <div className="col-md-6">
        <label style={labelStyle}>Languages Spoken</label>
        <TagInput 
          tags={payload.languages_spoken || []}
          onChange={val => handleChange('languages_spoken', val)}
          placeholder="Type language & press Enter or comma"
          isDark={isDark}
        />
      </div>
      <div className="col-md-6">
        <label style={labelStyle}>Domains</label>
        <TagInput 
          tags={payload.domains || []}
          onChange={val => handleChange('domains', val)}
          placeholder="Type domain & press Enter or comma"
          isDark={isDark}
        />
      </div>
      <div className="col-md-6">
        <label style={labelStyle}>Preferred Language Code</label>
        <input 
          style={inputStyle} 
          placeholder="e.g. en" 
          value={payload.language || ''} 
          onChange={e => handleChange('language', e.target.value)} 
        />
      </div>
      <div className="col-md-6">
        <label style={labelStyle}>Communication Style</label>
        <input 
          style={inputStyle} 
          placeholder="e.g. concise" 
          value={payload.communication_style || ''} 
          onChange={e => handleChange('communication_style', e.target.value)} 
        />
      </div>

      <div className="col-12 mt-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label style={labelStyle} className="mb-0">Interests</label>
          <button 
            type="button" 
            onClick={addInterest} 
            className="btn btn-sm" 
            style={{ color: '#D4AF37', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', padding: '4px 8px', fontSize: '0.75rem' }}
          >
            <Plus size={14} /> Add Interest
          </button>
        </div>
        {payload.interests?.map((interest, idx) => (
          <div key={idx} className="d-flex gap-2 mb-2">
            <input 
              style={{...inputStyle, flex: 2}} 
              placeholder="Interest name e.g. cricket" 
              value={interest.name} 
              onChange={e => updateInterest(idx, 'name', e.target.value)} 
            />
            <input 
              style={{...inputStyle, flex: 1}} 
              type="number" 
              placeholder="Score (1-5)" 
              value={interest.score || 1} 
              onChange={e => updateInterest(idx, 'score', parseInt(e.target.value) || 1)} 
            />
            <button 
              type="button" 
              onClick={() => removeInterest(idx)} 
              className="btn btn-link p-0 text-danger"
            >
              <X size={18} />
            </button>
          </div>
        ))}
        {(!payload.interests || payload.interests.length === 0) && (
          <div style={{ color: '#8a8a8f', fontSize: '0.8rem', fontStyle: 'italic' }}>No interests added.</div>
        )}
      </div>

      <div className="col-12 mt-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label style={labelStyle} className="mb-0">Notable Facts</label>
          <button 
            type="button" 
            onClick={addFact} 
            className="btn btn-sm" 
            style={{ color: '#D4AF37', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', padding: '4px 8px', fontSize: '0.75rem' }}
          >
            <Plus size={14} /> Add Fact
          </button>
        </div>
        {payload.notable_facts?.map((fact, idx) => (
          <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
            <textarea 
              style={{...inputStyle, height: '40px', resize: 'vertical'}} 
              placeholder="Free-text fact" 
              value={fact} 
              onChange={e => updateFact(idx, e.target.value)} 
              maxLength={500}
            />
            <button 
              type="button" 
              onClick={() => removeFact(idx)} 
              className="btn btn-link p-0 text-danger"
            >
              <X size={18} />
            </button>
          </div>
        ))}
        {(!payload.notable_facts || payload.notable_facts.length === 0) && (
          <div style={{ color: '#8a8a8f', fontSize: '0.8rem', fontStyle: 'italic' }}>No facts added.</div>
        )}
      </div>
    </div>
  );
};
