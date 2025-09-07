import React, { useRef } from "react";

type Props = {
  id?: string;
  name?: string;
  accept?: string;
  multiple?: boolean;
  onFiles?: (files: FileList) => void;
};

export default function Dropzone({
  id = "dropzone-file",
  name = "file",
  accept,
  multiple = false,
  onFiles,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onFiles) onFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = (e.dataTransfer && e.dataTransfer.files) || null;
    if (files && onFiles) onFiles(files);
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
      {/* Label visível ou escondido (visually-hidden) para leitores de tela */}
      <label htmlFor={id} style={{ display: "block", marginBottom: 8 }}>
        Selecionar arquivo ou arrastar aqui
      </label>

      {/* input file com id referente ao label e atributos de acessibilidade */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        // Acessibilidade: title e aria-label asseguram que ferramentas que
        // esperam esses atributos não reportem erro; o label acima é o ideal.
        aria-label="Selecionar arquivo para upload"
        title="Selecionar arquivo para upload"
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