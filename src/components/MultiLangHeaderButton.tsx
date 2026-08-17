import React, { useState } from 'react';
import { Keyboard, ChevronDown } from 'lucide-react';
import { DraggableVirtualKeyboard } from './DraggableVirtualKeyboard';
import { KEYBOARD_LAYOUTS } from '../utils/keyboardLayouts';
import Dropdown from 'react-bootstrap/Dropdown';

export const MultiLangHeaderButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState('urdu');

  const activeKb = KEYBOARD_LAYOUTS[language] || KEYBOARD_LAYOUTS['english'];

  return (
    <>
      <style>{`
        .custom-lang-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-lang-scrollbar::-webkit-scrollbar-track { background: #1e1e24; border-radius: 4px; }
        .custom-lang-scrollbar::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 4px; }
        .custom-lang-scrollbar::-webkit-scrollbar-thumb:hover { background: #e5c35b; }
      `}</style>

      <Dropdown align="end" className="d-flex align-items-center">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Toggle Virtual Keyboard"
          className="pc-head-link arrow-none border-0"
          style={{
            background: isOpen ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
            color: '#D4AF37',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <Keyboard size={20} />
        </button>

        <Dropdown.Toggle 
          variant="link" 
          className="pc-head-link arrow-none border-0 text-decoration-none shadow-none p-0 d-flex align-items-center"
          style={{ color: '#D4AF37', outline: 'none', marginLeft: '4px' }}
        >
          <span style={{ fontSize: '1.1rem', margin: '0 4px' }}>{activeKb.flag}</span>
          <ChevronDown size={14} />
        </Dropdown.Toggle>

        <Dropdown.Menu 
          className="custom-lang-scrollbar"
          style={{ 
            maxHeight: '350px', 
            overflowY: 'auto', 
            background: '#18181b', 
            border: '1px solid rgba(212,175,55,0.2)', 
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            scrollbarWidth: 'thin',
            scrollbarColor: '#D4AF37 #1e1e24'
          }}
        >
          <Dropdown.Header style={{ color: '#a1a1aa', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Select Language</Dropdown.Header>
          {Object.keys(KEYBOARD_LAYOUTS).map((key) => {
            const kb = KEYBOARD_LAYOUTS[key];
            return (
              <Dropdown.Item 
                key={key} 
                onClick={() => setLanguage(key)}
                style={{ color: '#fff', fontSize: '0.85rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span style={{ fontSize: '1.1rem' }}>{kb.flag}</span> {kb.label}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown>

      {/* ── DRAGGABLE KEYBOARD ── */}
      <DraggableVirtualKeyboard isOpen={isOpen} onClose={() => setIsOpen(false)} language={language} />
    </>
  );
};

export default MultiLangHeaderButton;
