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
 * Reusable data table with row numbers and optional edit/delete actions.
 * @param {object} props
 */
export default function DataTable({
  columns,
  rows,
  onDelete,
  onEdit,
  deleteTitle = 'Удалить',
  editTitle = 'Редактировать',
}) {
  const hasActions = Boolean(onDelete || onEdit);

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
            {hasActions ? <th aria-label="Действия" /> : null}
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
              {hasActions ? (
                <td className="actions-cell">
                  <div className="actions-inner">
                    {onEdit ? (
                      <button
                        type="button"
                        className="icon-edit"
                        title={editTitle}
                        onClick={() => onEdit(row)}
                        aria-label={editTitle}
                      >
                        <img src={`${import.meta.env.BASE_URL}icons/settings.svg`} alt="" />
                      </button>
                    ) : null}
                    {onDelete ? (
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
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
