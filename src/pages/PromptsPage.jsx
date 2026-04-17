import React, { useState, useEffect, useRef } from 'react';
import { PromptsService } from 'api/backendApi';
import { gsap } from 'gsap';
import { Cpu, Save, TerminalSquare, AlertCircle, Loader } from 'lucide-react';
import MainCard from 'components/MainCard';

export default function PromptsPage() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [defaultData, othersData, voiceData] = await Promise.all([
          PromptsService.getDefaultPrompt().catch(() => null),
          PromptsService.getOthersPrompt().catch(() => null),
          PromptsService.getVoicePrompt().catch(() => null)
        ]);
        
        const arr = [];
        if (defaultData) arr.push({ id: 'default', name: 'Default Prompt', ...defaultData });
        if (othersData) arr.push({ id: 'others', name: 'Wait/Others Prompt', ...othersData });
        if (voiceData) arr.push({ id: 'voice', name: 'Voice Engine Prompt', ...voiceData });

        setPrompts(arr);
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
    </div>
  );
}
