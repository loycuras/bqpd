// lib/pdf.ts
// Gera o PDF do simulado — layout limpo, estilo prova.
// Correções: renderização atômica de parágrafo (fim das palavras sobrepostas),
// textos com estrutura (prosa justificada; versos preservados em estrofes),
// sem itálico forçado, faixa de título, espaçamento enxuto nas colunas.
// Requer:  npm install jspdf

import { jsPDF } from "jspdf";
import type { QuestaoSorteada } from "@/lib/sorteio";

export type CampoCabecalho = { on: boolean; valor: string };
export type Cabecalho = {
  disciplina: boolean;
  escola: CampoCabecalho;
  turma: CampoCabecalho;
  aluno: CampoCabecalho;
  data: CampoCabecalho;
};
export type DadosPDF = {
  etapa: string; // só no nº de série; não é impresso
  formato: "prosa" | "colunas";
  cabecalho: Cabecalho;
  questoes: QuestaoSorteada[];
};

// Paleta da marca (provisória — casaremos com o site depois)
const AZUL: [number, number, number] = [30, 39, 102];

export function gerarNumeroSerie(etapa: string): string {
  const sigla = etapa.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 3);
  const h = new Date();
  const data =
    h.getFullYear().toString() +
    String(h.getMonth() + 1).padStart(2, "0") +
    String(h.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return `BQPD-${sigla}-${data}-${r}`;
}

