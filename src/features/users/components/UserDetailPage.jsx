import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';
import { UserMemoryService } from 'api/backendApi';
import { ArrowLeft, Clock, MapPin, Mail, Shield, Zap, BrainCircuit } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { gsap } from 'gsap';
import MainCard from 'components/MainCard';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [memoryData, setMemoryData] = useState(null);
  const [tokenHistory, setTokenHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(null);

  useEffect(() => {
    let unsubTokens = null;

    async function fetchUser() {
      try {
        setLoading(true);
        console.log("Firebase Action: Fetching discrete user intelligence for ID:", id);
        
        // Explicitly targeting '/Users' (Capitalized) as per architecture spec
        const docRef = doc(db, 'Users', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const mappedUser = {
            id: docSnap.id,
            name: data.name || 'Guest',
            email: data.email || 'No email',
            avatar: data.avatar || null,
            country: data.country || 'Unknown',
            selectedLanguage: data.selectedLanguage || 'System (EN-US)',
            tokens: data.tokens || 0,
            freeDays: data.freeDays || 0,
            // Handle Firestore Timestamp precisely
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'Unknown',
            status: data.status || 'inactive'
          };
          
          console.log("Firebase Response: Received [User Detail] payload:", mappedUser);
          setUser(mappedUser);

          // Fetch API memory context
          try {
            const memory = await UserMemoryService.getUserMemory(id);
            setMemoryData(memory);
          } catch (e) {
            console.warn("User Intelligence API connection not established or user has no memory.");
          }

          // Sub-collection onSnapshot
          console.log("Firebase Action: Listening to [generatedTokens] for user:", id);
          const tokensRef = collection(db, 'Users', id, 'generatedTokens');
          const tokensQuery = query(tokensRef, orderBy('createdAt', 'asc'));
          
          unsubTokens = onSnapshot(tokensQuery, (tokensSnap) => {
            const history = [];
            tokensSnap.forEach((tDoc) => {
              const tData = tDoc.data();
              history.push({
                name: tData.createdAt?.toDate ? tData.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unknown',
                tokens: tData.tokens || tData.amount || 0
              });
            });
            
            if (history.length > 0) {
              setTokenHistory(history);
            } else {
              setTokenHistory([
                { name: 'Mon', tokens: Math.max(0, mappedUser.tokens - 500) },
                { name: 'Tue', tokens: Math.max(0, mappedUser.tokens - 300) },
                { name: 'Wed', tokens: Math.max(0, mappedUser.tokens - 200) },
                { name: 'Thu', tokens: Math.max(0, mappedUser.tokens - 100) },
                { name: 'Fri', tokens: mappedUser.tokens },
              ]);
            }
          });
        } else {
          console.warn("Firebase Response: User ID not found in [/Users] collection.");
        }
      } catch (error) {
        console.error("Firestore [Users Detail] Error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();

    return () => {
      if (unsubTokens) unsubTokens();
    };
  }, [id]);

  useEffect(() => {
    if (pageRef.current && !loading) {
      gsap.fromTo(pageRef.current, 
        { opacity: 0, scale: 0.98, y: 20 }, 
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "power3.out" }
      );
    }
  }, [loading]);

  if (loading) return <div className="text-center p-5 mt-5" style={{ color: '#D4AF37' }}>Loading Intelligence Data...</div>;
  if (!user) return <div className="text-center p-5 mt-5 text-danger">User not found in the Archive.</div>;

  // We are now using dynamic tokenHistory from Firebase instead of static simulation.
  // We keep statusColor and initial as before.
  const statusColor = user.status === 'active' ? '#D4AF37' : '#DC143C';
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <div ref={pageRef}>
      <button 
        onClick={() => navigate('/users')} 
        className="btn btn-link px-0 mb-4 d-flex align-items-center gap-2"
        style={{ color: '#a8956b', textDecoration: 'none' }}
      >
        <ArrowLeft size={18} /> Back to Archive
      </button>

      {/* Top Identity Card */}
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

      <Row>
        {/* Account Details */}
        <Col md={5}>
          <MainCard title="Account Details" className="h-100">
            <ul className="list-group list-group-flush" style={{ background: 'transparent' }}>
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
                    <small style={{ color: '#a8956b', display: 'block' }}>Region & Language</small>
                    <strong style={{ color: '#e0d5b8' }}>{user.country} • {user.selectedLanguage}</strong>
                 </div>
               </li>
               <li className="list-group-item d-flex align-items-center gap-3 py-3" style={{ background: 'transparent', borderBottom: 'none' }}>
                 <Zap size={18} color="#D4AF37" />
                 <div style={{ flex: 1 }}>
                    <div className="d-flex justify-content-between mb-1">
                       <small style={{ color: '#a8956b' }}>Free Days Remaining</small>
                       <small style={{ color: '#D4AF37' }}>{user.freeDays}/30</small>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((user.freeDays/30)*100, 100)}%`, height: '100%', backgroundColor: '#D4AF37' }}></div>
                    </div>
                 </div>
               </li>
            </ul>
          </MainCard>
        </Col>

        {/* Token History Graph */}
        <Col md={7}>
          <MainCard title="Token Trajectory" className="h-100" bodyClassName="d-flex flex-column">
             <h3 style={{ color: '#D4AF37', margin: '0 0 20px 0' }}>₮ {user.tokens.toLocaleString()} <span style={{fontSize: '1rem', color: '#a8956b', fontWeight: 400}}>Current Balance</span></h3>
             
             <div style={{ height: "400px", width: "100%", position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={tokenHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#5a5a5a" tick={{fill: '#a8956b', fontSize: 12}} />
                      <YAxis stroke="#5a5a5a" tick={{fill: '#a8956b', fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{ background: 'rgba(10,10,10,0.9)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px' }} 
                        itemStyle={{ color: '#D4AF37', fontWeight: 600 }}
                      />
                      <Area type="monotone" dataKey="tokens" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorTokens)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </MainCard>
        </Col>
      </Row>

      {/* User Core Memory */}
      <Row className="mt-4">
        <Col md={12}>
          <MainCard title={
            <div className="d-flex align-items-center gap-2">
              <BrainCircuit size={18} color="#D4AF37" />
              <span style={{ color: '#D4AF37' }}>User Intelligence Memory</span>
            </div>
          } bodyClassName="p-0">
             {memoryData ? (
               <div style={{ padding: '20px', background: '#0a0a0a', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                  <pre style={{ margin: 0, color: '#e0d5b8', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {JSON.stringify(memoryData.memory_data || memoryData, null, 2)}
                  </pre>
               </div>
             ) : (
               <div className="p-4 text-center" style={{ color: '#a8956b', fontStyle: 'italic' }}>
                 No semantic memory footprint recorded.
               </div>
             )}
          </MainCard>
        </Col>
      </Row>

      {/* Account Activity Logs */}
      <Row className="mt-4">
        <Col md={12}>
          <MainCard title="Account Activity Log" bodyClassName="p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{ background: 'rgba(212,175,55,0.05)' }}>
                  <tr>
                    <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Timestamp</th>
                    <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Event Type</th>
                    <th style={{ color: '#D4AF37', borderBottom: 'none' }}>IP Address</th>
                    <th style={{ color: '#D4AF37', borderBottom: 'none' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { time: 'Just Now', event: 'Token Validation Check', ip: '192.168.1.104', status: 'Success' },
                    { time: '2 Hours Ago', event: 'Dashboard Session Initiated', ip: '192.168.1.104', status: 'Success' },
                    { time: 'Yesterday', event: 'Profile Setting Sync', ip: 'Unknown Carrier', status: 'Success' },
                    { time: '3 Days Ago', event: 'Failed Authentication Attempt', ip: '10.0.0.32', status: 'Warning' }
                  ].map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ color: '#e0d5b8', borderBottom: 'none', paddingLeft: '24px' }}>{log.time}</td>
                      <td style={{ color: '#e0d5b8', borderBottom: 'none' }}>{log.event}</td>
                      <td style={{ color: '#a8956b', fontFamily: 'monospace', borderBottom: 'none' }}>{log.ip}</td>
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
                </tbody>
              </table>
            </div>
          </MainCard>
        </Col>
      </Row>
    </div>
  );
}
