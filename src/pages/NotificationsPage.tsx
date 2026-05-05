import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NewsService, ScheduleEntry } from 'api/backendApi';
import { Bell, Activity, Send, CheckCircle, XCircle, Clock, Plus, Trash2, X } from 'lucide-react';
import 'features/news/styles/news.scss';

// --- Types for local component state ---
type Toast = { message: string; type: 'success' | 'error' } | null;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [testCountry, setTestCountry] = useState<string>('');
  const [toast, setToast] = useState<Toast>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCountry, setModalCountry] = useState<string>('');
  const [newHour, setNewHour] = useState('0');
  const [newMinute, setNewMinute] = useState('0');
  const [newType, setNewType] = useState('spotlight');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
    
    // Generate a pseudo-ID for optimistic UI; backend will assign a real one.
    const newEntry: ScheduleEntry = {
      entry_id: `temp-${Date.now()}`,
      article_type: newType,
      hour: parseInt(newHour),
      minute: parseInt(newMinute),
      enabled: true
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

      {/* Page Header */}
      <div className="news-command-header" style={{ marginBottom: 30 }}>
        <div>
          <h2 className="news-title-sharp"><Bell size={20} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Notifications & Schedules</h2>
          <p style={{ color: 'var(--news-text-muted)', margin: 0, fontSize: '0.84rem', fontWeight: 500 }}>
            Manage notification analytics, test pushes, and pipeline scheduling.
          </p>
        </div>
      </div>

      {/* SECTION A: Overview & Test Push */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 30 }}>
        {/* Metric Cards */}
        {isLoadingStats ? (
          <>
             <div className="nv-skeleton" style={{ height: 100 }} />
             <div className="nv-skeleton" style={{ height: 100 }} />
             <div className="nv-skeleton" style={{ height: 100 }} />
          </>
        ) : (
          <>
            <div style={{ background: 'var(--news-card-bg)', border: '1px solid var(--news-card-border)', borderRadius: 4, padding: 20 }}>
              <div style={{ color: 'var(--news-text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Overall Success Rate</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--news-text-main)', marginTop: 8 }}>
                {summary?.overall_success_rate ?? 0}%
              </div>
            </div>
            <div style={{ background: 'var(--news-card-bg)', border: '1px solid var(--news-card-border)', borderRadius: 4, padding: 20 }}>
              <div style={{ color: 'var(--news-text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Total Sent (7d)</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2ecc71', marginTop: 8 }}>
                {summary?.total_sent ?? 0}
              </div>
            </div>
            <div style={{ background: 'var(--news-card-bg)', border: '1px solid var(--news-card-border)', borderRadius: 4, padding: 20 }}>
              <div style={{ color: 'var(--news-text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Total Runs (7d)</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--news-text-main)', marginTop: 8 }}>
                {summary?.total_runs ?? 0}
              </div>
            </div>
          </>
        )}

        {/* Test Push Module */}
        <div style={{ background: 'var(--news-card-bg)', border: '1px solid var(--news-card-border)', borderRadius: 4, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: 'var(--news-text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Test FCM Push</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select 
              value={testCountry}
              onChange={(e) => setTestCountry(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: 4, outline: 'none' }}
              disabled={isLoadingCountries}
            >
              <option value="">Select Country</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button 
              onClick={handleTestPush}
              disabled={testPushMutation.isPending}
              style={{ background: '#D4AF37', color: '#000', border: 'none', borderRadius: 4, padding: '0 16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Send size={14} /> {testPushMutation.isPending ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B: Recent Deliveries */}
      <div style={{ marginBottom: 40 }}>
        <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color="#D4AF37" /> Recent Deliveries
        </h3>
        <div style={{ background: 'var(--news-card-bg)', border: '1px solid var(--news-card-border)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--news-card-border)', color: 'var(--news-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>
              <tr>
                <th style={{ padding: '12px 16px' }}>Country</th>
                <th style={{ padding: '12px 16px' }}>Sent</th>
                <th style={{ padding: '12px 16px' }}>Failed</th>
                <th style={{ padding: '12px 16px' }}>Success Rate</th>
                <th style={{ padding: '12px 16px' }}>Trigger</th>
                <th style={{ padding: '12px 16px' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingStats ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--news-card-border)' }}>
                    <td colSpan={6} style={{ padding: '12px 16px' }}><div className="nv-skeleton" style={{ height: 20 }} /></td>
                  </tr>
                ))
              ) : recentRuns.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--news-text-dim)' }}>No recent runs available.</td></tr>
              ) : (
                recentRuns.map(run => (
                  <tr key={run.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--news-text-main)', fontSize: '0.85rem' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{run.country}</td>
                    <td style={{ padding: '12px 16px', color: '#2ecc71' }}>{run.sent}</td>
                    <td style={{ padding: '12px 16px', color: run.failed > 0 ? '#e74c3c' : 'var(--news-text-dim)' }}>{run.failed}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: run.success_rate === 100 ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)', color: run.success_rate === 100 ? '#2ecc71' : '#e74c3c' }}>
                        {run.success_rate}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{run.triggered_by}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--news-text-dim)' }}>{new Date(run.notified_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION C: Schedule Manager */}
      <div>
        <h3 style={{ color: 'var(--news-text-main)', fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={18} color="#D4AF37" /> Pipeline Schedules
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {isLoadingSchedules ? (
            [...Array(4)].map((_, i) => <div key={i} className="nv-skeleton" style={{ height: 180 }} />)
          ) : (
            schedules.map(schedule => (
              <div key={schedule.country} style={{ background: 'var(--news-card-bg)', border: '1px solid var(--news-card-border)', borderRadius: 4, padding: 20, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12, marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#D4AF37', fontWeight: 600 }}>{schedule.country}</h4>
                  <button onClick={() => handleOpenModal(schedule.country)} style={{ background: 'transparent', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={12} /> Add
                  </button>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {schedule.entries.length === 0 ? (
                    <div style={{ color: 'var(--news-text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>No active schedules</div>
                  ) : (
                    schedule.entries.map(entry => (
                      <div key={entry.entry_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div>
                          <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'monospace' }}>
                            {String(entry.hour).padStart(2, '0')}:{String(entry.minute).padStart(2, '0')} UTC
                          </div>
                          <div style={{ color: 'var(--news-text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                            {entry.article_type} &bull; {entry.enabled ? <span style={{color: '#2ecc71'}}>Enabled</span> : <span style={{color: '#e74c3c'}}>Disabled</span>}
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteScheduleMutation.mutate({ country: schedule.country, entry_id: entry.entry_id })}
                          style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', opacity: 0.7 }}
                          onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                        >
                          <Trash2 size={16} />
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

      {/* CUSTOM GLASSMORPHISM MODAL */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#121212', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 4,
            width: 400, maxWidth: '90%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#D4AF37', margin: 0, fontSize: '1.1rem' }}>Add Schedule: {modalCountry}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--news-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--news-text-dim)', fontSize: '0.75rem', marginBottom: 4, textTransform: 'uppercase' }}>Hour (UTC)</label>
                  <select value={newHour} onChange={(e) => setNewHour(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: 4, outline: 'none' }}>
                    {[...Array(24)].map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--news-text-dim)', fontSize: '0.75rem', marginBottom: 4, textTransform: 'uppercase' }}>Minute</label>
                  <select value={newMinute} onChange={(e) => setNewMinute(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: 4, outline: 'none' }}>
                    {[0, 15, 30, 45].map(i => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--news-text-dim)', fontSize: '0.75rem', marginBottom: 4, textTransform: 'uppercase' }}>Article Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: 4, outline: 'none' }}>
                  <option value="spotlight">Spotlight (Default)</option>
                  <option value="trending">Trending</option>
                  <option value="business">Business</option>
                  <option value="tech">Tech</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                  Cancel
                </button>
                <button 
                  onClick={handleAddSchedule}
                  disabled={addScheduleMutation.isPending}
                  style={{ background: '#D4AF37', border: 'none', color: '#000', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  {addScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
