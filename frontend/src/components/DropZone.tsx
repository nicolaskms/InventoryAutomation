import React, { useCallback, useRef, useState, useMemo } from "react";

type Props = {
  label: string;
  accept?: string;            // ex.: ".xlsx,.xls"
  onFile: (file: File | null) => void;
  height?: number;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function DropZone({
  label,
  accept = ".xlsx,.xls",
  onFile,
  height = 180,
}: Props) {
  const [isOver, setIsOver] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useMemo(() => `dz-${slugify(label)}`, [label]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0] || null;
      setFileName(f ? f.name : "");
      onFile(f);
    },
    [onFile]
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const openPicker = () => inputRef.current?.click();

  // Texto “Aceita: …” derivado do accept
  const acceptText = useMemo(() => {
    return accept
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }, [accept]);

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        onClick={openPicker}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPicker()}
        className={[
          // layout
          "flex items-center justify-center text-center select-none transition-colors shadow-sm",
          // aparência base (cinza claro + borda suave + cantos bem arredondados)
          "rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-100 hover:bg-zinc-200",
          // foco de teclado
          "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2",
          // estado de arrasto (leve realce)
          isOver ? "border-zinc-400 bg-zinc-200" : "",
          "cursor-pointer text-zinc-700",
        ].join(" ")}
        style={{ height }}
      >
        <div className="px-6">
          <div className="text-sm">
            Arraste e solte aqui ou{" "}
            <span className="underline underline-offset-2">clique para selecionar</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Aceita: {acceptText || ".xlsx, .xls"}
          </div>
          {fileName && (
            <div className="mt-3 text-sm font-semibold text-zinc-800 break-all">
              ✔ {fileName}
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {fileName && (
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs px-3 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50"
            onClick={() => {
              setFileName("");
              onFile(null);
            }}
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}