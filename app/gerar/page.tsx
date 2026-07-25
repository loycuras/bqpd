// app/gerar/page.tsx
"use client";

import { useMemo, useState } from "react";
import {
  etapasDisponiveis,
  niveisDaEtapa,
  descritoresDaEtapa,
  selecionarQuestoes,
  prepararSimulado,
  type QuestaoSorteada,
} from "@/lib/sorteio";
import { gerarPDF, type Cabecalho } from "@/lib/pdf";

const rotulo =
  "mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const chipBase = "rounded-lg border px-4 py-2 text-sm font-semibold";
const chipOn = "border-indigo-600 bg-indigo-50 text-indigo-700";
const chipOff = "border-slate-200 text-slate-700 hover:border-slate-300";
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";

export default function GerarPage() {
  const etapas = etapasDisponiveis();
  const [etapa, setEtapa] = useState(etapas[0]);
  const [niveis, setNiveis] = useState<string[]>([]); // vazio = todos
  const [modo, setModo] = useState<"escolhido" | "variado">("escolhido");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [qtd, setQtd] = useState(10);
  const [formato, setFormato] = useState<"prosa" | "colunas">("colunas");
  const [preview, setPreview] = useState<QuestaoSorteada[] | null>(null);

  const [cab, setCab] = useState<Cabecalho>({
    disciplina: true,
    escola: { on: true, valor: "" },
    turma: { on: true, valor: "" },
    aluno: { on: true, valor: "" },
    data: { on: true, valor: "" },
  });

  const niveisEtapa = useMemo(() => niveisDaEtapa(etapa), [etapa]);
  const descritores = useMemo(() => descritoresDaEtapa(etapa), [etapa]);

  function alternar<T>(lista: T[], item: T): T[] {
    return lista.includes(item)
      ? lista.filter((x) => x !== item)
      : [...lista, item];
  }

  const erro =
    modo === "escolhido" && selecionados.length === 0
      ? "Selecione ao menos um descritor."
      : modo === "escolhido" && selecionados.length > qtd
      ? `Você escolheu ${selecionados.length} descritores, mais do que o número de questões (${qtd}). Reduza os descritores ou aumente as questões.`
      : null;

  function gerar() {
    if (erro) return;
    const q = selecionarQuestoes(etapa, modo, selecionados, niveis, qtd);
    setPreview(prepararSimulado(q));
  }

  function baixar() {
    if (!preview) return;
    gerarPDF({ etapa, formato, cabecalho: cab, questoes: preview });
  }

  // helper para um item do cabeçalho com campo de texto
  function CampoCab({
    chave,
    nome,
    placeholder,
  }: {
    chave: "escola" | "turma" | "aluno" | "data";
    nome: string;
    placeholder: string;
  }) {
    const c = cab[chave];
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            setCab({ ...cab, [chave]: { ...c, on: !c.on } })
          }
          className={`grid h-5 w-5 place-items-center rounded border ${
            c.on
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-slate-300"
          }`}
        >
          {c.on ? "✓" : ""}
        </button>
        <span className="w-20 text-sm text-slate-700">{nome}</span>
        <input
          value={c.valor}
          disabled={!c.on}
          onChange={(e) =>
            setCab({ ...cab, [chave]: { ...c, valor: e.target.value } })
          }
          placeholder={placeholder}
          className={`${inputCls} flex-1 disabled:bg-slate-50 disabled:text-slate-400`}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 text-slate-900">
      <h1 className="text-2xl font-bold">Gerar simulado</h1>
      <p className="mt-1 text-slate-500">
        Língua Portuguesa · escolha a etapa, os descritores e o formato. O
        gabarito é embaralhado automaticamente.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* ---------- CONFIGURAÇÃO ---------- */}
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Etapa */}
          <div>
            <label className={rotulo}>Etapa</label>
            <div className="flex flex-wrap gap-2">
              {etapas.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setEtapa(e);
                    setSelecionados([]);
                    setNiveis([]);
                    setPreview(null);
                  }}
                  className={`${chipBase} ${etapa === e ? chipOn : chipOff}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Nível */}
          <div>
            <label className={rotulo}>
              Nível <span className="normal-case text-slate-400">(vazio = todos)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {niveisEtapa.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setNiveis(alternar(niveis, n));
                    setPreview(null);
                  }}
                  className={`${chipBase} ${
                    niveis.includes(n) ? chipOn : chipOff
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Modo */}
          <div>
            <label className={rotulo}>Como montar</label>
            <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  ["escolhido", "Escolher descritores"],
                  ["variado", "Simulado aleatório"],
                ] as const
              ).map(([m, texto]) => (
                <button
                  key={m}
                  onClick={() => {
                    setModo(m);
                    setPreview(null);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    modo === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>

          {/* Descritores (sem contagem) */}
          {modo === "escolhido" && (
            <div>
              <label className={rotulo}>
                Descritores ({selecionados.length}/10)
              </label>
              <div className="space-y-2">
                {descritores.map((d) => {
                  const ativo = selecionados.includes(d.codigo);
                  return (
                    <button
                      key={d.codigo}
                      onClick={() => {
                        if (!ativo && selecionados.length >= 10) return;
                        setSelecionados(alternar(selecionados, d.codigo));
                        setPreview(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                        ativo
                          ? "border-indigo-600 ring-2 ring-indigo-100"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-sm font-bold text-indigo-700">
                        {d.codigo}
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {d.descricao}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nº de questões + Formato */}
          <div className="flex flex-wrap gap-x-10 gap-y-6">
            <div>
              <label className={rotulo}>Nº de questões</label>
              <div className="flex gap-2">
                {[3, 5, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setQtd(n);
                      setPreview(null);
                    }}
                    className={`${chipBase} ${qtd === n ? chipOn : chipOff}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={rotulo}>Formato de impressão</label>
              <div className="flex gap-2">
                {(
                  [
                    ["colunas", "2 colunas"],
                    ["prosa", "Prosa"],
                  ] as const
                ).map(([f, texto]) => (
                  <button
                    key={f}
                    onClick={() => setFormato(f)}
                    className={`${chipBase} ${formato === f ? chipOn : chipOff}`}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cabeçalho configurável */}
          <div>
            <label className={rotulo}>Cabeçalho do PDF</label>
            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setCab({ ...cab, disciplina: !cab.disciplina })
                  }
                  className={`grid h-5 w-5 place-items-center rounded border ${
                    cab.disciplina
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300"
                  }`}
                >
                  {cab.disciplina ? "✓" : ""}
                </button>
                <span className="w-20 text-sm text-slate-700">Disciplina</span>
                <span className="text-sm text-slate-400">Língua Portuguesa</span>
              </div>
              <CampoCab chave="escola" nome="Escola" placeholder="Nome da escola (ou deixe em branco)" />
              <CampoCab chave="turma" nome="Turma" placeholder="Ex.: 3º A (ou deixe em branco)" />
              <CampoCab chave="aluno" nome="Aluno" placeholder="Deixe em branco para o aluno preencher" />
              <CampoCab chave="data" nome="Data" placeholder="Deixe em branco para linha ___/___/____" />
            </div>
          </div>

          {erro && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {erro}
            </p>
          )}

          <button
            onClick={gerar}
            disabled={!!erro}
            className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Gerar simulado
          </button>
        </section>

        {/* ---------- PRÉVIA ---------- */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Prévia</h2>
            {preview && (
              <span className="text-xs text-slate-400">
                {preview.length} questões
              </span>
            )}
          </div>

          {!preview ? (
            <div className="py-16 text-center text-slate-400">
              Configure ao lado e clique em “Gerar simulado”.
            </div>
          ) : (
            <>
              <div className="max-h-[460px] space-y-5 overflow-y-auto pr-2">
                {preview.map((q, i) => (
                  <div key={i} className="border-b border-slate-100 pb-4">
                    {q.texto_base && (
                      <p className="mb-2 text-xs italic text-slate-400 line-clamp-4">
                        {q.texto_base}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-slate-800">
                      <span className="font-mono text-indigo-600">
                        {String(i + 1).padStart(2, "0")}
                      </span>{" "}
                      {q.enunciado}
                    </p>
                    <ul className="mt-2 space-y-1 pl-4">
                      {q.alternativas.map((op, k) => (
                        <li key={k} className="text-sm text-slate-600">
                          <span className="font-mono font-bold text-slate-400">
                            {"ABCDE"[k]})
                          </span>{" "}
                          {op}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={baixar}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700"
                >
                  Baixar PDF
                </button>
                <button
                  onClick={gerar}
                  className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:border-slate-300"
                >
                  Novo sorteio
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