export function gerarPDF(dados: DadosPDF): string {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setLineHeightFactor(1.32);
  const serie = gerarNumeroSerie(dados.etapa);
  const M = 48;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const RODAPE = 40;
  const colunas = dados.formato === "colunas" ? 2 : 1;
  const gap = 28;
  const colW = (W - M * 2 - gap * (colunas - 1)) / colunas;
  const colX = (i: number) => M + i * (colW + gap);
  const lh = (s: number) => s * 1.32;
  const nLin = (t: string, w: number) => (doc.splitTextToSize(t, w) as string[]).length;

  const marcaDagua = () => {
    doc.setTextColor(238, 239, 245);
    doc.setFont("helvetica", "bold").setFontSize(78);
    doc.text("BQPD", W / 2, H / 2, { align: "center", angle: 28, baseline: "middle" });
  };
  marcaDagua();

  // ---------- FAIXA DE TÍTULO (só na 1ª página) ----------
  let y = M - 12;
  const bandaH = 30;
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, W, 6, "F"); // fio superior
  doc.roundedRect(M, y, W - M * 2, bandaH, 5, 5, "F");
  const titulo = "Simulado" + (dados.cabecalho.disciplina ? " · Língua Portuguesa" : "");
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(255, 255, 255);
  doc.text(titulo, W / 2, y + bandaH / 2, { align: "center", baseline: "middle" });
  y += bandaH + 14;

  // ---------- IDENTIFICAÇÃO ----------
  const linhaCampo = (rot: string, c: CampoCabecalho) =>
    c.valor.trim() ? `${rot}: ${c.valor.trim()}` : `${rot}: ______________________`;
  const l1: string[] = [];
  if (dados.cabecalho.escola.on) l1.push(linhaCampo("Escola", dados.cabecalho.escola));
  if (dados.cabecalho.turma.on) l1.push(linhaCampo("Turma", dados.cabecalho.turma));
  const l2: string[] = [];
  if (dados.cabecalho.aluno.on) l2.push(linhaCampo("Aluno(a)", dados.cabecalho.aluno));
  if (dados.cabecalho.data.on)
    l2.push(`Data: ${dados.cabecalho.data.valor.trim() || "___/___/____"}`);
  const linhas = [l1, l2].filter((l) => l.length);
  if (linhas.length) {
    const boxH = linhas.length * 18 + 12;
    doc.setDrawColor(222).setLineWidth(0.5).setFillColor(250, 250, 252);
    doc.roundedRect(M, y, W - M * 2, boxH, 5, 5, "FD");
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(70);
    let ly = y + 18;
    for (const l of linhas) {
      doc.text(l[0], M + 12, ly);
      if (l[1]) doc.text(l[1], W - M - 12, ly, { align: "right" });
      ly += 18;
    }
    y += boxH + 16;
  } else y += 4;

  const topo1 = y;
  const topoN = M + 14;
  const alturaColuna = H - RODAPE - topoN;
  let col = 0;

  const novaColOuPag = () => {
    if (col < colunas - 1) {
      col++;
      y = topo1;
    } else {
      doc.addPage();
      marcaDagua();
      col = 0;
      y = topoN;
    }
  };
  const cabe = (h: number) => y + h <= H - RODAPE;

  // renderiza um bloco: prosa justificada OU verso preservado (linha a linha)
  const bloco = (
    texto: string,
    size: number,
    estilo: "normal" | "bold",
    cor: [number, number, number],
    indent = 0
  ) => {
    const w = colW - indent;
    const verso = texto.includes("\n");
    const ls = doc.splitTextToSize(texto, w) as string[];
    const need = ls.length * lh(size);
    if (!cabe(need)) novaColOuPag();
    doc.setFont("helvetica", estilo).setFontSize(size).setTextColor(...cor);
    const x = colX(col) + indent;
    if (!verso && ls.length > 1) {
      // prosa: parágrafo inteiro justificado (última linha natural)
      doc.text(texto, x, y, { maxWidth: w, align: "justify" });
    } else {
      // verso ou linha única: alinhado à esquerda, preservando quebras
      doc.text(ls, x, y);
    }
    y += need;
  };

  // ---------- QUESTÕES ----------
  const SUP = 9.5, ENUN = 10.5, ALT = 10, FT = 8;
  dados.questoes.forEach((q, i) => {
    const blocos = q.texto_base ? q.texto_base.split("\n\n") : [];

    // mantém texto + enunciado juntos (não separa o texto da sua pergunta)
    let hCabeca = 0;
    for (const b of blocos) hCabeca += nLin(b, colW - 14) * lh(SUP) + 4;
    if (q.fonte_texto_base) hCabeca += nLin(q.fonte_texto_base, colW - 14) * lh(FT) + 4;
    hCabeca += nLin(`${i + 1}) ${q.enunciado}`, colW) * lh(ENUN);
    if (hCabeca <= alturaColuna && !cabe(hCabeca)) novaColOuPag();

    // texto de apoio com barra lateral
    if (blocos.length) {
      const topo = y - SUP * 0.8;
      const colInicio = col;
      blocos.forEach((b, k) => {
        bloco(b, SUP, "normal", [60, 60, 60], 14);
        if (k < blocos.length - 1) y += 4; // respiro entre estrofes/parágrafos
      });
      // barra lateral (só se não quebrou de coluna no meio)
      if (col === colInicio) {
        doc.setDrawColor(150, 160, 200).setLineWidth(2);
        doc.line(colX(col) + 3, topo, colX(col) + 3, y - lh(SUP) + SUP * 0.35);
        doc.setLineWidth(0.5);
      }
      if (q.fonte_texto_base) {
        doc.setFont("helvetica", "normal").setFontSize(FT).setTextColor(140, 140, 140);
        const lf = doc.splitTextToSize(q.fonte_texto_base, colW - 14) as string[];
        for (const linha of lf) {
          if (!cabe(lh(FT))) novaColOuPag();
          doc.text(linha, colX(col) + colW, y, { align: "right" });
          y += lh(FT);
        }
      }
      y += 6;
    }

    bloco(`${i + 1}) ${q.enunciado}`, ENUN, "bold", [20, 20, 20]);
    y += 2;
    q.alternativas.forEach((op, k) =>
      bloco(`${"ABCDE"[k]}) ${op}`, ALT, "normal", [45, 45, 45], 16)
    );

    // separador enxuto entre questões
    y += 6;
    if (cabe(1)) {
      doc.setDrawColor(232).setLineWidth(0.5);
      doc.line(colX(col), y, colX(col) + colW, y);
    }
    y += 9;
  });

  // ---------- GABARITO ----------
  doc.addPage();
  marcaDagua();
  y = M - 12;
  doc.setFillColor(...AZUL);
  doc.roundedRect(M, y, W - M * 2, bandaH, 5, 5, "F");
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(255, 255, 255);
  doc.text("Gabarito", W / 2, y + bandaH / 2, { align: "center", baseline: "middle" });
  y += bandaH + 26;
  const cg = 5;
  const wg = (W - M * 2) / cg;
  dados.questoes.forEach((q, i) => {
    const c = i % cg, r = Math.floor(i / cg);
    const gx = M + c * wg, gy = y + r * 24;
    doc.setFont("courier", "bold").setFontSize(11).setTextColor(...AZUL);
    doc.text(`${String(i + 1).padStart(2, "0")}.`, gx, gy);
    doc.setFont("helvetica", "bold").setTextColor(30);
    doc.text(`${"ABCDE"[q.gabaritoIndex]}`, gx + 26, gy);
  });

  // ---------- RODAPÉ ----------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("courier", "normal").setFontSize(7.5).setTextColor(150);
    doc.text(serie, M, H - 22);
    doc.text("Material autoral — proibida a redistribuição.", W / 2, H - 22, { align: "center" });
    doc.text(`Pág. ${p}/${total}`, W - M, H - 22, { align: "right" });
  }

  doc.save(`simulado-${serie}.pdf`);
  return serie;
}
