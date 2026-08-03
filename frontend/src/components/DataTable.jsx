import { refRangeRowClass } from '../utils/validators';

/**
 * Cell class for known column keys.
 * @param {string} key
 * @returns {string|undefined}
 */
function cellClass(key) {
  if (key === 'note') return 'cell-note';
  if (key === 'name') return 'cell-name';
  return undefined;
}

/**
 * Reusable data table with row numbers and optional delete action.
 * @param {object} props
 */
export default function DataTable({ columns, rows, onDelete, deleteTitle = 'Удалить' }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>№</th>
            {columns.map((column) => (
              <th key={column.key} className={cellClass(column.key)}>
                {column.title}
              </th>
            ))}
            {onDelete ? <th aria-label="Действия" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index} className={refRangeRowClass(row)}>
              <td>{index + 1}</td>
              {columns.map((column) => (
                <td key={column.key} className={cellClass(column.key)}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
              {onDelete ? (
                <td className="actions-cell">
                  <button
                    type="button"
                    className="icon-delete"
                    title={deleteTitle}
                    onClick={() => onDelete(row)}
                    aria-label={deleteTitle}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path className="delete-x" d="M7 7l10 10M17 7L7 17" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
