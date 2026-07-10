import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserMemoryService, UserService, MemoryBackfillService } from 'api/backendApi';
import { ArrowLeft, Clock, MapPin, Mail, Shield, Zap, User as UserIcon, Search as SearchIcon, Copy, Check, Activity, Fingerprint, History, Database, Loader2, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { gsap } from 'gsap';
import MainCard from 'components/MainCard';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { MemorySeedForm, sanitizeMemoryPayload } from 'components/MemorySeedForm';
import { showToast } from 'components/EliteUI/EliteToastContainer';

const MemoryCard = ({ label, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const prettifyDate = (str) => {
    try {
      const d = new Date(str);
      if (isNaN(d)) return str;
      return d.toLocaleString(undefined, { 
        month: 'short', day: 'numeric', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
    } catch (e) { return str; }
  };

  const renderMemoryValue = (val, key) => {
    if (val === null || val === undefined) return <span style={{ color: '#a8956b', fontStyle: 'italic' }}>N/A</span>;

    if (key === 'notable_facts' && Array.isArray(val)) {
      return (
        <div className="mt-2">
          {val.map((fact, i) => (
            <div key={i} className="mb-3 p-3" style={{ background: 'rgba(212,175,55,0.05)', borderRadius: '8px', borderLeft: '2px solid #D4AF37' }}>
              <div style={{ color: '#D4AF37', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{fact.fact}</div>
              <div className="d-flex justify-content-between align-items-center mt-2">
                 <span style={{ fontSize: '0.7rem', color: '#a8956b' }}>{prettifyDate(fact.added_at)}</span>
                 <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '0.5px solid rgba(212,175,55,0.3)' }}>
                   {Math.round(parseFloat(fact.confidence || 0) * 100)}% Confidence
                 </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (typeof val === 'object' && !Array.isArray(val)) {
      const entries = Object.entries(val);
      if (entries.length === 0) return <span style={{ color: '#a8956b', fontStyle: 'italic' }}>Empty dataset.</span>;
      
      return (
        <div className="mt-1">
          {entries.map(([sk, sv]) => (
            <div key={sk} className="mb-2">
              <span style={{ color: '#a8956b', fontSize: '0.75rem', textTransform: 'uppercase', marginRight: '8px', fontFamily: 'monospace' }}>{sk.replace(/_/g, ' ')}:</span>
              <div style={{ paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', marginTop: '4px' }}>
                {renderMemoryValue(sv, sk)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return <span style={{ color: '#a8956b', fontStyle: 'italic' }}>No associations.</span>;
      return (
        <div className="d-flex flex-wrap gap-2 mt-2">
          {val.map((item, i) => (
            <span key={i} style={{ 
              padding: '4px 10px', 
              borderRadius: '6px', 
              background: 'rgba(255,255,255,0.03)', 
              border: '0.5px solid rgba(212,175,55,0.3)', 
              color: '#fff', 
              fontSize: '0.75rem',
              fontFamily: "'Roboto Mono', monospace"
            }}>
              {String(item)}
            </span>
          ))}
        </div>
      );
    }

    const isoRegEx = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (typeof val === 'string' && isoRegEx.test(val)) {
      return (
        <span style={{ fontFamily: "'Roboto Mono', monospace", color: '#D4AF37' }}>
          {prettifyDate(val)}
        </span>
      );
    }

    return (
      <span style={{ fontFamily: "'Roboto Mono', monospace", color: '#fff' }}>
        {String(val)}
      </span>
    );
  };

  return (
    <div className="col-md-6 mb-3">
      <div style={{ 
        background: 'rgba(255,255,255,0.03)', 
        backdropFilter: 'blur(10px)', 
        border: '0.5px solid rgba(212,175,55,0.4)', 
        borderRadius: '12px', 
        padding: '16px 20px',
        position: 'relative',
        height: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div style={{ color: '#D4AF37', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {label.replace(/_/g, ' ')}
          </div>
          <button 
            onClick={handleCopy}
            className="btn btn-link p-0 text-primary" 
            style={{ opacity: 0.6, transition: 'opacity 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
            title="Copy Raw Data"
          >
            {copied ? <Check size={16} color="#D4AF37" /> : <Copy size={16} />}
          </button>
        </div>
        <div style={{ fontSize: '0.95rem' }}>
          {renderMemoryValue(value, label.toLowerCase())}
        </div>
      </div>
    </div>
  );
};

const MemoryGrid = ({ data }) => {
  const [search, setSearch] = useState('');
  
  const memoryMap = useMemo(() => {
    const raw = data?.memory_data || data || {};
    return Object.entries(raw).filter(([key, val]) => 
      key.toLowerCase().includes(search.toLowerCase()) || 
      JSON.stringify(val).toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  return (
    <div className="p-4" style={{ background: '#050505' }}>
      <div className="d-flex align-items-center mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '8px', padding: '8px 16px' }}>
        <SearchIcon size={16} color="#a8956b" />
        <input 
          placeholder="Filter saved data..."
          className="border-0 shadow-none bg-transparent w-100 ms-2"
          style={{ color: '#e0d5b8', outline: 'none', fontSize: '0.9rem' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="row">
        {memoryMap.length > 0 ? memoryMap.map(([key, val]) => (
          <MemoryCard key={key} label={key} value={val} />
        )) : (
          <div className="col-12 text-center py-4" style={{ color: '#a8956b', fontStyle: 'italic' }}>
            No user records found.
          </div>
        )}
      </div>
    </div>
  );
};

const UsageStatsSection = ({ userId }) => {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['userStats', userId],
    queryFn: () => UserService.fetchUserStats(userId),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Row className="mb-4">
        {[1, 2, 3, 4].map((i) => (
          <Col md={3} key={i}>
            <div className="glass-morphism sharp-border p-3" style={{ height: '100px' }}>
              <div className="placeholder-glow">
                <span className="placeholder col-6 bg-secondary mb-3"></span>
                <span className="placeholder col-8 bg-secondary"></span>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    );
  }

  if (isError || !stats) {
    return null;
  }

  const formatNum = (num) => (num || 0).toLocaleString();
  const endpoints = stats.api_requests?.today?.by_endpoint || {};
  const hasEndpoints = Object.keys(endpoints).length > 0;

  return (
    <div className="mb-4">
      <h5 style={{ color: '#D4AF37', marginBottom: '1rem', fontWeight: 600 }}>Usage Statistics</h5>
      <Row className="g-3 mb-3">
        <Col md={3}>
          <div className="glass-morphism sharp-border p-3 h-100">
            <div style={{ color: '#a8956b', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>Today's Tokens</div>
            <div style={{ color: '#e0d5b8', fontSize: '1.5rem', fontWeight: 700 }}>{formatNum(stats.tokens?.today?.total_tokens)}</div>
          </div>
        </Col>
        <Col md={3}>
          <div className="glass-morphism sharp-border p-3 h-100">
            <div style={{ color: '#a8956b', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>All-time Tokens</div>
            <div style={{ color: '#e0d5b8', fontSize: '1.5rem', fontWeight: 700 }}>{formatNum(stats.tokens?.all_time?.total_tokens)}</div>
          </div>
        </Col>
        <Col md={3}>
          <div className="glass-morphism sharp-border p-3 h-100">
            <div style={{ color: '#a8956b', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>Today's Requests</div>
            <div style={{ color: '#e0d5b8', fontSize: '1.5rem', fontWeight: 700 }}>{formatNum(stats.api_requests?.today?.total_requests)}</div>
          </div>
        </Col>
        <Col md={3}>
          <div className="glass-morphism sharp-border p-3 h-100">
            <div style={{ color: '#a8956b', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>All-time Requests</div>
            <div style={{ color: '#e0d5b8', fontSize: '1.5rem', fontWeight: 700 }}>{formatNum(stats.api_requests?.all_time?.total_requests)}</div>
          </div>
        </Col>
      </Row>

      {hasEndpoints && (
        <div className="glass-morphism sharp-border p-3">
          <div style={{ color: '#D4AF37', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>Today's Request Breakdown</div>
          <div className="d-flex flex-wrap gap-3">
            {Object.entries(endpoints).map(([endpoint, count]) => (
              <div key={endpoint} className="d-flex align-items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(212,175,55,0.2)' }}>
                <span style={{ color: '#e0d5b8', fontFamily: 'monospace', fontSize: '0.8rem' }}>{endpoint}</span>
                <span style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>{formatNum(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [memoryData, setMemoryData] = useState(null);
  const [tokenHistory, setTokenHistory] = useState([]);
  const [rawLogs, setRawLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(null);

  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedPayload, setSeedPayload] = useState({});
  const [seeding, setSeeding] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubTokens = null;
    let cancelled = false;

    async function fetchUser() {
      try {
        setLoading(true);
        const docRef = doc(db, 'Users', id);
        const docSnap = await getDoc(docRef);
        
        if (cancelled) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          const mappedUser = {
            id: docSnap.id,
            name: data.name || 'Guest',
            email: data.email || 'No email',
            avatar: data.avatar || data.profileImage || data.profile_image || data.photoURL || null,
            country: data.country || 'Unknown',
            selectedLanguage: data.selectedLanguage || 'System (EN-US)',
            tokens: data.tokens || 0,
            freeDays: data.freeDays || 0,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'Unknown',
            status: data.status || 'inactive'
          };
          
          setUser(mappedUser);

          try {
            const memRes = await UserMemoryService.getUserMemory(id);
            if (!cancelled) {
              setMemoryData(memRes.data);
            }
          } catch (memErr) {
            console.error("No memory doc found or error:", memErr);
          }

          const tokensRef = collection(db, 'Users', id, 'generatedTokens');
          const tokensQuery = query(tokensRef, orderBy('createdAt', 'desc'));
          
          if (!cancelled) {
            unsubTokens = onSnapshot(tokensQuery, (tokensSnap) => {
              if (cancelled) return;
              const history = [];
              const logs = [];
              
              tokensSnap.forEach((tDoc) => {
                const tData = tDoc.data();
                const dateObj = tData.createdAt?.toDate ? tData.createdAt.toDate() : new Date();
                
                history.unshift({
                  name: dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  tokens: tData.tokens || tData.amount || 0
                });

                logs.push({
                  time: dateObj.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                  event: `Generated ${tData.tokens || tData.amount || 0} tokens`,
                  status: 'Success'
                });
              });
              
              setRawLogs(logs);
              setTokenHistory(history);
            });
          }
        }
      } catch (error) {
        console.error("User Detail Error:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchUser();

    return () => {
      cancelled = true;
      if (unsubTokens) {
        unsubTokens();
      }
      // Clean up React Query cache for this user's stats on unmount
      queryClient.removeQueries({ queryKey: ['userStats', id] });
    };
  }, [id, queryClient]);

  useEffect(() => {
    if (pageRef.current && !loading) {
      gsap.fromTo(pageRef.current, 
        { opacity: 0, scale: 0.98, y: 20 }, 
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "power3.out" }
      );
    }
  }, [loading]);

  if (loading) return <div className="text-center p-5 mt-5" style={{ color: '#D4AF37' }}>Loading User Profile...</div>;
  if (!user) return <div className="text-center p-5 mt-5 text-danger">User not found in the database.</div>;

  const statusColor = user.status === 'active' ? '#D4AF37' : '#DC143C';
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <div ref={pageRef}>
      <button 
        onClick={() => navigate('/users')} 
        className="btn btn-link px-0 mb-4 d-flex align-items-center gap-2"
        style={{ color: '#a8956b', textDecoration: 'none' }}
      >
        <ArrowLeft size={18} /> Back to Users
      </button>

      {/* Identity Card */}
      <MainCard className="mb-4" bodyClassName="d-flex align-items-center gap-4">
        {user.avatar ? (
          <img src={user.avatar} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid #D4AF37' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(212,175,55,0.1)', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: '2rem', fontWeight: 'bold' }}>
            {initial}
          </div>
        )}
        
        <div>
          <h2 style={{ color: '#D4AF37', margin: 0, fontWeight: 700 }}>{user.name}</h2>
          <div className="d-flex align-items-center gap-3 mt-2">
            <span style={{ padding: '4px 12px', borderRadius: '20px', backgroundColor: `rgba(${user.status === 'active' ? '212,175,55' : '220,20,60'}, 0.1)`, color: statusColor, fontSize: '0.8rem', fontWeight: 600, border: `1px solid ${statusColor}` }}>
              <Shield size={12} className="me-1" /> {user.status.toUpperCase()}
            </span>
            <span style={{ color: '#a8956b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} /> Joined {user.createdAt}
            </span>
          </div>
        </div>
      </MainCard>

      <UsageStatsSection userId={id} />

      <Row>
        {/* User Details */}
        <Col md={5}>
          <MainCard title="Account Profile" className="h-100">
            <ul className="list-group list-group-flush" style={{ background: 'transparent' }}>
               <li className="list-group-item d-flex align-items-center gap-3 py-3" style={{ background: 'transparent', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                 <Fingerprint size={18} color="#D4AF37" />
                 <div>
                    <small style={{ color: '#a8956b', display: 'block' }}>Account ID</small>
                    <strong style={{ color: '#e0d5b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>{user.id}</strong>
                 </div>
               </li>
               <li className="list-group-item d-flex align-items-center gap-3 py-3" style={{ background: 'transparent', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                 <Mail size={18} color="#D4AF37" />
                 <div>
                    <small style={{ color: '#a8956b', display: 'block' }}>Email Address</small>
                    <strong style={{ color: '#e0d5b8' }}>{user.email}</strong>
                 </div>
               </li>
               <li className="list-group-item d-flex align-items-center gap-3 py-3" style={{ background: 'transparent', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                 <MapPin size={18} color="#D4AF37" />
                 <div>
                    <small style={{ color: '#a8956b', display: 'block' }}>Location & Language</small>
                    <strong style={{ color: '#e0d5b8' }}>{user.country} • {user.selectedLanguage}</strong>
                 </div>
               </li>
               <li className="list-group-item d-flex align-items-center gap-3 py-3" style={{ background: 'transparent', borderBottom: 'none' }}>
                 <History size={18} color="#D4AF37" />
                 <div>
                    <small style={{ color: '#a8956b', display: 'block' }}>Last Activity</small>
                    <strong style={{ color: '#e0d5b8' }}>{rawLogs.length > 0 ? rawLogs[0].time : 'Awaiting activity...'}</strong>
                 </div>
               </li>
            </ul>
          </MainCard>
        </Col>

        {/* Usage History Section */}
        <Col md={7}>
          <MainCard title="Usage Trends" className="h-100" bodyClassName="d-flex flex-column">
             <div className="d-flex justify-content-between align-items-start mb-4">
                <div>
                   <h3 style={{ color: '#D4AF37', margin: 0 }}>₮ {user.tokens.toLocaleString()}</h3>
                   <span style={{fontSize: '0.85rem', color: '#a8956b'}}>Current Account Balance</span>
                </div>
                {user.freeDays > 0 && (
                   <div className="text-end" style={{ minWidth: '150px' }}>
                      <div className="d-flex justify-content-between mb-1">
                         <small style={{ color: '#a8956b' }}>Trial Access</small>
                         <small style={{ color: '#D4AF37' }}>{user.freeDays}d left</small>
                      </div>
                      <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                         <div style={{ width: `${Math.min((user.freeDays/30)*100, 100)}%`, height: '100%', backgroundColor: '#D4AF37' }}></div>
                      </div>
                   </div>
                )}
             </div>
             
             <div style={{ flex: 1, minHeight: "350px", width: "100%", position: "relative" }}>
                 {tokenHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={tokenHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" stroke="#5a5a5a" tick={{fill: '#a8956b', fontSize: 10}} />
                          <YAxis stroke="#5a5a5a" tick={{fill: '#a8956b', fontSize: 10}} />
                          <Tooltip 
                            contentStyle={{ background: 'rgba(10,10,10,0.9)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px' }} 
                            itemStyle={{ color: '#D4AF37', fontWeight: 600 }}
                          />
                          <Area type="monotone" dataKey="tokens" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorTokens)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 ) : (
                    <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-4">
                       <Zap size={48} color="rgba(212,175,55,0.1)" className="mb-3" />
                       <h5 style={{ color: '#a8956b', fontWeight: 500 }}>No Usage Records Found</h5>
                       <p style={{ color: 'rgba(168,149,107,0.6)', fontSize: '0.85rem', maxWidth: '300px' }}>
                          This account hasn't generated any tokens yet. Activity trends will appear here once usage begins.
                       </p>
                    </div>
                 )}
             </div>
          </MainCard>
        </Col>
      </Row>

      {/* Saved User Data */}
      <Row className="mt-4">
        <Col md={12}>
          <MainCard title={
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <UserIcon size={18} color="#D4AF37" />
                <span style={{ color: '#D4AF37' }}>Saved User Data & Preferences</span>
              </div>
              <button 
                className="btn btn-sm" 
                style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', padding: '4px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setSeedModalOpen(true)}
              >
                <Database size={14} />
                Seed Memory
              </button>
            </div>
          } bodyClassName="p-0">
             {memoryData ? (
               <MemoryGrid data={memoryData} />
             ) : (
               <div className="p-5 text-center" style={{ color: '#a8956b', fontStyle: 'italic' }}>
                 No persistent user preferences recorded.
               </div>
             )}
          </MainCard>
        </Col>
      </Row>

      {/* Activity Timeline */}
      <Row className="mt-4">
        <Col md={12}>
          <MainCard title={
            <div className="d-flex align-items-center gap-2">
              <Activity size={18} color="#D4AF37" />
              <span style={{ color: '#D4AF37' }}>Account Activity History</span>
            </div>
          } bodyClassName="p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{ background: 'rgba(212,175,55,0.05)' }}>
                  <tr>
                    <th style={{ color: '#D4AF37', borderBottom: 'none', paddingLeft: '24px' }}>Date & Time</th>
                    <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Action Description</th>
                    <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ color: '#e0d5b8', borderBottom: 'none', paddingLeft: '24px' }}>{user.createdAt}</td>
                    <td style={{ color: '#e0d5b8', borderBottom: 'none' }}>Account initialized in system</td>
                    <td style={{ borderBottom: 'none' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid #D4AF37' }}>SUCCESS</span>
                    </td>
                  </tr>

                  {rawLogs.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ color: '#e0d5b8', borderBottom: 'none', paddingLeft: '24px' }}>{log.time}</td>
                      <td style={{ color: '#e0d5b8', borderBottom: 'none' }}>{log.event}</td>
                      <td style={{ borderBottom: 'none' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.75rem', 
                          fontWeight: 600,
                          backgroundColor: log.status === 'Success' ? 'rgba(212,175,55,0.1)' : 'rgba(220,20,60,0.1)',
                          color: log.status === 'Success' ? '#D4AF37' : '#DC143C',
                          border: `1px solid ${log.status === 'Success' ? '#D4AF37' : '#DC143C'}`
                        }}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {rawLogs.length === 0 && (
                    <tr>
                      <td colSpan="3" className="text-center p-5" style={{ color: '#a8956b', fontStyle: 'italic' }}>
                        No additional activity has been recorded for this user yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </MainCard>
        </Col>
      </Row>

      {/* Seed Modal */}
      {seedModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            .custom-modal-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .custom-modal-scroll::-webkit-scrollbar-track {
              background: rgba(255,255,255,0.02);
              border-radius: 12px;
            }
            .custom-modal-scroll::-webkit-scrollbar-thumb {
              background: rgba(212,175,55,0.3);
              border-radius: 12px;
            }
            .custom-modal-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(212,175,55,0.6);
            }
          `}</style>
          <div className="custom-modal-scroll" style={{ background: '#111', width: '90%', maxWidth: '700px', borderRadius: '12px', border: '1px solid #D4AF37', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              onClick={() => setSeedModalOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#a8956b', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            
            <h4 style={{ color: '#D4AF37', marginBottom: '8px' }}>
              <Database size={20} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
              Seed Memory for {user?.displayName || id}
            </h4>
            <p style={{ color: '#a8956b', fontSize: '0.85rem', marginBottom: '24px' }}>
              Manually bootstrap the personalization memory record for this user.
            </p>
            
            <MemorySeedForm payload={seedPayload} onChange={setSeedPayload} isDark={true} />
            
            <div className="mt-4 pt-3 d-flex justify-content-end gap-3" style={{ borderTop: '1px solid rgba(212,175,55,0.2)' }}>
              <button 
                className="btn btn-outline-secondary" 
                style={{ color: '#fff' }} 
                onClick={() => setSeedModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ background: '#D4AF37', color: '#000', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} 
                onClick={async () => {
                  const sanitized = sanitizeMemoryPayload(seedPayload);
                  if (Object.keys(sanitized).length === 0) {
                    showToast('Payload cannot be completely empty after sanitization.', 'error');
                    return;
                  }
                  
                  setSeeding(true);
                  try {
                    const res = await MemoryBackfillService.seedUserMemory(id, sanitized);
                    showToast(res.result === 'skipped_has_memory' ? 'User already has memory.' : 'Memory seeded successfully!', 'success');
                    setSeedModalOpen(false);
                    if (res.memory_data) {
                      setMemoryData(res.memory_data);
                    } else {
                      // Attempt a re-fetch of memory if data wasn't in response but seeded
                      const memRes = await UserMemoryService.getUserMemory(id);
                      setMemoryData(memRes.data);
                    }
                  } catch (e) {
                    showToast(e?.response?.data?.message || 'Failed to seed memory', 'error');
                  } finally {
                    setSeeding(false);
                  }
                }}
                disabled={seeding || Object.keys(seedPayload).length === 0}
              >
                {seeding ? <Loader2 size={16} style={{ animation: 'pers-spin 1s linear infinite' }} /> : <Check size={16} />} 
                Confirm Seed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
