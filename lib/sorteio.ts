// lib/sorteio.ts
// Motor de seleção e embaralhamento das questões.
// Lê o banco (questoes.json) e monta o simulado, distribuindo o gabarito
// de forma equilibrada para nunca cair sempre na mesma letra.

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
  gabaritoIndex: number; // posição correta APÓS o embaralhamento
};

export const QUESTOES = banco as Questao[];

// Embaralhamento Fisher-Yates (imparcial).
function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Etapas que realmente têm questões (etapa vazia não aparece pro professor).
export function etapasDisponiveis(): string[] {
  return [...new Set(QUESTOES.map((q) => q.etapa))];
}

// Descritores de uma etapa, com a quantidade de questões de cada um.
export function descritoresDaEtapa(
  etapa: string
): { codigo: string; descricao: string; total: number }[] {
  const mapa = new Map<string, { descricao: string; total: number }>();
  for (const q of QUESTOES) {
    if (q.etapa !== etapa) continue;
    const atual = mapa.get(q.descritor);
    if (atual) atual.total++;
    else mapa.set(q.descritor, { descricao: q.descritor_desc, total: 1 });
  }
  return [...mapa.entries()]
    .map(([codigo, v]) => ({ codigo, descricao: v.descricao, total: v.total }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

// Seleciona as questões conforme o modo.
// - "variado": sorteia de qualquer descritor da etapa.
// - "escolhido": distribui entre os descritores escolhidos (um de cada, girando).
export function selecionarQuestoes(
  etapa: string,
  modo: "variado" | "escolhido",
  descritores: string[],
  qtd: number
): Questao[] {
  const daEtapa = QUESTOES.filter((q) => q.etapa === etapa);

  if (modo === "variado") {
    return embaralhar(daEtapa).slice(0, qtd);
  }

  // modo "escolhido": agrupa por descritor e vai pegando um de cada, em rodízio.
  const grupos = descritores.map((d) =>
    embaralhar(daEtapa.filter((q) => q.descritor === d))
  );
  const escolhidas: Questao[] = [];
  let i = 0;
  while (escolhidas.length < qtd) {
    const grupo = grupos[i % grupos.length];
    const q = grupo.shift();
    if (q) escolhidas.push(q);
    i++;
    // se todos os grupos esvaziaram antes de atingir qtd, para.
    if (grupos.every((g) => g.length === 0) && escolhidas.length < qtd) break;
  }
  return escolhidas;
}

// Gera uma sequência de posições-alvo (0..4) equilibrada para o gabarito.
function alvosEquilibrados(n: number): number[] {
  const alvos: number[] = [];
  while (alvos.length < n) alvos.push(...embaralhar([0, 1, 2, 3, 4]));
  return embaralhar(alvos.slice(0, n));
}

// Embaralha as alternativas de cada questão colocando a correta na posição-alvo.
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
