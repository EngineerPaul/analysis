import { useEffect, useRef, useState } from 'react';

const MOBILE_MQ = '(max-width: 768px)';

/**
 * Select with a scrollable options list.
 * Desktop: list overlays as a fixed panel. Mobile: list stays in document flow.
 * @param {{
 *   options: string[],
 *   value: string,
 *   onChange: (value: string) => void,
 *   emptyLabel?: string,
 * }} props
 */
export default function ScrollableSelect({ options, value, onChange, emptyLabel = '-----' }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    /**
     * Close list on outside pointer / Escape.
     * @param {PointerEvent} event
     */
    function handlePointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }

    /**
     * Place overlay menu under the trigger on desktop.
     */
    function placeMenu() {
      if (window.matchMedia(MOBILE_MQ).matches) {
        setMenuStyle(null);
        return;
      }
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const maxHeight = Math.min(280, window.innerHeight * 0.5);
      const gap = 4;
      let top = rect.bottom + gap;
      if (top + maxHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - gap - maxHeight);
      }
      setMenuStyle({
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${top}px`,
        width: `${rect.width}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 100,
      });
    }

    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open, options.length]);

  /**
   * Pick an option and close the list.
   * @param {string} next
   */
  function pick(next) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className={`scroll-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="scroll-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {value || emptyLabel}
      </button>
      {open ? (
        <ul
          className="scroll-select__list"
          role="listbox"
          style={menuStyle || undefined}
        >
          <li role="option" aria-selected={value === ''}>
            <button type="button" onClick={() => pick('')}>{emptyLabel}</button>
          </li>
          {options.map((item) => (
            <li key={item} role="option" aria-selected={item === value}>
              <button
                type="button"
                className={item === value ? 'is-selected' : undefined}
                onClick={() => pick(item)}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
