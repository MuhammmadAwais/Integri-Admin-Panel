import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';
import { ArrowLeft, Clock, MapPin, Mail, Shield, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { gsap } from 'gsap';
import MainCard from 'components/MainCard';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const docRef = doc(db, 'users', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUser({
            id: docSnap.id,
            name: data.name || 'Unknown',
            email: data.email || 'No Email',
            avatar: data.avatar || null,
            country: data.country || 'Unknown',
            tokens: data.tokens || 0,
            free_days: data.free_days || 0,
            createdAt: data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'Unknown',
            status: data.status || 'inactive'
          });
        }
      } catch (error) {
        console.error("Error fetching user detail:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
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

  // Simulate token history for sparkline
  const tokenHistoryData = [
    { name: 'Mon', tokens: Math.max(0, user.tokens - 500) },
    { name: 'Tue', tokens: Math.max(0, user.tokens - 300) },
    { name: 'Wed', tokens: Math.max(0, user.tokens - 200) },
    { name: 'Thu', tokens: Math.max(0, user.tokens + 100) },
    { name: 'Fri', tokens: user.tokens },
  ];

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
                    <strtong style={{ color: '#e0d5b8' }}>{user.email}</strtong>
                 </div>
               </li>
               <li className="list-group-item d-flex align-items-center gap-3 py-3" style={{ background: 'transparent', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                 <MapPin size={18} color="#D4AF37" />
                 <div>
                    <small style={{ color: '#a8956b', display: 'block' }}>Region</small>
                    <strtong style={{ color: '#e0d5b8' }}>{user.country}</strtong>
                 </div>
               </li>
               <li className="list-group-item d-flex align-items-center gap-3 py-3" style={{ background: 'transparent', borderBottom: 'none' }}>
                 <Zap size={18} color="#D4AF37" />
                 <div style={{ flex: 1 }}>
                    <div className="d-flex justify-content-between mb-1">
                       <small style={{ color: '#a8956b' }}>Free Days Remaining</small>
                       <small style={{ color: '#D4AF37' }}>{user.free_days}/30</small>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((user.free_days/30)*100, 100)}%`, height: '100%', backgroundColor: '#D4AF37' }}></div>
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
             
             <div style={{ flex: 1, minHeight: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={tokenHistoryData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
    </div>
  );
}
