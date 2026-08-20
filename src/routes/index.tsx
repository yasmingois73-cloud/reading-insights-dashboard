import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Download, FileSpreadsheet, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseArquivo, fmtData, fmtNum, fmtPct, type Dados } from "@/lib/leituras";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de Leituras | Controle de Consumos Agravantes" },
      {
        name: "description",
        content:
          "Dashboard de controle de leituras: resumo por dia, top leituristas com consumos agravantes e gráfico de retorno.",
      },
      { property: "og:title", content: "Painel de Leituras | Consumos Agravantes" },
      {
        property: "og:description",
        content:
          "Analise sua planilha de controle de leituras: KPIs, ranking de leituristas e evolução diária.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

const STORAGE_KEY = "controle_leituras_dados";

function Kpi({
  label,
  valor,
  hint,
  tone = "default",
}: {
  label: string;
  valor: string;
  hint?: string | undefined;
  tone?: "default" | "alerta" | "ok" | "info";
}) {
  const toneClass =
    tone === "alerta"
      ? "text-destructive"
      : tone === "ok"
        ? "text-chart-4"
        : tone === "info"
          ? "text-accent"
          : "text-primary";
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-2 text-3xl font-semibold tabular-nums ${toneClass}`}>{valor}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Painel() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [dia, setDia] = useState<string>("todos");
  const [selecao, setSelecao] = useState<"sim" | "nao" | "pendente" | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDados(JSON.parse(raw) as Dados);
    } catch {
      /* ignora cache inválido */
    }
  }, []);

  async function importar(file: File) {
    setCarregando(true);
    setErro(null);
    try {
      const d = await parseArquivo(file);
      if (!d.leituras.length) throw new Error("Nenhuma linha encontrada na aba 'Leituras'.");
      setDados(d);
      setDia("todos");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      } catch {
        /* planilha grande demais para o cache */
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      setCarregando(false);
    }
  }

  const dias = useMemo(() => {
    if (!dados) return [];
    return Array.from(new Set(dados.leituras.map((l) => l.data).filter(Boolean))).sort(
      (a, b) => b.localeCompare(a),
    );
  }, [dados]);

  const leituras = useMemo(() => {
    if (!dados) return [];
    return dia === "todos" ? dados.leituras : dados.leituras.filter((l) => l.data === dia);
  }, [dados, dia]);

  const agravantes = useMemo(
    () => leituras.filter((l) => l.consumo_atual > l.media_consumo && l.media_consumo > 0),
    [leituras],
  );

  const ranking = useMemo(() => {
    const map = new Map<
      string,
      { leiturista: string; supervisor: string; casos: number; variacaoMedia: number; excedente: number }
    >();
    for (const l of agravantes) {
      const cur = map.get(l.leiturista) ?? {
        leiturista: l.leiturista,
        supervisor: l.supervisor,
        casos: 0,
        variacaoMedia: 0,
        excedente: 0,
      };
      cur.casos += 1;
      cur.variacaoMedia += l.variacao;
      cur.excedente += l.consumo_atual - l.media_consumo;
      map.set(l.leiturista, cur);
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, variacaoMedia: r.variacaoMedia / r.casos }))
      .sort((a, b) => b.casos - a.casos || b.excedente - a.excedente);
  }, [agravantes]);

  const serieDiaria = useMemo(() => {
    if (!dados) return [];
    const map = new Map<string, { data: string; leituras: number; agravantes: number }>();
    for (const l of dados.leituras) {
      if (!l.data) continue;
      const cur = map.get(l.data) ?? { data: l.data, leituras: 0, agravantes: 0 };
      cur.leituras += 1;
      if (l.consumo_atual > l.media_consumo && l.media_consumo > 0) cur.agravantes += 1;
      map.set(l.data, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
  }, [dados]);

  const retornos = useMemo(() => {
    if (!dados) return { sim: 0, nao: 0, pendente: 0 };
    const base = dia === "todos" ? dados.retornos : dados.retornos.filter((r) => r.data === dia);
    let sim = 0,
      nao = 0,
      pendente = 0;
    for (const r of base) {
      const v = r.leitura_correta;
      if (v.startsWith("S")) sim += 1;
      else if (v.startsWith("N")) nao += 1;
      else pendente += 1;
    }
    return { sim, nao, pendente };
  }, [dados, dia]);

  const categoria = (v: string) =>
    v.startsWith("S") ? "sim" : v.startsWith("N") ? "nao" : "pendente";

  const detalheRetorno = useMemo(() => {
    if (!dados || !selecao) return [];
    const base = dia === "todos" ? dados.retornos : dados.retornos.filter((r) => r.data === dia);
    return base.filter((r) => categoria(r.leitura_correta) === selecao);
  }, [dados, dia, selecao]);

  const retornosFiltrados = useMemo(() => {
    if (!dados) return [];
    return dia === "todos" ? dados.retornos : dados.retornos.filter((r) => r.data === dia);
  }, [dados, dia]);

  const refaturados = retornosFiltrados.filter((r) => r.refaturado).length;

  const justificativas = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of retornosFiltrados) {
      const j = r.justificativa || "Sem retorno";
      map.set(j, (map.get(j) ?? 0) + 1);
    }
    return Array.from(map, ([texto, qtd]) => ({ texto, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [retornosFiltrados]);



  function exportarCsv() {
    const linhas = [
      ["leiturista", "supervisor", "casos_agravantes", "variacao_media_%", "excedente_kwh"],
      ...ranking.map((r) => [
        r.leiturista,
        r.supervisor,
        String(r.casos),
        (r.variacaoMedia * 100).toFixed(1),
        r.excedente.toFixed(0),
      ]),
    ];
    const csv = linhas.map((l) => l.map((c) => `"${c}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ranking_leituristas_${dia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Painel de Controle de Leituras
            </h1>
            <p className="text-sm text-muted-foreground">
              Consumos acima da média, ranking de leituristas e retorno de campo
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dados ? (
              <span className="text-xs text-muted-foreground">
                {dados.arquivo} · atualizado{" "}
                {new Date(dados.importadoEm).toLocaleString("pt-BR")}
              </span>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importar(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={carregando}>
              <RefreshCw className={carregando ? "animate-spin" : ""} />
              {dados ? "Atualizar planilha" : "Carregar planilha"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {erro ? (
          <p className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {erro}
          </p>
        ) : null}

        {!dados ? (
          <Card className="mx-auto mt-16 max-w-xl">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <FileSpreadsheet className="size-10 text-primary" />
              <div>
                <h2 className="text-lg font-medium">Carregue o controle_leituras.xlsx</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A cada atualização de hora em hora, clique em carregar novamente — o painel
                  recalcula tudo na hora e guarda a última versão no navegador.
                </p>
              </div>
              <Button onClick={() => inputRef.current?.click()}>Selecionar arquivo</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6 border-primary/30">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <span className="text-sm font-medium">Filtrar por data:</span>
                <Select value={dia} onValueChange={setDia}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os dias</SelectItem>
                    {dias.map((d) => (
                      <SelectItem key={d} value={d}>
                        {fmtData(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" onClick={exportarCsv}>
                  <Download /> Exportar ranking
                </Button>
              </CardContent>
            </Card>


            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Leituras analisadas" valor={fmtNum(leituras.length)} tone="info" />
              <Kpi
                label="Consumos agravantes"
                valor={fmtNum(agravantes.length)}
                hint={
                  leituras.length
                    ? `${((agravantes.length / leituras.length) * 100).toFixed(1)}% do total`
                    : undefined
                }
                tone="alerta"
              />
              <Kpi label="Leituristas envolvidos" valor={fmtNum(ranking.length)} />
              <Kpi
                label="Refaturados"
                valor={fmtNum(refaturados)}
                hint={`${fmtNum(retornosFiltrados.length)} retorno(s) no período`}
                tone="ok"
              />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-primary" /> Top leituristas com consumos
                    agravantes
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ranking.slice(0, 10).map((r) => ({
                        nome: r.leiturista.split(" ").slice(0, 2).join(" "),
                        casos: r.casos,
                      }))}
                      layout="vertical"
                      margin={{ left: 40, right: 16 }}
                    >
                      <CartesianGrid horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="nome"
                        width={140}
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Bar dataKey="casos" radius={[0, 4, 4, 0]} fill="var(--chart-1)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Retorno dos leituristas</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Clique em uma barra para ver os leituristas
                  </p>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { nome: "Leitura correta", qtd: retornos.sim, chave: "sim" },
                        { nome: "Erro confirmado", qtd: retornos.nao, chave: "nao" },
                        { nome: "Pendente", qtd: retornos.pendente, chave: "pendente" },
                      ]}
                      onClick={(e) => {
                        const c = e?.activePayload?.[0]?.payload?.chave as
                          | "sim"
                          | "nao"
                          | "pendente"
                          | undefined;
                        if (c) setSelecao((p) => (p === c ? null : c));
                      }}
                    >
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="nome" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Bar dataKey="qtd" radius={[4, 4, 0, 0]} className="cursor-pointer">
                        {(["sim", "nao", "pendente"] as const).map((k, i) => (
                          <Cell
                            key={k}
                            fill={["var(--chart-4)", "var(--chart-3)", "var(--chart-2)"][i]}
                            opacity={selecao && selecao !== k ? 0.35 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            {selecao ? (
              <Card className="mt-6">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">
                    {selecao === "sim"
                      ? "Leitura correta"
                      : selecao === "nao"
                        ? "Erro confirmado (refaturar)"
                        : "Pendentes"}{" "}
                    · {fmtNum(detalheRetorno.length)} registro(s)
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelecao(null)}>
                    Fechar
                  </Button>
                </CardHeader>
                <CardContent className="max-h-96 overflow-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leiturista</TableHead>
                        <TableHead>Instalação</TableHead>
                        <TableHead className="text-right">Média</TableHead>
                        <TableHead className="text-right">Atual</TableHead>
                        <TableHead className="text-right">Var.</TableHead>
                        <TableHead>Justificativa</TableHead>
                        <TableHead>Refaturado</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalheRetorno.map((r, i) => (
                        <TableRow key={`${r.instalacao}-${i}`}>
                          <TableCell>
                            <span className="font-medium">{r.leiturista}</span>
                            <span className="block text-xs text-muted-foreground">
                              Sup. {r.supervisor}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">{r.instalacao}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(r.media_consumo)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(r.consumo_atual)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={r.variacao >= 0.5 ? "destructive" : "secondary"}>
                              {fmtPct(r.variacao)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-64 text-xs">
                            {r.justificativa || "—"}
                            {r.observacao ? (
                              <span className="block text-muted-foreground">
                                Sup.: {r.observacao}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant={r.refaturado ? "destructive" : "secondary"}>
                              {r.refaturado ? "Sim" : "Não"}
                            </Badge>
                            <span className="block text-muted-foreground">{r.status}</span>
                          </TableCell>
                          <TableCell className="text-xs">{fmtData(r.data)}</TableCell>
                        </TableRow>
                      ))}
                      {!detalheRetorno.length ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            Nenhum registro nesta categoria.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Justificativas dos leituristas</CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Justificativa</TableHead>
                      <TableHead className="text-right">Casos</TableHead>
                      <TableHead className="text-right">% dos retornos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {justificativas.map((j) => (
                      <TableRow key={j.texto}>
                        <TableCell className="text-sm">{j.texto}</TableCell>
                        <TableCell className="text-right tabular-nums">{j.qtd}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {retornosFiltrados.length
                            ? fmtPct(j.qtd / retornosFiltrados.length)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!justificativas.length ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Nenhum retorno no período.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Evolução por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serieDiaria}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="data"
                      tickFormatter={fmtData}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                    />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip
                      labelFormatter={(v) => fmtData(String(v))}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="leituras"
                      name="Leituras"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="agravantes"
                      name="Agravantes"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranking de leituristas</CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leiturista</TableHead>
                        <TableHead className="text-right">Casos</TableHead>
                        <TableHead className="text-right">Variação méd.</TableHead>
                        <TableHead className="text-right">Excedente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranking.map((r) => (
                        <TableRow key={r.leiturista}>
                          <TableCell>
                            <span className="font-medium">{r.leiturista}</span>
                            <span className="block text-xs text-muted-foreground">
                              Sup. {r.supervisor}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.casos}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtPct(r.variacaoMedia)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(r.excedente)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="size-4 text-destructive" /> Maiores consumos
                    agravantes
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instalação</TableHead>
                        <TableHead>Leiturista</TableHead>
                        <TableHead className="text-right">Média</TableHead>
                        <TableHead className="text-right">Atual</TableHead>
                        <TableHead className="text-right">Var.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...agravantes]
                        .sort((a, b) => b.variacao - a.variacao)
                        .slice(0, 50)
                        .map((l, i) => (
                          <TableRow key={`${l.instalacao}-${i}`}>
                            <TableCell>
                              <span className="font-medium">{l.instalacao}</span>
                              <span className="block text-xs text-muted-foreground">
                                {fmtData(l.data)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">{l.leiturista}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtNum(l.media_consumo)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtNum(l.consumo_atual)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={l.variacao >= 0.5 ? "destructive" : "secondary"}>
                                {fmtPct(l.variacao)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
