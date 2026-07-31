import { useEffect, useRef, useState } from 'react';

/**
 * Select with a scrollable options list (mobile-friendly max-height).
 * @param {{
 *   options: string[],
 *   value: string,
 *   onChange: (value: string) => void,
 *   emptyLabel?: string,
 * }} props
 */
export default function ScrollableSelect({ options, value, onChange, emptyLabel = '-----' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    /**
     * Close list on outside pointer / Escape.
     * @param {PointerEvent|KeyboardEvent} event
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

  /**
   * Pick an option and close the list.
   * @param {string} next
   */
  function pick(next) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="scroll-select" ref={rootRef}>
      <button
        type="button"
        className="scroll-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {value || emptyLabel}
      </button>
      {open ? (
        <ul className="scroll-select__list" role="listbox">
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
