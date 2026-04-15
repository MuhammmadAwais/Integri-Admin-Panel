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
      <img
        src={isDark ? logoPrimary : logoInk}
        alt="Integri AI Logo"
        style={{ width: 32, height: 32, objectFit: 'contain' }}
      />
      <span style={{ 
        fontWeight: 800, 
        fontSize: '1.5rem', 
        letterSpacing: '-0.5px',
        color: 'inherit',
        fontFamily: "'Inter', sans-serif"
      }}>
        Integri
      </span>
    </div>
  );
};

export default Logo;
