import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Sun, Moon } from 'lucide-react';
import { toggleTheme } from 'store/slices/themeSlice';
import { cn } from 'lib/utils';

/**
 * High-end Theme Toggle Component
 * Integrates with Redux state and provides smooth visual feedback.
 */
const ThemeToggle = ({ className }) => {
  const dispatch = useDispatch();
  const isDark = useSelector((state) => state.theme.isDark);

  const handleToggle = () => {
    dispatch(toggleTheme());
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "p-2 rounded-xl transition-all duration-300 ease-in-out",
        "flex items-center justify-center border",
        "hover:scale-105 active:scale-95",
        // Visuals for Dark Mode
        isDark 
          ? "bg-zinc-900/50 border-gold-glow text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]" 
          : "bg-white border-zinc-200 text-zinc-900 shadow-sm hover:shadow-md",
        className
      )}
      aria-label="Toggle Theme"
      style={{
        border: '1px solid var(--integri-border)',
        background: 'var(--integri-surface)',
        color: 'var(--integri-text)',
        minWidth: '40px',
        minHeight: '40px'
      }}
    >
      {isDark ? (
        <Sun size={20} className="text-[#D4AF37]" />
      ) : (
        <Moon size={20} className="text-[#18181B]" />
      )}
    </button>
  );
};

export default ThemeToggle;
