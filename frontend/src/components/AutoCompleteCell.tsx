import React, { useState, useRef, useEffect } from "react";

interface AutoCompleteCellProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  minChars?: number;
  maxSuggestions?: number;
  placeholder?: string;
}

export default function AutoCompleteCell({
  value,
  onChange,
  suggestions,
  minChars = 1,
  maxSuggestions = 15,
  placeholder
}: AutoCompleteCellProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(value || "");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFilter(value || "");
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered =
    filter.length >= minChars
      ? suggestions
          .filter(s => s.toLowerCase().includes(filter.toLowerCase()))
          .slice(0, maxSuggestions)
      : [];

  function handleSelect(s: string) {
    onChange(s);
    setFilter(s);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        className="w-full px-2 py-1 border rounded text-sm"
        value={filter}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
            setFilter(v);
            onChange(v);
            if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 bg-white border rounded mt-1 max-h-56 overflow-auto shadow text-sm w-full">
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              className="px-2 py-1 hover:bg-blue-100 cursor-pointer"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}