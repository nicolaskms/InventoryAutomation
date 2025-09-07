import React, { useRef } from "react";

type Props = {
  id?: string;
  name?: string;
  label?: string; // agora aceita label
  accept?: string;
  multiple?: boolean;
  // onFile recebe um único File | null (compatível com setState se você encapsular)
  onFile?: (file: File | null) => void;
  // opcional: onFiles para compatibilidade com APIs que querem FileList
  onFiles?: (files: FileList) => void;
};

export default function Dropzone({
  id = "dropzone-file",
  name = "file",
  label = "Selecionar arquivo ou arrastar aqui",
  accept,
  multiple = false,
  onFile,
  onFiles,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // se onFiles estiver presente, chame com FileList
      if (onFiles) onFiles(files);
      // chame onFile com o primeiro arquivo
      if (onFile) onFile(files[0]);
    } else {
      // sem arquivo: sinaliza null
      if (onFile) onFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      if (onFiles) onFiles(files);
      if (onFile) onFile(files[0]);
    } else {
      if (onFile) onFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      role="presentation"
      style={{
        border: "2px dashed #ccc",
        padding: 20,
        borderRadius: 8,
        textAlign: "center",
        cursor: "pointer",
      }}
      onClick={openFileDialog}
    >
      <label htmlFor={id} style={{ display: "block", marginBottom: 8 }}>
        {label}
      </label>

      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        aria-label={label}
        title={label}
        style={{ display: "none" }}
      />

      <div>
        <strong>Arraste os arquivos aqui</strong>
        <div style={{ fontSize: 13, color: "#666" }}>
          ou clique para abrir o seletor de arquivos
        </div>
      </div>
    </div>
  );
}