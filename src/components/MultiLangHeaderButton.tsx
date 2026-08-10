import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import MultiLangAssistantModal from './MultiLangAssistantModal';

export const MultiLangHeaderButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Multi-Language Keyboard & Input Assistant"
        className="pc-head-link me-2 border-0 bg-transparent"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#D4AF37',
          padding: '6px 12px',
          borderRadius: '20px',
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          cursor: 'pointer',
          fontSize: '0.78rem',
          fontWeight: 700,
          transition: 'all 0.2s ease shadow'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(212, 175, 55, 0.2)';
          e.currentTarget.style.boxShadow = '0 0 12px rgba(212, 175, 55, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Globe size={16} color="#D4AF37" />
        <span className="d-none d-sm-inline">Multi-Lang Tools</span>
      </button>

      <MultiLangAssistantModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default MultiLangHeaderButton;
