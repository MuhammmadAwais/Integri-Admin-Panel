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
    <div className={`integri-logo-container d-flex align-items-center ${className}`}>
      {/* 
        In Dark Mode (isDark: true), use the "Light" logo (Gold/White).
        In Light Mode (isDark: false), use the "Dark" logo (Obsidian).
      */}
      <img
        src={isDark ? logoPrimary : logoInk}
        alt="Integri AI Logo"
        style={{ width, height, objectFit: 'contain' }}
      />
    </div>
  );
};

export default Logo;
