import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import gsap from 'gsap';
import {
  Database,
  Play,
  Search,
  Loader2,
  RefreshCw,
  Globe,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { MemoryBackfillService, MemorySeedPayload, JobStatusResponse, NewsService } from 'api/backendApi';
import { showToast } from 'components/EliteUI/EliteToastContainer';
import { MemorySeedForm, sanitizeMemoryPayload } from 'components/MemorySeedForm';
import 'pages/personalization.scss';

export default function MemoryBackfillPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark ?? true);
  const pageRef = useRef<HTMLDivElement>(null);

  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [payload, setPayload] = useState<MemorySeedPayload>({});
  
  const [recentJobs, setRecentJobs] = useState<JobStatusResponse[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobStatus, setActiveJobStatus] = useState<JobStatusResponse | null>(null);
  const [dryRunCompleted, setDryRunCompleted] = useState(false);

  // Require re-run of dry run if payload changes
  useEffect(() => {
    setDryRunCompleted(false);
  }, [payload, selectedCountry]);

  const loadCountries = async () => {
    try {
      const data = await NewsService.fetchAdminCountries();
      setCountries(Object.keys(data.supported_countries));
      if (Object.keys(data.supported_countries).length > 0) {
        setSelectedCountry(Object.keys(data.supported_countries)[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadRecentJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const data = await MemoryBackfillService.listRecentJobs(20);
      setRecentJobs(data.jobs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadCountries();
    loadRecentJobs();
  }, [loadRecentJobs]);

  useEffect(() => {
    if (pageRef.current) {
      gsap.fromTo(
        pageRef.current.querySelectorAll('.pers-card, .pers-header'),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out' }
      );
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (activeJobId) {
      interval = setInterval(async () => {
        try {
          const status = await MemoryBackfillService.getJobStatus(activeJobId);
          setActiveJobStatus(status);
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(interval);
            setActiveJobId(null);
            loadRecentJobs();
            if (status.status === 'completed') {
              showToast(`Sweep completed successfully for ${status.country}`, 'success');
              if (status.dry_run) {
                setDryRunCompleted(true);
              }
            } else {
              showToast(`Sweep failed for ${status.country}: ${status.error_message}`, 'error');
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [activeJobId, loadRecentJobs]);

  const handleDryRun = async () => {
    if (!selectedCountry) return;
    const sanitized = sanitizeMemoryPayload(payload);
    if (Object.keys(sanitized).length === 0) {
      showToast('Payload is empty after sanitization. Provide at least one valid field.', 'error');
      return;
    }
    
    setSubmitting(true);
    setDryRunCompleted(false);
    setActiveJobStatus(null);
    try {
      const response = await MemoryBackfillService.dispatchCountryBackfill({
        country: selectedCountry,
        dry_run: true,
        payload: sanitized,
      });
      setActiveJobId(response.job_id);
      showToast('Dry run dispatched. Monitoring progress...', 'info');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Dry run failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSweep = async () => {
    if (!selectedCountry) return;
    const sanitized = sanitizeMemoryPayload(payload);
    
    setSubmitting(true);
    setActiveJobStatus(null);
    try {
      const response = await MemoryBackfillService.dispatchCountryBackfill({
        country: selectedCountry,
        dry_run: false,
        payload: sanitized,
      });
      setActiveJobId(response.job_id);
      showToast('Memory sweep dispatched. Monitoring progress...', 'info');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Sweep dispatch failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="pers-badge" style={{ background: 'rgba(134,239,172,0.1)', color: '#86efac', border: '1px solid #86efac' }}>Completed</span>;
      case 'failed': return <span className="pers-badge" style={{ background: 'rgba(220,20,60,0.1)', color: '#DC143C', border: '1px solid #DC143C' }}>Failed</span>;
      case 'running': return <span className="pers-badge" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid #D4AF37' }}>Running</span>;
      default: return <span className="pers-badge badge-default">Pending</span>;
    }
  };

  return (
    <div className={`pers-page ${!isDark ? 'light-mode' : ''}`} ref={pageRef}>
      {/* ── Header ── */}
      <div className="pers-header">
        <div className="pers-title-group">
          <h1>
            <Database size={22} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
            Memory Backfill
          </h1>
          <div className="pers-subtitle">
            Seed memory records for users who don't have one yet. Does not overwrite existing memory.
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-8">
          {/* ── Sweep Form ── */}
          <div className="pers-card mb-4">
            <div className="pers-card-title mb-3">Country-Wide Sweep Form</div>
            
            <div className="pers-control-row mb-4">
              <Globe size={16} style={{ color: '#a8956b' }} />
              <span className="pers-select-label">Target Country</span>
              <div className="pers-select-wrapper" style={{ minWidth: '200px' }}>
                <select
                  value={selectedCountry}
                  onChange={e => setSelectedCountry(e.target.value)}
                >
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="pers-select-arrow">▼</span>
              </div>
            </div>

            <MemorySeedForm payload={payload} onChange={setPayload} isDark={isDark} />

            <div className="d-flex gap-3 mt-4 pt-3" style={{ borderTop: '1px solid rgba(212,175,55,0.1)' }}>
              {!dryRunCompleted ? (
                <button 
                  className="pers-btn pers-btn-secondary w-100" 
                  onClick={handleDryRun} 
                  disabled={submitting || !!activeJobId || Object.keys(payload).length === 0}
                >
                  {submitting ? <Loader2 size={14} className="spin-icon" /> : <Search size={14} />} 
                  Preview Scope (Dry Run)
                </button>
              ) : (
                <>
                  <button 
                    className="pers-btn pers-btn-secondary flex-grow-1" 
                    onClick={() => setDryRunCompleted(false)} 
                    disabled={submitting || !!activeJobId}
                  >
                    Edit Payload
                  </button>
                  <button 
                    className="pers-btn pers-btn-primary flex-grow-1" 
                    onClick={handleStartSweep} 
                    disabled={submitting || !!activeJobId}
                  >
                    {submitting ? <Loader2 size={14} className="spin-icon" /> : <Play size={14} />} 
                    Confirm & Start Live Sweep
                  </button>
                </>
              )}
            </div>
            {Object.keys(payload).length === 0 && !dryRunCompleted && (
              <div style={{ color: '#8a8a8f', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>
                At least one field must be provided to preview a sweep.
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-4">
          {/* ── Active Job Progress ── */}
          {(activeJobId || activeJobStatus) && (
            <div className="pers-card mb-4" style={{ border: '1px solid #D4AF37' }}>
              <div className="pers-card-title d-flex justify-content-between align-items-center">
                <span>Active Sweep Progress</span>
                {activeJobStatus?.status === 'running' && <Loader2 size={16} className="spin-icon" color="#D4AF37" />}
              </div>
              
              {activeJobStatus ? (
                <div className="mt-3">
                  <div className="d-flex justify-content-between mb-2">
                    <span style={{ color: '#a8956b', fontSize: '0.85rem' }}>Status</span>
                    {getStatusBadge(activeJobStatus.status)}
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span style={{ color: '#a8956b', fontSize: '0.85rem' }}>Country</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{activeJobStatus.country}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span style={{ color: '#a8956b', fontSize: '0.85rem' }}>Mode</span>
                    <span style={{ color: '#fff' }}>{activeJobStatus.dry_run ? 'Dry Run' : 'Live Sweep'}</span>
                  </div>
                  
                  {activeJobStatus.status === 'failed' && activeJobStatus.error_message && (
                    <div className="mt-3 p-3" style={{ background: 'rgba(220,20,60,0.1)', borderRadius: '8px', borderLeft: '3px solid #DC143C' }}>
                      <div style={{ color: '#DC143C', fontSize: '0.85rem', fontWeight: 600 }}>Error Details:</div>
                      <div style={{ color: '#ffb3b3', fontSize: '0.8rem', marginTop: '4px' }}>{activeJobStatus.error_message}</div>
                    </div>
                  )}

                  <div className="pers-divider my-3" />
                  
                  <div className="row g-2 text-center">
                    <div className="col-6">
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ color: '#D4AF37', fontSize: '1.2rem', fontWeight: 700 }}>{activeJobStatus.users_scanned}</div>
                        <div style={{ color: '#a8956b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Scanned</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div style={{ background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.3)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ color: '#86efac', fontSize: '1.2rem', fontWeight: 700 }}>{activeJobStatus.users_updated}</div>
                        <div style={{ color: '#86efac', fontSize: '0.7rem', textTransform: 'uppercase' }}>{activeJobStatus.dry_run ? 'Would Create' : 'Created'}</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>{activeJobStatus.users_skipped_has_memory}</div>
                        <div style={{ color: '#a8956b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Skipped (Has Mem)</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div style={{ background: 'rgba(220,20,60,0.1)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ color: '#DC143C', fontSize: '1.2rem', fontWeight: 700 }}>{activeJobStatus.users_failed}</div>
                        <div style={{ color: '#DC143C', fontSize: '0.7rem', textTransform: 'uppercase' }}>Failed</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Loader2 size={24} className="spin-icon" color="#D4AF37" />
                  <div className="mt-2" style={{ color: '#a8956b', fontSize: '0.85rem' }}>Initializing...</div>
                </div>
              )}
            </div>
          )}

          {/* ── Recent Jobs ── */}
          <div className="pers-card h-100">
            <div className="pers-card-title d-flex justify-content-between align-items-center mb-3">
              <span>Recent Sweeps</span>
              <button className="btn btn-link p-0 text-secondary" onClick={loadRecentJobs} disabled={loadingJobs}>
                <RefreshCw size={14} className={loadingJobs ? 'spin-icon' : ''} />
              </button>
            </div>
            
            <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
              {recentJobs.length > 0 ? recentJobs.map(job => (
                <div key={job.job_id} className="mb-3 p-3" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `3px solid ${job.status === 'completed' ? '#86efac' : job.status === 'failed' ? '#DC143C' : '#D4AF37'}` }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{job.country}</span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '0.75rem', color: '#a8956b' }}>
                    <Clock size={12} /> {new Date(job.created_at).toLocaleString()}
                    {job.dry_run && <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>Dry Run</span>}
                  </div>
                  <div className="d-flex gap-3 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
                    <span style={{ color: '#86efac' }}>+{job.users_updated}</span>
                    <span style={{ color: '#8a8a8f' }}>~{job.users_skipped_has_memory} skipped</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4" style={{ color: '#8a8a8f', fontStyle: 'italic', fontSize: '0.85rem' }}>
                  No recent jobs found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`.spin-icon { animation: pers-spin 1s linear infinite; }`}</style>
    </div>
  );
}
