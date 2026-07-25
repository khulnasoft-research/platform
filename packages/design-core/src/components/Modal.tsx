import { useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ModalSize } from './modal.js';

const sizeMap: Record<ModalSize, Record<string, string>> = {
  sm: { maxWidth: '24rem' },
  md: { maxWidth: '32rem' },
  lg: { maxWidth: '42rem' },
  xl: { maxWidth: '56rem' },
  full: { maxWidth: '100%', margin: '0 1rem' },
};

export function Modal({
  open,
  size = 'md',
  title,
  description,
  children,
  onClose,
  closeOnOverlay = true,
  showCloseButton = true,
}: {
  open: boolean;
  size?: ModalSize;
  title?: string;
  description?: string;
  children?: ReactNode;
  onClose: () => void;
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const overlayStyle: Record<string, string> = {
    position: 'fixed',
    inset: '0',
    zIndex: '50',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: '1rem',
  };

  const modalStyle: Record<string, string> = {
    width: '100%',
    backgroundColor: 'var(--color-background, #ffffff)',
    borderRadius: 'var(--radius-lg, 0.5rem)',
    boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1))',
    position: 'relative',
    maxHeight: '90vh',
    overflowY: 'auto',
    ...sizeMap[size],
  };

  const headerStyle: Record<string, string> = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--color-border-light, #e5e7eb)',
  };

  const titleStyle: Record<string, string> = {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: 'var(--color-text-primary, #111827)',
    margin: '0',
    fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  };

  const descriptionStyle: Record<string, string> = {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary, #4b5563)',
    marginTop: '0.25rem',
    fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  };

  const closeBtnStyle: Record<string, string> = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-muted, #9ca3af)',
    fontSize: '1.25rem',
    padding: '0.25rem',
    lineHeight: '1',
    borderRadius: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.5rem',
    height: '1.5rem',
  };

  const bodyStyle: Record<string, string> = {
    padding: '1.5rem',
    fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modalStyle} role="dialog" aria-modal="true" aria-label={title}>
        {(title || showCloseButton) && (
          <div style={headerStyle}>
            <div>
              {title && <h2 style={titleStyle}>{title}</h2>}
              {description && <p style={descriptionStyle}>{description}</p>}
            </div>
            {showCloseButton && (
              <button style={closeBtnStyle} onClick={onClose} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div style={bodyStyle}>{children}</div>
      </div>
    </div>
  );
}
