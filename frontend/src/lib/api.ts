import axios from "axios";

const baseURL =
  (import.meta as any)?.env?.VITE_API_URL?.toString() || "http://localhost:8000";

const api = axios.create({
  baseURL,
  timeout: 60000,
});

export async function postBlindTemplate(wms: File): Promise<Blob> {
  const form = new FormData();
  form.append("planilha_oficial", wms);

  const res = await api.post("/blind-template", form, {
    responseType: "blob",
    headers: {
      "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
  return res.data as Blob;
}

export async function postCompare(wms: File, fisico: File): Promise<Blob> {
  const form = new FormData();
  form.append("planilha_oficial", wms);
  form.append("planilha_divergente", fisico);

  const res = await api.post("/compare", form, {
    responseType: "blob",
    headers: {
      "Accept":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
  return res.data;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}