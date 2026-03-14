import { useState } from "react";

type ColType = "int" | "varchar" | "text" | "boolean" | "date" | "datetime" | "float" | "decimal";
const COL_TYPES: ColType[] = ["int", "varchar", "text", "boolean", "date", "datetime", "float", "decimal"];

interface Column {
  id: string;
  name: string;
  type: ColType;
  isPK: boolean;
  isFK: boolean;
  references: string;
}

interface Table {
  id: string;
  name: string;
  columns: Column[];
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function schemaToMermaid(tables: Table[]): string {
  const valid = tables.filter((t) => t.name.trim());
  if (valid.length === 0) return "";

  const lines = ["erDiagram"];
  for (const table of valid) {
    lines.push(`    ${table.name} {`);
    for (const col of table.columns) {
      if (!col.name.trim()) continue;
      const flag = col.isPK ? " PK" : col.isFK ? " FK" : "";
      lines.push(`        ${col.type} ${col.name}${flag}`);
    }
    lines.push("    }");
  }

  const tableNames = new Set(valid.map((t) => t.name));
  for (const table of valid) {
    for (const col of table.columns) {
      if (col.isFK && col.references && tableNames.has(col.references)) {
        lines.push(`    ${col.references} ||--o{ ${table.name} : ""`);
      }
    }
  }

  return lines.join("\n");
}

interface Props {
  onMermaidChange: (code: string) => void;
}

export default function SchemaPanel({ onMermaidChange }: Props) {
  const [tables, setTables] = useState<Table[]>([]);

  const commit = (next: Table[]) => {
    setTables(next);
    onMermaidChange(schemaToMermaid(next));
  };

  const addTable = () =>
    commit([...tables, { id: uid(), name: "", columns: [] }]);

  const removeTable = (id: string) =>
    commit(tables.filter((t) => t.id !== id));

  const setTableName = (id: string, name: string) =>
    commit(tables.map((t) => (t.id === id ? { ...t, name } : t)));

  const addColumn = (tableId: string) =>
    commit(
      tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              columns: [
                ...t.columns,
                { id: uid(), name: "", type: "varchar", isPK: false, isFK: false, references: "" },
              ],
            }
          : t
      )
    );

  const removeColumn = (tableId: string, colId: string) =>
    commit(
      tables.map((t) =>
        t.id === tableId ? { ...t, columns: t.columns.filter((c) => c.id !== colId) } : t
      )
    );

  const patchColumn = (tableId: string, colId: string, patch: Partial<Column>) =>
    commit(
      tables.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : t
      )
    );

  const otherTableNames = (currentId: string) =>
    tables.filter((t) => t.id !== currentId && t.name.trim()).map((t) => t.name);

  return (
    <div className="schema-panel">
      <div className="schema-toolbar">
        <button className="add-table-btn" onClick={addTable}>
          + Add Table
        </button>
      </div>

      {tables.length === 0 && (
        <div className="placeholder" style={{ marginTop: 40 }}>
          Click "+ Add Table" to start designing your schema
        </div>
      )}

      {tables.map((table) => (
        <div key={table.id} className="schema-table">
          <div className="schema-table-header">
            <input
              className="table-name-input"
              placeholder="TableName"
              value={table.name}
              onChange={(e) => setTableName(table.id, e.target.value)}
            />
            <button className="remove-btn" onClick={() => removeTable(table.id)} title="Remove table">
              ×
            </button>
          </div>

          <div className="schema-columns">
            {table.columns.map((col) => (
              <div key={col.id} className="schema-column">
                <input
                  className="col-name"
                  placeholder="column_name"
                  value={col.name}
                  onChange={(e) => patchColumn(table.id, col.id, { name: e.target.value })}
                />
                <select
                  className="col-type"
                  value={col.type}
                  onChange={(e) => patchColumn(table.id, col.id, { type: e.target.value as ColType })}
                >
                  {COL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="col-flag" title="Primary Key">
                  <input
                    type="checkbox"
                    checked={col.isPK}
                    onChange={(e) =>
                      patchColumn(table.id, col.id, {
                        isPK: e.target.checked,
                        isFK: e.target.checked ? false : col.isFK,
                      })
                    }
                  />
                  PK
                </label>
                <label className="col-flag" title="Foreign Key">
                  <input
                    type="checkbox"
                    checked={col.isFK}
                    onChange={(e) =>
                      patchColumn(table.id, col.id, {
                        isFK: e.target.checked,
                        isPK: e.target.checked ? false : col.isPK,
                      })
                    }
                  />
                  FK
                </label>
                {col.isFK && (
                  <select
                    className="col-ref"
                    value={col.references}
                    onChange={(e) => patchColumn(table.id, col.id, { references: e.target.value })}
                  >
                    <option value="">→ table</option>
                    {otherTableNames(table.id).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="remove-btn"
                  onClick={() => removeColumn(table.id, col.id)}
                  title="Remove column"
                >
                  ×
                </button>
              </div>
            ))}
            <button className="add-col-btn" onClick={() => addColumn(table.id)}>
              + column
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
