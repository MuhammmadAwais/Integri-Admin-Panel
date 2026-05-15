import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import ElitePortal from './ElitePortal';
import { X } from 'lucide-react';

const EliteModal = ({ isOpen, onClose, title, children, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, type = 'danger' }) => {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const tl = gsap.timeline();
      tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      tl.fromTo(modalRef.current, { opacity: 0, scale: 0.9, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' }, "-=0.2");
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isOpen]);

  const handleClose = () => {
    const tl = gsap.timeline({
      onComplete: onClose
    });
    tl.to(modalRef.current, { opacity: 0, scale: 0.9, y: 20, duration: 0.3, ease: 'power2.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' }, "-=0.1");
  };

  if (!isOpen) return null;

  return (
    <ElitePortal>
      <div 
        ref={overlayRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={handleClose}
      >
        <div 
          ref={modalRef}
          style={{
            background: 'var(--integri-surface, #0a0a0a)',
            border: '1px solid var(--integri-border, rgba(212, 175, 55, 0.2))',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--integri-border, rgba(212, 175, 55, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '1.25rem', 
              fontWeight: 700, 
              color: 'var(--integri-gold, #D4AF37)',
              letterSpacing: '0.5px'
            }}>
              {title}
            </h3>
            <button 
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--integri-text-muted, #71717a)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                display: 'flex',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--integri-text-muted, #71717a)'}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '24px', color: 'var(--integri-text, #e4e4e7)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {children}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button 
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--integri-border, rgba(212, 175, 55, 0.2))',
                color: 'var(--integri-text, #e4e4e7)',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm?.();
                handleClose();
              }}
              style={{
                background: type === 'danger' ? 'rgba(220, 20, 60, 0.15)' : 'rgba(212, 175, 55, 0.15)',
                border: `1px solid ${type === 'danger' ? '#DC143C' : '#D4AF37'}`,
                color: type === 'danger' ? '#DC143C' : '#D4AF37',
                padding: '10px 24px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = type === 'danger' ? '#DC143C' : '#D4AF37';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = type === 'danger' ? 'rgba(220, 20, 60, 0.15)' : 'rgba(212, 175, 55, 0.15)';
                e.currentTarget.style.color = type === 'danger' ? '#DC143C' : '#D4AF37';
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </ElitePortal>
  );
};

export default EliteModal;
