import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NewsService, ScheduleEntry } from 'api/backendApi';
import { Bell, Activity, Send, Clock, Plus, Trash2, X, Save, Globe, BarChart2 } from 'lucide-react';
import CountryFlag from 'components/CountryFlag';
import 'features/news/styles/news.scss';

// --- Types for local component state ---
type Toast = { message: string; type: 'success' | 'error' } | null;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [testCountry, setTestCountry] = useState<string>('');
  const [toast, setToast] = useState<Toast>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCountry, setModalCountry] = useState<string>('');
  const [newHour, setNewHour] = useState('0');
  const [newMinute, setNewMinute] = useState('0');
  const [newType, setNewType] = useState('spotlight');

  // Clear query cache on unmount to release browser memory
  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ['notification-stats'] });
      queryClient.removeQueries({ queryKey: ['schedules'] });
    };
  }, [queryClient]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  // ==========================================
  // QUERIES
  // ==========================================
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: () => NewsService.fetchNotificationStats()
  });

  const { data: countriesData, isLoading: isLoadingCountries } = useQuery({
    queryKey: ['admin-countries'],
    queryFn: () => NewsService.fetchAdminCountries()
  });

  const { data: schedulesData, isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => NewsService.fetchSchedules()
  });

  // ==========================================
  // MUTATIONS
  // ==========================================
  const testPushMutation = useMutation({
    mutationFn: (country: string) => NewsService.sendTestNotification(country),
    onSuccess: (data) => {
      showToast(`Success: ${data.sent} sent, ${data.failed} failed.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
    },
    onError: () => {
      showToast('Failed to send test push.', 'error');
    }
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: ({ country, entry_id }: { country: string; entry_id: string }) => 
      NewsService.deleteScheduleEntry(country, entry_id),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['schedules'] });
      const previous = queryClient.getQueryData(['schedules']);
      queryClient.setQueryData(['schedules'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          schedules: old.schedules.map((s: any) => 
            s.country === variables.country 
              ? { ...s, entries: s.entries.filter((e: any) => e.entry_id !== variables.entry_id) }
              : s
          )
        };
      });
      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['schedules'], context?.previous);
      showToast('Failed to delete schedule.', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.refetchQueries({ queryKey: ['schedules'] });
    }
  });

  const addScheduleMutation = useMutation({
    mutationFn: ({ country, entries }: { country: string; entries: ScheduleEntry[] }) => 
      NewsService.updateSchedule(country, entries),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['schedules'] });
      const previous = queryClient.getQueryData(['schedules']);
      queryClient.setQueryData(['schedules'], (old: any) => {
        if (!old) return old;
        
        // Find existing country or mock a new one
        const existingCountryIndex = old.schedules.findIndex((s: any) => s.country === variables.country);
        const newSchedules = [...old.schedules];
        
        if (existingCountryIndex >= 0) {
          newSchedules[existingCountryIndex] = {
            ...newSchedules[existingCountryIndex],
            entries: variables.entries
          };
        } else {
          newSchedules.push({
            country: variables.country,
            entries: variables.entries,
            languages: [],
            updated_at: new Date().toISOString()
          });
        }

        return { ...old, schedules: newSchedules };
      });
      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['schedules'], context?.previous);
      showToast('Failed to add schedule.', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.refetchQueries({ queryKey: ['schedules'] });
      setIsModalOpen(false);
    }
  });

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleTestPush = () => {
    if (!testCountry) return showToast('Select a country first.', 'error');
    testPushMutation.mutate(testCountry);
  };

  const handleOpenModal = (country: string) => {
    setModalCountry(country);
    setNewHour('0');
    setNewMinute('0');
    setNewType('spotlight');
    setIsModalOpen(true);
  };

  const handleAddSchedule = () => {
    if (!modalCountry) return;
    
    const countrySchedule = schedulesData?.schedules.find(s => s.country === modalCountry);
    const currentEntries = countrySchedule?.entries || [];
    
    // Calculate the next slot number dynamically
    const existingSlots = currentEntries.map((e: any) => e.slot).filter((s): s is number => typeof s === 'number');
    const nextSlot = existingSlots.length > 0 ? Math.max(...existingSlots) + 1 : 1;

    const newEntry: ScheduleEntry = {
      entry_id: `temp-${Date.now()}`,
      article_type: newType,
      hour: parseInt(newHour),
      minute: parseInt(newMinute),
      enabled: true,
      slot: nextSlot
    };

    addScheduleMutation.mutate({
      country: modalCountry,
      entries: [...currentEntries, newEntry]
    });
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================
  const summary = statsData?.summary;
  const recentRuns = statsData?.recent_runs || [];
  const schedules = schedulesData?.schedules || [];
  const countries = countriesData?.supported_countries ? Object.keys(countriesData.supported_countries) : [];

  return (
    <div className="news-glass-archive" style={{ position: 'relative', minHeight: '100vh', paddingBottom: 100 }}>
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

      {/* Page Header */}
      <div className="news-command-header" style={{ marginBottom: 30 }}>
        <div>
          <h2 className="news-title-sharp">
            <Bell size={24} color="#D4AF37" style={{ marginRight: 12, verticalAlign: 'text-bottom' }} /> 
            Notifications &amp; Pipeline Control
          </h2>
          <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.88rem', fontWeight: 500, marginTop: 4 }}>
            Monitor delivery analytics, verify connectivity with test pushes, and manage automated fetch schedules.
          </p>
        </div>

        {/* ── Notification Analysis anchor button ── */}
        <button
          id="notification-analysis-btn"
          onClick={() => navigate('/news/analytics')}
          style={{
            background: 'transparent',
            border: '1px solid var(--news-glass-border)',
            borderRadius: 6,
            padding: '9px 18px',
            color: 'var(--news-text-muted)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#D4AF37';
            e.currentTarget.style.color = '#D4AF37';
            e.currentTarget.style.background = 'rgba(212,175,55,0.06)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--news-glass-border)';
            e.currentTarget.style.color = 'var(--news-text-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <BarChart2 size={15} />
          Notification Analysis
        </button>
      </div>

      {/* SECTION A: Overview & Test Push */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
        {isLoadingStats ? (
          <>
             <div className="nv-skeleton" style={{ height: 110 }} />
             <div className="nv-skeleton" style={{ height: 110 }} />
             <div className="nv-skeleton" style={{ height: 110 }} />
          </>
        ) : (
          <>
            <div className="country-card" style={{ padding: '20px' }}>
              <div style={{ color: 'var(--news-text-dim)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Success Rate</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#D4AF37' }}>
                {summary?.overall_success_rate ?? 0}<span style={{ fontSize: '1rem', marginLeft: 2 }}>%</span>
              </div>
            </div>
            <div className="country-card" style={{ padding: '20px' }}>
              <div style={{ color: 'var(--news-text-dim)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Total Sent (7d)</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#2ecc71' }}>
                {summary?.total_sent ?? 0}
              </div>
            </div>
            <div className="country-card" style={{ padding: '20px' }}>
              <div style={{ color: 'var(--news-text-dim)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Active Pipeline Runs</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--news-text-main)' }}>
                {summary?.total_runs ?? 0}
              </div>
            </div>
          </>
        )}

        {/* Test Push Module */}
        <div className="country-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ color: '#D4AF37', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12 }}>Verify Connectivity</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select 
              value={testCountry}
              onChange={(e) => setTestCountry(e.target.value)}
              className="form-control"
              style={{ flex: 1, background: 'var(--news-input-bg)', border: '1px solid var(--news-glass-border)', color: 'var(--news-text-main)', padding: '8px 12px', borderRadius: 4, outline: 'none', fontSize: '0.85rem' }}
              disabled={isLoadingCountries}
            >
              <option value="">Target Country</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button 
              onClick={handleTestPush}
              disabled={testPushMutation.isPending}
              style={{ background: '#D4AF37', color: '#000', border: 'none', borderRadius: 4, padding: '0 20px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
            >
              <Send size={14} /> {testPushMutation.isPending ? '...' : 'Push'}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B: Recent Deliveries */}
      <div style={{ marginBottom: 48 }}>
        <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.15rem', fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>
          <Activity size={20} color="#D4AF37" /> Recent Pipeline Executions
        </h3>
        <div style={{ background: 'var(--news-glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--news-glass-border)', borderRadius: 4, overflow: 'hidden', boxShadow: 'var(--news-card-shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--news-table-header-bg)', borderBottom: '1px solid var(--news-glass-border)', color: 'var(--news-text-dim)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              <tr>
                <th style={{ padding: '14px 20px', fontWeight: 700 }}>Country</th>
                <th style={{ padding: '14px 20px', fontWeight: 700 }}>Successful</th>
                <th style={{ padding: '14px 20px', fontWeight: 700 }}>Failed</th>
                <th style={{ padding: '14px 20px', fontWeight: 700 }}>Performance</th>
                <th style={{ padding: '14px 20px', fontWeight: 700 }}>Trigger</th>
                <th style={{ padding: '14px 20px', fontWeight: 700 }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingStats ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--news-glass-border)' }}>
                    <td colSpan={6} style={{ padding: '14px 20px' }}><div className="nv-skeleton" style={{ height: 22 }} /></td>
                  </tr>
                ))
              ) : recentRuns.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--news-text-dim)', fontStyle: 'italic' }}>No recent executions found in history.</td></tr>
              ) : (
                recentRuns.map(run => (
                  <tr 
                    key={run.id} 
                    style={{ borderBottom: '1px solid var(--news-glass-border)', color: 'var(--news-text-main)', fontSize: '0.88rem', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--news-table-header-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <CountryFlag country={run.country} size={28} />
                        {run.country}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#2ecc71', fontWeight: 700 }}>{run.sent}</td>
                    <td style={{ padding: '14px 20px', color: run.failed > 0 ? '#e74c3c' : 'var(--news-text-dim)' }}>{run.failed}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: 3, 
                        background: run.success_rate === 100 ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)', 
                        color: run.success_rate === 100 ? '#2ecc71' : '#e74c3c',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        border: `1px solid ${run.success_rate === 100 ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.2)'}`
                      }}>
                        {run.success_rate}%
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                       <span style={{ color: 'var(--news-text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                        {run.triggered_by}
                       </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--news-text-muted)', fontSize: '0.8rem' }}>
                      {new Date(run.notified_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION C: Schedule Manager */}
      <div>
        <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.15rem', fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>
          <Clock size={20} color="#D4AF37" /> Automated Pipeline Schedules
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {isLoadingSchedules ? (
            [...Array(6)].map((_, i) => <div key={i} className="nv-skeleton" style={{ height: 200 }} />)
          ) : (
            schedules.map(schedule => (
              <div key={schedule.country} className="country-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--news-table-header-bg)', padding: '16px 20px', borderBottom: '1px solid var(--news-glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CountryFlag country={schedule.country} size={32} />
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#D4AF37', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{schedule.country}</h4>
                  </div>
                  <button 
                    onClick={() => handleOpenModal(schedule.country)} 
                    style={{ background: 'transparent', border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', borderRadius: 4, padding: '4px 12px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Plus size={14} /> ADD
                  </button>
                </div>
                
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {schedule.entries.length === 0 ? (
                    <div style={{ color: 'var(--news-text-dim)', fontSize: '0.82rem', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>No active fetch routines defined.</div>
                  ) : (
                    schedule.entries.map(entry => (
                      <div key={entry.entry_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--news-input-bg)', padding: '12px 16px', borderRadius: 4, border: '1px solid var(--news-glass-border)', transition: 'all 0.2s' }}>
                        <div>
                          <div style={{ color: 'var(--news-text-main)', fontSize: '1rem', fontWeight: 800, letterSpacing: '1px' }}>
                            {String(entry.hour).padStart(2, '0')}:{String(entry.minute).padStart(2, '0')} <span style={{ fontSize: '0.65rem', color: 'var(--news-text-dim)', marginLeft: 4 }}>UTC</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ color: '#D4AF37', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
                              {entry.article_type.replace('-', ' ')}
                            </span>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--news-text-dim)' }} />
                            <span style={{ color: entry.enabled ? '#2ecc71' : '#e74c3c', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase' }}>
                              {entry.enabled ? 'ACTIVE' : 'DISABLED'}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteScheduleMutation.mutate({ country: schedule.country, entry_id: entry.entry_id })}
                          style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 8, borderRadius: 4, transition: 'all 0.2s' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(231,76,60,0.1)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ADD SCHEDULE MODAL (PORTAL) */}
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
              maxWidth: '450px', 
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
                <h4 style={{ color: '#D4AF37', margin: 0, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Define Fetch Routine</h4>
                <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.82rem', marginTop: '4px' }}>
                  Setting up automated pipeline for <strong style={{ color: 'var(--news-text-main)' }}>{modalCountry}</strong>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Time Selection */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D4AF37', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
                    <Clock size={14} /> Execution Time (UTC)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <select value={newHour} onChange={(e) => setNewHour(e.target.value)} style={{ width: '100%', background: 'var(--news-input-bg)', border: '1px solid var(--news-glass-border)', color: 'var(--news-text-main)', padding: '12px', borderRadius: 4, outline: 'none', fontSize: '0.9rem', fontWeight: 700 }}>
                        {[...Array(24)].map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                      </select>
                    </div>
                    <div>
                      <select value={newMinute} onChange={(e) => setNewMinute(e.target.value)} style={{ width: '100%', background: 'var(--news-input-bg)', border: '1px solid var(--news-glass-border)', color: 'var(--news-text-main)', padding: '12px', borderRadius: 4, outline: 'none', fontSize: '0.9rem', fontWeight: 700 }}>
                        {[0, 15, 30, 45].map(i => <option key={i} value={i}>+ {String(i).padStart(2, '0')} min</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Article Type Selection */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D4AF37', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
                    <Globe size={14} /> Pipeline Target Category
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { value: 'spotlight', label: 'spotlight' },
                      { value: 'daily_summary', label: 'daily summary' }
                    ].map(({ value, label }) => (
                      <button 
                        key={value}
                        onClick={() => setNewType(value)}
                        style={{
                          background: newType === value ? 'rgba(212,175,55,0.2)' : 'var(--news-input-bg)',
                          border: `1px solid ${newType === value ? '#D4AF37' : 'var(--news-glass-border)'}`,
                          color: newType === value ? '#D4AF37' : 'var(--news-text-muted)',
                          padding: '8px 16px',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(212,175,55,0.05)', padding: '16px', borderRadius: 4, border: '1px dashed rgba(212,175,55,0.2)' }}>
                  <p style={{ color: 'var(--news-text-dim)', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
                    <strong>Note:</strong> The pipeline will fetch the latest articles for the selected category at exactly the specified UTC time. Ensure the country's topic configuration is correctly set.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 d-flex justify-content-end gap-3" style={{ borderTop: '1px solid var(--news-glass-border)', background: 'var(--news-table-header-bg)' }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: '1px solid var(--news-glass-border)', color: 'var(--news-text-dim)', padding: '10px 24px', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAddSchedule}
                disabled={addScheduleMutation.isPending}
                style={{ 
                  background: '#D4AF37', 
                  color: '#000', 
                  border: 'none', 
                  padding: '10px 32px', 
                  borderRadius: 4, 
                  fontWeight: 800, 
                  cursor: addScheduleMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: addScheduleMutation.isPending ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {addScheduleMutation.isPending ? '...' : <><Save size={18} /> SAVE ROUTINE</>}
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
