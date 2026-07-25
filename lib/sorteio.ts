// lib/sorteio.ts
// Motor de seleção e embaralhamento das questões.
// Lê o banco (questoes.json), filtra por etapa/nível/descritores e monta o
// simulado distribuindo o gabarito de forma equilibrada.

import banco from "@/data/questoes.json";

export type Questao = {
  id: string;
  etapa: string;
  nivel: string;
  descritor: string;
  descritor_desc: string;
  enunciado: string;
  texto_base: string | null;
  fonte_texto_base: string | null;
  alternativas: string[];
  gabarito_index: number;
  gabarito_letra: string | null;
  tem_ancora: boolean;
};

export type QuestaoSorteada = {
  descritor: string;
  descritor_desc: string;
  texto_base: string | null;
  enunciado: string;
  alternativas: string[]; // já embaralhadas
  gabaritoIndex: number; // posição correta após o embaralhamento
};

export const QUESTOES = banco as Questao[];

// Ordem pedagógica dos níveis (do mais básico ao mais avançado).
const ORDEM_NIVEL = ["Elementar I", "Elementar II", "Básico", "Desejável"];

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function etapasDisponiveis(): string[] {
  return [...new Set(QUESTOES.map((q) => q.etapa))];
}

// Níveis que existem para a etapa (nem todo descritor tem todos os níveis).
export function niveisDaEtapa(etapa: string): string[] {
  const presentes = new Set(
    QUESTOES.filter((q) => q.etapa === etapa).map((q) => q.nivel)
  );
  return ORDEM_NIVEL.filter((n) => presentes.has(n));
}

// Descritores da etapa (sem expor a quantidade de questões do banco).
export function descritoresDaEtapa(
  etapa: string
): { codigo: string; descricao: string }[] {
  const mapa = new Map<string, string>();
  for (const q of QUESTOES) {
    if (q.etapa === etapa) mapa.set(q.descritor, q.descritor_desc);
  }
  return [...mapa.entries()]
    .map(([codigo, descricao]) => ({ codigo, descricao }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

// Seleciona as questões conforme etapa, nível e modo.
// niveis vazio = todos os níveis. Aplica-se aos dois modos.
export function selecionarQuestoes(
  etapa: string,
  modo: "variado" | "escolhido",
  descritores: string[],
  niveis: string[],
  qtd: number
): Questao[] {
  let base = QUESTOES.filter((q) => q.etapa === etapa);
  if (niveis.length > 0) base = base.filter((q) => niveis.includes(q.nivel));

  if (modo === "variado") {
    return embaralhar(base).slice(0, qtd);
  }

  // modo "escolhido": rodízio entre os descritores escolhidos.
  const grupos = descritores.map((d) =>
    embaralhar(base.filter((q) => q.descritor === d))
  );
  const escolhidas: Questao[] = [];
  let i = 0;
  while (escolhidas.length < qtd) {
    const grupo = grupos[i % grupos.length];
    const q = grupo.shift();
    if (q) escolhidas.push(q);
    i++;
    if (grupos.every((g) => g.length === 0)) break;
  }
  return escolhidas;
}

// Gera posições-alvo (0..4) equilibradas para o gabarito.
function alvosEquilibrados(n: number): number[] {
  const alvos: number[] = [];
  while (alvos.length < n) alvos.push(...embaralhar([0, 1, 2, 3, 4]));
  return embaralhar(alvos.slice(0, n));
}

// Embaralha as alternativas colocando a correta na posição-alvo.
export function prepararSimulado(questoes: Questao[]): QuestaoSorteada[] {
  const alvos = alvosEquilibrados(questoes.length);
  return questoes.map((q, i) => {
    const correta = q.alternativas[q.gabarito_index];
    const outras = embaralhar(
      q.alternativas.filter((_, j) => j !== q.gabarito_index)
    );
    const alvo = Math.min(alvos[i], q.alternativas.length - 1);
    const novas = [...outras.slice(0, alvo), correta, ...outras.slice(alvo)];
    return {
      descritor: q.descritor,
      descritor_desc: q.descritor_desc,
      texto_base: q.texto_base,
      enunciado: q.enunciado,
      alternativas: novas,
      gabaritoIndex: novas.indexOf(correta),
    };
  });
}
