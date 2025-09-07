interface Props {
  data: any[];
  columns: { key: string; label: string }[];
}

export default function Table({ data, columns }: Props) {
  return (
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-200">
          {columns.map((col) => (
            <th key={col.key} className="border px-4 py-2 text-left">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length > 0 ? (
          data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-100">
              {columns.map((col) => (
                <td key={col.key} className="border px-4 py-2">
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="text-center py-4">
              Nenhum dado encontrado
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}