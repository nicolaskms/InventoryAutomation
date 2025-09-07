import axios from "axios";

const baseURL =
  (import.meta as any)?.env?.VITE_API_URL?.toString() || "http://localhost:8000";

const api = axios.create({
  baseURL,
  timeout: 60000,
});

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

export async function postBlindTemplate(file: File): Promise<Blob> {
  const form = new FormData();
  // O backend que a branch frontend usa expõe /blind-template e espera 'planilha_oficial'
  form.append("planilha_oficial", file);

  const res = await api.post("/blind-template", form, {
    responseType: "blob",
    headers: {
      "Accept":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
  return res.data;
}

export async function postBlank(wms: File): Promise<Blob> {
  // Mantive também um helper para /blank caso você prefira usar esse endpoint.
  const form = new FormData();
  form.append("wms", wms);
  const res = await api.post("/blank", form, {
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