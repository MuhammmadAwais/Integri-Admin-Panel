import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { gsap } from 'gsap';
import MainCard from 'components/MainCard';

// TopoJSON URL for world map
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Mapping country text from DB to iso-a2 or similar for coords could be complex.
// For MVP, we'll use a simplified predefined list of coordinates for major countries.
// In a full prod version, a proper geocoding service or complete map would be used.
const countryCoordinates = {
  "USA": [-95.7129, 37.0902],
  "United States": [-95.7129, 37.0902],
  "UK": [-3.4359, 55.3781],
  "United Kingdom": [-3.4359, 55.3781],
  "India": [78.9629, 20.5937],
  "Germany": [10.4515, 51.1657],
  "France": [2.2137, 46.2276],
  "Brazil": [-51.9253, -14.2350],
  "Australia": [133.7751, -25.2744],
  "Canada": [-106.3468, 56.1304],
  "Japan": [138.2529, 36.2048],
  "China": [104.1954, 35.8617],
  "Pakistan": [69.3451, 30.3753],
  "PK": [69.3451, 30.3753]
};

const UserMap = React.memo(({ users, globalFilter, setGlobalFilter }) => {
  const hoverMarkerRef = useRef(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  const countryCounts = useMemo(() => {
    const counts = {};
    const norm = {
      'PK': 'Pakistan',
      'USA': 'United States',
      'UK': 'United Kingdom'
    };
    users.forEach(user => {
      let country = user.country;
      if (country && norm[country]) country = norm[country];
      
      if (country && country !== 'Unknown') {
        counts[country] = (counts[country] || 0) + 1;
      }
    });
    return counts;
  }, [users]);

  // Generate markers based on aggregated counts and known coordinates
  const markers = useMemo(() => {
    return Object.entries(countryCounts)
      .filter(([country]) => countryCoordinates[country]) // Only show if we have coords
      .map(([name, count]) => ({
        name,
        coordinates: countryCoordinates[name],
        count,
        // Scale size based on count, e.g., sqrt
        size: Math.max(4, Math.sqrt(count) * 2) 
      }));
  }, [countryCounts]);

  // GSAP animation for the hover marker pop-in
  useEffect(() => {
    if (hoveredCountry && hoverMarkerRef.current) {
      gsap.fromTo(hoverMarkerRef.current,
        { scale: 0, opacity: 0, y: 10 },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.7)" }
      );
      
      const pulseRing = hoverMarkerRef.current.querySelector('.pulse-ring');
      if (pulseRing) {
        gsap.to(pulseRing, {
          scale: 2.2,
          opacity: 0,
          duration: 1.2,
          repeat: -1,
          ease: "power2.out"
        });
      }
    }
  }, [hoveredCountry]);

  return (
    <MainCard title="Geo-Pulse" bodyClassName="p-0 position-relative">
      {globalFilter && (
        <div style={{ position: 'absolute', top: 15, right: 15, zIndex: 10 }}>
          <button 
            className="btn btn-sm" 
            style={{ backgroundColor: '#DC143C', color: '#fff', border: 'none', borderRadius: '4px' }}
            onClick={() => setGlobalFilter('')}
          >
            Clear Filter: {globalFilter}
          </button>
        </div>
      )}
      
      <div className="d-flex justify-content-center align-items-center" style={{ width: '100%', height: '400px', background: 'var(--map-bg)', borderRadius: '0 0 12px 12px', position: 'relative' }}>
        <ComposableMap projectionConfig={{ scale: 140 }}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="var(--map-country-fill)"
                  stroke="var(--map-country-stroke)"
                  strokeWidth={0.5}
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    const cname = geo.properties.name;
                    // Check our mapped markers bounds for valid data points
                    const target = markers.find(m => m.name === cname);
                    if (target) {
                      setHoveredCountry(target);
                    }
                  }}
                  onMouseLeave={() => setHoveredCountry(null)}
                  style={{
                    default: { outline: "none", cursor: 'pointer' },
                    hover: { fill: "var(--map-country-hover)", outline: "none", cursor: 'pointer' },
                    pressed: { outline: "none", cursor: 'pointer' }
                  }}
                />
              ))
            }
          </Geographies>

          {hoveredCountry && (
            <Marker key="hover-marker" coordinates={hoveredCountry.coordinates}>
              <g ref={hoverMarkerRef} style={{ pointerEvents: 'none' }}>
                <defs>
                  <filter id="shadow3d" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="var(--map-marker-stroke)" floodOpacity="0.6"/>
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                    <feOffset dy="1" dx="0" result="offsetblur" />
                    <feComponentTransfer><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle className="pulse-ring" r="14" fill="none" stroke="var(--map-marker-stroke)" strokeWidth="2" />
                <circle r="14" fill="var(--map-marker-fill)" stroke="var(--map-marker-stroke)" strokeWidth="2" filter="url(#shadow3d)" />
                <text 
                  textAnchor="middle" 
                  y="4" 
                  style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 'bold', fill: 'var(--map-marker-stroke)' }}
                >
                  {hoveredCountry.count}
                </text>
                <rect x="-35" y="-30" width="70" height="14" rx="4" fill="var(--map-bg)" style={{ opacity: 0.85 }} stroke="var(--map-country-stroke)" strokeWidth="0.5" />
                <text textAnchor="middle" y="-20" style={{ fontFamily: 'system-ui', fontSize: '9px', fill: 'var(--map-marker-stroke)', fontWeight: 600 }}>
                  {hoveredCountry.name}
                </text>
              </g>
            </Marker>
          )}
        </ComposableMap>
      </div>
    </MainCard>
  );
});

export default UserMap;
