interface Props {
  placeholder?: string;
  onChange: (value: string) => void;
}

export default function Searchbar({ placeholder, onChange }: Props) {
  return (
    <input
      type="text"
      placeholder={placeholder || "Search..."}
      className="border rounded px-3 py-2 w-full"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}