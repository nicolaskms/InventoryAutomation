import React, { useCallback, useMemo, useRef, useState } from "react";

type Props = {
  label: string;
  accept?: string;              // ex.: ".xlsx,.xls"
  file?: File | null;           // <<< controlado pelo pai
  onFile: (file: File | null) => void;
  height?: number;
  className?: string;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function DropZone({
  label,
  accept = ".xlsx,.xls",
  file,
  onFile,
  height = 180,
  className = "",
}: Props) {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useMemo(() => `dz-${slugify(label)}`, [label]);

  const commitFile = useCallback(
    (f: File | null) => {
      onFile(f);
    },
    [onFile]
  );

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    commitFile(files && files[0] ? files[0] : null);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    const items = e.dataTransfer?.items;
    if (items && items.length) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) {
            commitFile(f);
            return;
          }
        }
      }
    }
    const files = e.dataTransfer?.files;
    commitFile(files && files[0] ? files[0] : null);
  };

  const openPicker = () => inputRef.current?.click();

  const acceptText = useMemo(
    () =>
      accept
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", "),
    [accept]
  );

  const hasFile = Boolean(file);

  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsOver(false); }}
        onDrop={onDrop}
        onClick={openPicker}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPicker()}
        className={[
          "flex items-center justify-center text-center select-none transition-colors shadow-sm",
          "rounded-2xl border-2 border-dashed",
          hasFile
            ? "border-emerald-500 bg-emerald-50"
            : isOver
              ? "border-zinc-400 bg-zinc-200"
              : "border-zinc-300 bg-zinc-100 hover:bg-zinc-200",
          "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2",
          "cursor-pointer text-zinc-700",
        ].join(" ")}
        style={{ height }}
      >
        <div className="px-6">
          <div className="text-sm">
            Arraste e solte aqui ou{" "}
            <span className="underline underline-offset-2">clique para selecionar</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">Aceita: {acceptText || ".xlsx, .xls"}</div>
          {hasFile && (
            <div className="mt-3 text-sm font-semibold text-zinc-800 break-all">
              ✔ {file!.name}
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        name={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInput}
      />

      {hasFile && (
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs px-3 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50"
            onClick={() => commitFile(null)}
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}