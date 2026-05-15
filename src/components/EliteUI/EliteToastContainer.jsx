import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gsap } from 'gsap';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import ElitePortal from './ElitePortal';

let toastCount = 0;
let addToastFn = null;

export const showToast = (message, type = 'success') => {
  if (addToastFn) {
    addToastFn(message, type);
  }
};

const Toast = ({ id, message, type, onRemove }) => {
  const toastRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(toastRef.current, 
      { x: 100, opacity: 0, scale: 0.8 }, 
      { x: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }
    );

    const timer = setTimeout(() => {
      handleRemove();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    gsap.to(toastRef.current, { 
      x: 100, 
      opacity: 0, 
      scale: 0.8, 
      duration: 0.4, 
      ease: 'power2.in',
      onComplete: () => onRemove(id)
    });
  };

  const colors = {
    success: {
      bg: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.3)',
      text: '#22c55e',
      icon: <CheckCircle size={18} />
    },
    error: {
      bg: 'rgba(220, 20, 60, 0.1)',
      border: 'rgba(220, 20, 60, 0.3)',
      text: '#DC143C',
      icon: <AlertCircle size={18} />
    }
  };

  const style = colors[type] || colors.success;

  return (
    <div 
      ref={toastRef}
      style={{
        background: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${style.border}`,
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        width: '320px',
        pointerEvents: 'auto'
      }}
    >
      <div style={{ color: style.text, display: 'flex' }}>
        {style.icon}
      </div>
      <div style={{ color: '#e4e4e7', fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>
        {message}
      </div>
      <button 
        onClick={handleRemove}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#71717a',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex'
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

const EliteToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type) => {
    const id = ++toastCount;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  return (
    <ElitePortal>
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 10000,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}>
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onRemove={removeToast} />
        ))}
      </div>
    </ElitePortal>
  );
};

export default EliteToastContainer;
