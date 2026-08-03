import { useEffect } from 'react';

/**
 * Modal dialog with dimmed backdrop.
 * @param {{title: string, onClose: Function, children: import('react').ReactNode}} props
 */
export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    /**
     * Close modal on Escape.
     * @param {KeyboardEvent} event
     */
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
