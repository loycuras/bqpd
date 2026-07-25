"use client";

import { useMemo, useState } from "react";
import {
  etapasDisponiveis,
  descritoresDaEtapa,
  selecionarQuestoes,
  prepararSimulado,
  type QuestaoSorteada,
} from "@/lib/sorteio";
import { gerarPDF } from "@/lib/pdf";

export default function GerarPage() {
  const etapas = etapasDisponiveis();
  const [etapa, setEtapa] = useState(etapas[0]);
  const [modo, setModo] = useState<"escolhido" | "variado">("escolhido");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [qtd, setQtd] = useState(10);
  const [escola, setEscola] = useState("");
  const [turma, setTurma] = useState("");
  const [preview, setPreview] = useState<QuestaoSorteada[] | null>(null);

  const descritores = useMemo(() => descritoresDaEtapa(etapa), [etapa]);

  function alternarDescritor(cod: string) {
    setSelecionados((atual) =>
      atual.includes(cod)
        ? atual.filter((d) => d !== cod)
        : atual.length < 10
        ? [...atual, cod]
        : atual
    );
    setPreview(null);
  }

  // Regra de validação: bloqueia quando há mais descritores do que questões.
  const erro =
    modo === "escolhido" && selecionados.length === 0
      ? "Selecione ao menos um descritor."
      : modo === "escolhido" && selecionados.length > qtd
      ? `Você escolheu ${selecionados.length} descritores, mais do que o número de questões (${qtd}). Reduza os descritores ou aumente as questões.`
      : null;

  function gerar() {
    if (erro) return;
    const questoes = selecionarQuestoes(etapa, modo, selecionados, qtd);
    setPreview(prepararSimulado(questoes));
  }

  function baixar() {
    if (!preview) return;
    gerarPDF({ etapa, escola, turma, questoes: preview });
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-2xl font-bold text-slate-800">Gerar simulado</h1>
      <p className="mt-1 text-slate-500">
        Escolha a etapa, os descritores e o número de questões. O gabarito é
        embaralhado automaticamente.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* ---------- CONFIGURAÇÃO ---------- */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Etapa */}
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Etapa
          </label>
          <div className="mb-6 flex flex-wrap gap-2">
            {etapas.map((e) => (
              <button
                key={e}
                onClick={() => {
                  setEtapa(e);
                  setSelecionados([]);
                  setPreview(null);
                }}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                  etapa === e
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Modo */}
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Modo
          </label>
          <div className="mb-6 inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["escolhido", "variado"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setModo(m);
                  setPreview(null);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  modo === m
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                {m === "escolhido" ? "Escolher descritores" : "Simulado variado"}
              </button>
            ))}
          </div>

          {/* Descritores (só no modo escolhido) */}
          {modo === "escolhido" && (
            <>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Descritores ({selecionados.length}/10)
              </label>
              <div className="mb-6 space-y-2">
                {descritores.map((d) => {
                  const ativo = selecionados.includes(d.codigo);
                  return (
                    <button
                      key={d.codigo}
                      onClick={() => alternarDescritor(d.codigo)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                        ativo
                          ? "border-indigo-600 ring-2 ring-indigo-100"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-sm font-bold text-indigo-700">
                        {d.codigo}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-slate-800">
                          {d.descricao}
                        </span>
                        <span className="text-xs text-slate-400">
                          {d.total} questões
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Nº de questões */}
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nº de questões
          </label>
          <div className="mb-6 flex gap-2">
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setQtd(n);
                  setPreview(null);
                }}
                className={`rounded-lg border px-5 py-2 text-sm font-semibold ${
                  qtd === n
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Escola / Turma */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Escola
              </label>
              <input
                value={escola}
                onChange={(e) => setEscola(e.target.value)}
                placeholder="Nome da escola"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Turma
              </label>
              <input
                value={turma}
                onChange={(e) => setTurma(e.target.value)}
                placeholder="Ex.: 3º A"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {erro && (
            <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
              <div className="max-h-[420px] space-y-5 overflow-y-auto pr-2">
                {preview.map((q, i) => (
                  <div key={i} className="border-b border-slate-100 pb-4">
                    {q.texto_base && (
                      <p className="mb-2 text-xs italic text-slate-400 line-clamp-3">
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
