// lib/pdf.ts
// Gera o PDF do simulado no navegador — layout limpo, estilo "prova de escola".
// Marca d'água: UMA faixa diagonal discreta por página.
// Texto de apoio: barra fininha à esquerda + fonte pequena recuada à direita.
// Texto justificado. Layout em 1 ou 2 colunas.
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
  etapa: string; // usado só no nº de série; NÃO é impresso
  formato: "prosa" | "colunas";
  cabecalho: Cabecalho;
  questoes: QuestaoSorteada[];
};

export function gerarNumeroSerie(etapa: string): string {
  const sigla = etapa.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 3);
  const h = new Date();
  const data =
    h.getFullYear().toString() +
    String(h.getMonth() + 1).padStart(2, "0") +
    String(h.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rnd = "";
  for (let i = 0; i < 6; i++) rnd += chars[Math.floor(Math.random() * chars.length)];
  return `BQPD-${sigla}-${data}-${rnd}`;
}

export function gerarPDF(dados: DadosPDF): string {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setLineHeightFactor(1.35);
  const serie = gerarNumeroSerie(dados.etapa);
  const M = 48;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const RODAPE = 40;
  const colunas = dados.formato === "colunas" ? 2 : 1;
  const gap = 28;
  const colW = (W - M * 2 - gap * (colunas - 1)) / colunas;
  const colX = (i: number) => M + i * (colW + gap);
  const lh = (s: number) => s * 1.35;
  const nLin = (t: string, w: number) => (doc.splitTextToSize(t, w) as string[]).length;

  // UMA faixa diagonal discreta no centro da página.
  const marcaDagua = () => {
    doc.saveGraphicsState();
    doc.setTextColor(238, 239, 245);
    doc.setFont("helvetica", "bold").setFontSize(80);
    doc.text("BQPD", W / 2, H / 2, { align: "center", angle: 28, baseline: "middle" });
    doc.restoreGraphicsState();
  };
  marcaDagua();

  // ---------- CABEÇALHO (só na 1ª página) ----------
  let y = M;
  const titulo = "Simulado" + (dados.cabecalho.disciplina ? " — Língua Portuguesa" : "");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(30, 39, 102);
  doc.text(titulo, M, y + 4);
  y += 12;
  doc.setDrawColor(30, 39, 102).setLineWidth(1.4).line(M, y, W - M, y);
  y += 16;

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
    const boxH = linhas.length * 19 + 12;
    doc.setDrawColor(220).setLineWidth(0.5).setFillColor(249, 250, 252);
    doc.roundedRect(M, y, W - M * 2, boxH, 5, 5, "FD");
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(70);
    let ly = y + 19;
    for (const l of linhas) {
      doc.text(l[0], M + 12, ly);
      if (l[1]) doc.text(l[1], W - M - 12, ly, { align: "right" });
      ly += 19;
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

  // parágrafo justificado (última linha não estica)
  const par = (
    texto: string,
    size: number,
    estilo: "normal" | "bold" | "italic",
    cor: [number, number, number],
    indent = 0
  ) => {
    const w = colW - indent;
    const ls = doc.splitTextToSize(texto, w) as string[];
    doc.setFont("helvetica", estilo).setFontSize(size).setTextColor(...cor);
    ls.forEach((linha, i) => {
      if (!cabe(lh(size))) novaColOuPag();
      const x = colX(col) + indent;
      if (i === ls.length - 1) doc.text(linha, x, y);
      else doc.text(linha, x, y, { align: "justify", maxWidth: w });
      y += lh(size);
    });
  };

  // ---------- QUESTÕES ----------
  const SUP = 9.5, ENUN = 10.5, ALT = 10, FT = 8;
  dados.questoes.forEach((q, i) => {
    // estima a altura do bloco para tentar mantê-lo junto
    let alt = 0;
    if (q.texto_base) alt += nLin(q.texto_base, colW - 12) * lh(SUP) + 4;
    if (q.fonte_texto_base) alt += nLin(q.fonte_texto_base, colW - 12) * lh(FT) + 4;
    alt += nLin(`${i + 1}) ${q.enunciado}`, colW) * lh(ENUN) + 2;
    for (const op of q.alternativas) alt += nLin(op, colW - 18) * lh(ALT);
    if (alt <= alturaColuna && !cabe(alt)) novaColOuPag();

    // texto de apoio com barra lateral
    if (q.texto_base) {
      const ls = doc.splitTextToSize(q.texto_base, colW - 12) as string[];
      const topo = y - SUP * 0.8;
      doc.setFont("helvetica", "italic").setFontSize(SUP).setTextColor(70, 70, 70);
      ls.forEach((linha, k) => {
        if (!cabe(lh(SUP))) novaColOuPag();
        const x = colX(col) + 12;
        if (k === ls.length - 1) doc.text(linha, x, y);
        else doc.text(linha, x, y, { align: "justify", maxWidth: colW - 12 });
        y += lh(SUP);
      });
      doc.setDrawColor(150, 160, 200).setLineWidth(2);
      doc.line(colX(col) + 2, topo, colX(col) + 2, y - lh(SUP) + SUP * 0.4);
      doc.setLineWidth(0.5);
      if (q.fonte_texto_base) {
        doc.setFont("helvetica", "italic").setFontSize(FT).setTextColor(140, 140, 140);
        const lf = doc.splitTextToSize(q.fonte_texto_base, colW - 12) as string[];
        for (const linha of lf) {
          if (!cabe(lh(FT))) novaColOuPag();
          doc.text(linha, colX(col) + colW, y, { align: "right" });
          y += lh(FT);
        }
      }
      y += 6;
    }

    par(`${i + 1}) ${q.enunciado}`, ENUN, "bold", [25, 25, 25]);
    y += 2;
    q.alternativas.forEach((op, k) =>
      par(`${"ABCDE"[k]}) ${op}`, ALT, "normal", [45, 45, 45], 18)
    );

    y += 9;
    if (cabe(1)) {
      doc.setDrawColor(230).setLineWidth(0.5);
      doc.line(colX(col), y, colX(col) + colW, y);
    }
    y += 13;
  });

  // ---------- GABARITO ----------
  doc.addPage();
  marcaDagua();
  y = M;
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(30, 39, 102);
  doc.text("Gabarito", M, y + 4);
  y += 12;
  doc.setDrawColor(30, 39, 102).setLineWidth(1.4).line(M, y, W - M, y);
  y += 24;
  const cg = 5;
  const wg = (W - M * 2) / cg;
  dados.questoes.forEach((q, i) => {
    const c = i % cg, r = Math.floor(i / cg);
    const gx = M + c * wg, gy = y + r * 24;
    doc.setFont("courier", "bold").setFontSize(11).setTextColor(46, 59, 143);
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
