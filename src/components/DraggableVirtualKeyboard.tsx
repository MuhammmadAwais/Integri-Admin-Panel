import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Grid3X3 } from 'lucide-react';
import { KEYBOARD_LAYOUTS, KeyboardLayout } from '../utils/keyboardLayouts';

interface DraggableVirtualKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

export const DraggableVirtualKeyboard: React.FC<DraggableVirtualKeyboardProps> = ({ isOpen, onClose, language }) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  const portalNode = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.id = 'vkb-portal-root';
    return el;
  }, []);

  useEffect(() => {
    if (!portalNode) return;
    document.body.appendChild(portalNode);

    const stopNative = (e: Event) => e.stopPropagation();
    portalNode.addEventListener('mousedown', stopNative);
    portalNode.addEventListener('click', stopNative);
    portalNode.addEventListener('touchstart', stopNative);

    return () => {
      portalNode.removeEventListener('mousedown', stopNative);
      portalNode.removeEventListener('click', stopNative);
      portalNode.removeEventListener('touchstart', stopNative);
      if (portalNode.parentNode) {
        portalNode.parentNode.removeChild(portalNode);
      }
    };
  }, [portalNode]);

  // Position it in the center initially when opened
  useEffect(() => {
    if (isOpen) {
      setPosition({
        x: window.innerWidth / 2 - 250, // 500/2
        y: window.innerHeight / 2 - 150,
      });
    }
  }, [isOpen]);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (isDragging && dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy,
      });
    }
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  if (!isOpen || !portalNode) return null;

  const activeKb: KeyboardLayout = KEYBOARD_LAYOUTS[language] || KEYBOARD_LAYOUTS['english'];

  const typeIntoActiveElement = (char: string) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      const input = activeEl as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const text = input.value;
      
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      
      const keydownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true });
      input.dispatchEvent(keydownEvent);

      // Update value natively
      input.value = before + char + after;
      input.selectionStart = input.selectionEnd = start + char.length;

      // Dispatch event to trigger React onChange
      const event = new Event('input', { bubbles: true });
      // React 16+ overrides the value setter, we need to bypass it to fire change properly:
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      
      if (input.tagName === 'INPUT' && nativeInputValueSetter) {
        nativeInputValueSetter.call(input, input.value);
      } else if (input.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(input, input.value);
      }
      
      input.dispatchEvent(event);

      const changeEvent = new Event('change', { bubbles: true });
      input.dispatchEvent(changeEvent);

      const keyupEvent = new KeyboardEvent('keyup', { key: char, bubbles: true });
      input.dispatchEvent(keyupEvent);
    }
  };

  const handleBackspace = () => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      const input = activeEl as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const text = input.value;
      
      if (start === end && start > 0) {
        input.value = text.substring(0, start - 1) + text.substring(end, text.length);
        input.selectionStart = input.selectionEnd = start - 1;
      } else if (start !== end) {
        input.value = text.substring(0, start) + text.substring(end, text.length);
        input.selectionStart = input.selectionEnd = start;
      }

      const keydownEvent = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
      input.dispatchEvent(keydownEvent);

      const event = new Event('input', { bubbles: true });
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      
      if (input.tagName === 'INPUT' && nativeInputValueSetter) {
        nativeInputValueSetter.call(input, input.value);
      } else if (input.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(input, input.value);
      }
      input.dispatchEvent(event);

      const changeEvent = new Event('change', { bubbles: true });
      input.dispatchEvent(changeEvent);

      const keyupEvent = new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true });
      input.dispatchEvent(keyupEvent);
    }
  };

  return createPortal(
    <div
      onMouseDown={(e) => {
        e.preventDefault(); // prevent focus stealing when clicking anywhere on the keyboard background
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 999999, // extremely high to stay over all modals
        background: '#09090b',
        border: '1px solid rgba(212, 175, 55, 0.4)',
        borderRadius: '12px',
        boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: 'max-content',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={onMouseDown}
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(90deg, rgba(212,175,55,0.18) 0%, rgba(9,9,11,0.9) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Grid3X3 size={16} color="#D4AF37" />
          <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>
            {activeKb.flag} {activeKb.label}
          </span>
        </div>
        <button
          onClick={onClose}
          onMouseDown={e => e.preventDefault()} // prevent focus steal
          style={{
            background: 'transparent',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4
          }}
        >
          <X size={18} />
        </button>
      </div>


      {/* Keyboard Grid */}
      <div
        dir={activeKb.dir}
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}
      >
        {activeKb.keys.map((row, rIdx) => (
          <div key={rIdx} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {row.map((char) => (
              <button
                key={char}
                onMouseDown={(e) => {
                  e.preventDefault(); // crucial to not steal focus from the input
                  e.currentTarget.style.transform = 'scale(0.95)';
                  typeIntoActiveElement(char);
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'none';
                }}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff',
                  minWidth: char.length > 2 ? 60 : 36,
                  height: 38,
                  borderRadius: 6,
                  fontSize: char.length > 2 ? '0.78rem' : '1.1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                   justifyContent: 'center',
                  transition: 'background-color 0.1s ease, transform 0.05s ease',
                  userSelect: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {char}
              </button>
            ))}
          </div>
        ))}

        {/* Control Action Row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, justifyContent: 'center' }}>
          <button
            onMouseDown={(e) => { e.preventDefault(); typeIntoActiveElement(' '); }}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              flex: 1,
              height: 38,
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            SPACE
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); handleBackspace(); }}
            style={{
              background: 'rgba(220,20,60,0.18)',
              border: '1px solid rgba(220,20,60,0.45)',
              color: '#ff4d6d',
              padding: '0 20px',
              height: 38,
              borderRadius: 6,
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ⌫ BACKSPACE
          </button>
        </div>
      </div>
    </div>,
    portalNode
  );
};
