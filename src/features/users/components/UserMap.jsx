import React, { useMemo, useEffect, useRef } from 'react';
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
  "China": [104.1954, 35.8617]
};

export default function UserMap({ users, globalFilter, setGlobalFilter }) {
  const markerGroupRef = useRef(null);

  // Aggregate users by country
  const countryCounts = useMemo(() => {
    const counts = {};
    users.forEach(user => {
      const country = user.country;
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

  // GSAP pulse animation for markers
  useEffect(() => {
    if (markerGroupRef.current) {
      const circles = markerGroupRef.current.querySelectorAll('.pulse-circle');
      if (circles.length > 0) {
        gsap.to(circles, {
          scale: 1.5,
          opacity: 0,
          duration: 1.5,
          repeat: -1,
          stagger: 0.2,
          ease: "power1.out"
        });
      }
    }
  }, [markers]);

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
      
      <div style={{ width: '100%', height: '400px', background: '#060606', borderRadius: '0 0 12px 12px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <ComposableMap projectionConfig={{ scale: 140 }}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1a1a1a"
                  stroke="rgba(212, 175, 55, 0.3)"
                  strokeWidth={0.5}
                  className="cursor-pointer"
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#2a2a2a", outline: "none" },
                    pressed: { outline: "none" }
                  }}
                />
              ))
            }
          </Geographies>

          <g ref={markerGroupRef}>
            {markers.map(({ name, coordinates, size }) => {
              const isActive = globalFilter?.toLowerCase() === name.toLowerCase();
              const markerColor = isActive ? "#DC143C" : "#D4AF37";

              return (
                <Marker key={name} coordinates={coordinates} onClick={() => setGlobalFilter(isActive ? '' : name)} style={{ cursor: 'pointer' }}>
                  {/* Animating outer pulse ring */}
                  <circle 
                    className="pulse-circle"
                    r={size} 
                    fill="none" 
                    stroke={markerColor} 
                    strokeWidth={2}
                  />
                  {/* Inner solid circle */}
                  <circle 
                    r={size * 0.6} 
                    fill={markerColor} 
                  />
                  <text
                    textAnchor="middle"
                    y={-size - 5}
                    style={{ fontFamily: "system-ui", fill: "#e0d5b8", fontSize: "10px", pointerEvents: "none" }}
                  >
                    {name}
                  </text>
                </Marker>
              );
            })}
          </g>
        </ComposableMap>
      </div>
    </MainCard>
  );
}
