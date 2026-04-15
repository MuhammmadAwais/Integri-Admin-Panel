import React from 'react';
import { useSelector } from 'react-redux';

// assets
import logoPrimary from 'assets/images/integri-light.png'; // Gold/White logo for dark backgrounds
import logoInk from 'assets/images/integri-dark.png';    // Dark/Obsidian logo for light backgrounds

/**
 * Integri Logo Component — Swaps assets based on Redux isDark state.
 */
const Logo = ({ width = 120, height = 'auto', className = '' }) => {
  const isDark = useSelector((state) => state.theme.isDark);

  return (
    <div className={`integri-logo-container d-flex align-items-center gap-2 ${className}`}>
      {/* 
        In Dark Mode (isDark: true), use the "Light" logo (Gold/White).
        In Light Mode (isDark: false), use the "Dark" logo (Obsidian).
      */}
      <div className="d-flex align-items-center" style={{ height: 32 }}>
        <img
          src={isDark ? logoPrimary : logoInk}
          alt="Integri AI Logo"
          style={{ width: 28, height: 28, objectFit: 'contain', display: 'block' }}
        />
      </div>
      <span style={{ 
        fontWeight: 800, 
        fontSize: '1.4rem', 
        letterSpacing: '-1px',
        color: isDark ? '#ffffff' : '#000000',
        fontFamily: "'Inter', sans-serif",
        lineHeight: 1,
        display: 'inline-block'
      }}>
        Integri
      </span>
    </div>
  );
};

export default Logo;
