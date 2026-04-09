import React, { useMemo, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { gsap } from 'gsap';
import MainCard from 'components/MainCard';

export default function UserActivityGraph({ users }) {
  const wrapperRef = useRef(null);

  // Simulate historical data based on current user counts to make the graph look alive
  // In a real app, you would query an actual timeseries collection.
  const data = useMemo(() => {
    // Generate some stable fake data points leading up to 'now'
    const baseOnline = Math.max(10, Math.floor(users.length * 0.4));
    const baseLogins = Math.max(5, Math.floor(users.length * 0.2));
    
    const timeSeries = [];
    const now = new Date();
    
    for (let i = 10; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000); // Past 10 minutes
      // Add a little randomness but anchor to base metrics
      const noise1 = Math.floor(Math.sin(i) * baseOnline * 0.2); 
      const noise2 = Math.floor(Math.cos(i) * baseLogins * 0.3);
      
      timeSeries.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        online: Math.max(0, baseOnline + noise1),
        logins: Math.max(0, baseLogins + noise2)
      });
    }
    
    // Make the last point reflect current actual "online" estimate
    if (timeSeries.length > 0) {
      timeSeries[timeSeries.length - 1].online = users.length; // Just a proxy for "current activity"
    }

    return timeSeries;
  }, [users]);

  useEffect(() => {
    if (wrapperRef.current) {
      gsap.fromTo(wrapperRef.current, 
        { opacity: 0, scale: 0.95 }, 
        { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" }
      );
    }
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(10, 10, 10, 0.9)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          padding: '10px 15px',
          borderRadius: '8px',
          backdropFilter: 'blur(8px)',
          color: '#e0d5b8'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#a8956b', fontWeight: 600 }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color }}></span>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>{entry.name}: {entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <MainCard title="Activity Pulse" bodyClassName="p-3" ref={wrapperRef}>
      <div style={{ width: '100%', height: '400px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="time" stroke="#5a5a5a" tick={{ fill: '#a8956b', fontSize: 12 }} />
            <YAxis stroke="#5a5a5a" tick={{ fill: '#a8956b', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="online" 
              name="Online Now"
              stroke="#D4AF37" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#050505', stroke: '#D4AF37', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#D4AF37', stroke: '#fff' }}
              animationDuration={1500}
            />
            <Line 
              type="monotone" 
              dataKey="logins" 
              name="Recent Logins"
              stroke="#DC143C" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </MainCard>
  );
}
