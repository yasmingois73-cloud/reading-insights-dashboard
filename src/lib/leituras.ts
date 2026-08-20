import * as XLSX from "xlsx";

export type Leitura = {
  instalacao: string;
  medidor: string;
  leiturista: string;
  supervisor: string;
  media_consumo: number;
  consumo_atual: number;
  leitura: number;
  variacao: number;
  status: string;
  endereco: string;
  data: string; // yyyy-mm-dd
};

export type Retorno = {
  instalacao: string;
  leiturista: string;
  supervisor: string;
  leitura_correta: string;
  justificativa: string;
  status: string;
  observacao: string;
  media_consumo: number;
  consumo_atual: number;
  variacao: number;
  leitura_informada: string;
  refaturado: boolean;
  data: string;
};

export type Dados = {
  leituras: Leitura[];
  retornos: Retorno[];
  arquivo: string;
  importadoEm: string;
};

const num = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const txt = (v: unknown) => (v == null ? "" : String(v).trim());

function toISO(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : "";
}

export async function parseArquivo(file: File): Promise<Dados> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });

  const sheet = (name: string) => {
    const key = wb.SheetNames.find(
      (n) => n.toLowerCase().replace(/\s+/g, "") === name.toLowerCase().replace(/\s+/g, ""),
    );
    const ws = key ? wb.Sheets[key] : undefined;
    return ws ? XLSX.utils.sheet_to_json<Record<string, unknown>>(ws) : [];
  };

  const leituras: Leitura[] = sheet("Leituras")
    .map((r) => ({
      instalacao: txt(r["instalacao"]),
      medidor: txt(r["medidor"]),
      leiturista: txt(r["leiturista"]) || "SEM LEITURISTA",
      supervisor: txt(r["supervisor"]) || "SEM SUPERVISOR",
      media_consumo: num(r["media_consumo"]),
      consumo_atual: num(r["consumo_atual"]),
      leitura: num(r["leitura"]),
      variacao: num(r["variacao_%"]),
      status: txt(r["status"]) || "SEM STATUS",
      endereco: txt(r["endereco"]),
      data: toISO(r["data"]),
    }))
    .filter((l) => l.instalacao || l.leiturista !== "SEM LEITURISTA");

  const retornos: Retorno[] = sheet("Retorno Leiturista")
    .map((r) => ({
      instalacao: txt(r["instalacao"]),
      leiturista: txt(r["leiturista"]),
      supervisor: txt(r["supervisor"]),
      leitura_correta: txt(r["leitura_correta?"]).toUpperCase(),
      justificativa: txt(r["justificativa_leiturista"]),
      status: txt(r["status"]),
      data: toISO(r["data"]),
    }))
    .filter((r) => r.instalacao);

  return {
    leituras,
    retornos,
    arquivo: file.name,
    importadoEm: new Date().toISOString(),
  };
}

export const fmtData = (iso: string) =>
  iso ? iso.split("-").reverse().join("/") : "sem data";

export const fmtPct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export const fmtNum = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
