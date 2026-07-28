// lib/pdf.ts
// PDF do simulado — paleta B, fonte Lato embutida, marca d'água transparente,
// motor de layout em colunas que preenche de verdade (sem vazios).
// Requer:  npm install jspdf   +   o arquivo lib/lato-font.ts

import { jsPDF } from "jspdf";
import type { QuestaoSorteada } from "@/lib/sorteio";
import { registrarLato } from "@/lib/lato-font";

export type CampoCabecalho = { on: boolean; valor: string };
export type Cabecalho = {
  disciplina: boolean;
  descritores: boolean;
  escola: CampoCabecalho;
  turma: CampoCabecalho;
  aluno: CampoCabecalho;
  data: CampoCabecalho;
};
export type DadosPDF = {
  etapa: string;
  formato: "prosa" | "colunas";
  cabecalho: Cabecalho;
  questoes: QuestaoSorteada[];
};

const TEAL: [number, number, number] = [15, 118, 110];
const CORAL: [number, number, number] = [242, 118, 94];
const TEXTO: [number, number, number] = [18, 33, 31];
const SUAVE: [number, number, number] = [110, 125, 122];
const BARRA: [number, number, number] = [150, 190, 183];
const F = "Lato";

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
  registrarLato(doc);
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

  // ---- marca d'água: opacidade REAL via GState (técnica confiável) ----
  const marca = () => {
    const g = doc as unknown as {
      saveGraphicsState: () => void;
      restoreGraphicsState: () => void;
      setGState: (s: unknown) => void;
      GState: new (o: { opacity: number }) => unknown;
    };
    g.saveGraphicsState();
    g.setGState(new g.GState({ opacity: 0.05 }));
    doc.setFont(F, "bold").setFontSize(26).setTextColor(...TEAL);
    for (let yy = 96; yy < H; yy += 118) {
      for (let xx = 24; xx < W; xx += 150) {
        doc.text("BQPD", xx, yy, { angle: 20 });
      }
    }
    g.restoreGraphicsState();
  };
  marca();

  // ---------------- CABEÇALHO (1ª página) ----------------
  let y = M;
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, W, 6, "F");
  const titulo = "Simulado" + (dados.cabecalho.disciplina ? " · Língua Portuguesa" : "");
  doc.setFont(F, "bold").setFontSize(16).setTextColor(...TEAL);
  doc.text(titulo, M, y + 6);
  doc.setDrawColor(...CORAL).setLineWidth(2.2);
  doc.line(M, y + 13, M + 46, y + 13);
  y += 26;

  const campo = (rot: string, c: CampoCabecalho) =>
    c.valor.trim() ? `${rot}: ${c.valor.trim()}` : `${rot}: ______________________`;
  const l1: string[] = [];
  if (dados.cabecalho.escola.on) l1.push(campo("Escola", dados.cabecalho.escola));
  if (dados.cabecalho.turma.on) l1.push(campo("Turma", dados.cabecalho.turma));
  const l2: string[] = [];
  if (dados.cabecalho.aluno.on) l2.push(campo("Aluno(a)", dados.cabecalho.aluno));
  if (dados.cabecalho.data.on)
    l2.push(`Data: ${dados.cabecalho.data.valor.trim() || "___/___/____"}`);
  const linhas = [l1, l2].filter((l) => l.length);

  const descs = [...new Map(dados.questoes.map((q) => [q.descritor, q.descritor_desc])).entries()].sort(
    (a, b) => a[0].localeCompare(b[0])
  );
  const descTexto = dados.cabecalho.descritores ? "Descritores: " + descs.map(([c]) => c).join(", ") : "";

  if (linhas.length || descTexto) {
    doc.setFont(F, "normal").setFontSize(9.5);
    let descLinhas: string[] = [];
    let extra = 0;
    if (descTexto) {
      descLinhas = doc.splitTextToSize(descTexto, W - M * 2 - 24) as string[];
      extra = descLinhas.length * 13 + 4;
    }
    const boxH = linhas.length * 18 + 12 + extra;
    doc.setDrawColor(220, 230, 228).setLineWidth(0.5).setFillColor(242, 247, 246);
    doc.roundedRect(M, y, W - M * 2, boxH, 5, 5, "FD");
    let ly = y + 18;
    doc.setTextColor(60, 72, 70);
    for (const l of linhas) {
      doc.text(l[0], M + 12, ly);
      if (l[1]) doc.text(l[1], W - M - 12, ly, { align: "right" });
      ly += 18;
    }
    if (descTexto) {
      doc.setTextColor(...TEAL).setFont(F, "bold");
      doc.text(descLinhas, M + 12, ly + 2);
    }
    y += boxH + 16;
  } else y += 4;

  // ---- motor de colunas: cada página tem seu próprio topo ----
  const topoPrimeira = y; // abaixo do cabeçalho, na página 1
  const topoOutras = M + 14; // topo nas páginas seguintes
  let topoAtual = topoPrimeira;
  let col = 0;

  const novaColOuPag = () => {
    if (col < colunas - 1) {
      col++;
      y = topoAtual; // topo da PÁGINA ATUAL (corrige o antigo vazio)
    } else {
      doc.addPage();
      marca();
      topoAtual = topoOutras;
      col = 0;
      y = topoAtual;
    }
  };
  const cabe = (h: number) => y + h <= H - RODAPE;

  const barraLinha = (size: number) => {
    doc.setDrawColor(...BARRA).setLineWidth(2);
    doc.line(colX(col) + 3, y - size * 0.82, colX(col) + 3, y + size * 0.22);
  };

  // PROSA justificada (manual), com recuo na 1ª linha + barra opcional
  const prosa = (
    texto: string,
    size: number,
    estilo: "normal" | "bold",
    cor: [number, number, number],
    opt: { indent?: number; recuo?: number; barra?: boolean } = {}
  ) => {
    const indent = opt.indent || 0;
    const recuo = opt.recuo || 0;
    doc.setFont(F, estilo).setFontSize(size).setTextColor(...cor);
    const espaco = doc.getTextWidth(" ");
    const larguraTotal = colW - indent;
    const palavras = texto.split(/\s+/).filter(Boolean);
    let linha: string[] = [];
    let larg = 0;
    let primeira = true;
    const desenha = (ultima: boolean) => {
      if (!cabe(lh(size))) novaColOuPag();
      if (opt.barra) barraLinha(size);
      const rec = primeira ? recuo : 0;
      const disp = larguraTotal - rec;
      let x = colX(col) + indent + rec;
      if (ultima || linha.length === 1) {
        doc.text(linha.join(" "), x, y);
      } else {
        const wPal = linha.reduce((s, w) => s + doc.getTextWidth(w), 0);
        const gapExtra = (disp - wPal) / (linha.length - 1);
        for (const w of linha) {
          doc.text(w, x, y);
          x += doc.getTextWidth(w) + gapExtra;
        }
      }
      y += lh(size);
      primeira = false;
      linha = [];
      larg = 0;
    };
    for (const p of palavras) {
      const wW = doc.getTextWidth(p);
      const rec = primeira ? recuo : 0;
      const disp = larguraTotal - rec;
      const proj = larg + (linha.length ? espaco : 0) + wW;
      if (proj > disp && linha.length) {
        desenha(false);
        linha = [p];
        larg = wW;
      } else {
        if (linha.length) larg += espaco;
        linha.push(p);
        larg += wW;
      }
    }
    if (linha.length) desenha(true);
  };

  // VERSO: preserva as linhas (sem justificar)
  const verso = (texto: string, size: number, cor: [number, number, number], indent: number, barra: boolean) => {
    doc.setFont(F, "normal").setFontSize(size).setTextColor(...cor);
    for (const bruta of texto.split("\n")) {
      const ls = doc.splitTextToSize(bruta, colW - indent) as string[];
      for (const l of ls) {
        if (!cabe(lh(size))) novaColOuPag();
        if (barra) barraLinha(size);
        doc.text(l, colX(col) + indent, y);
        y += lh(size);
      }
    }
  };

  // ---------------- QUESTÕES ----------------
  const SUP = 9.5, ENUN = 10.5, ALT = 10, FT = 8;
  dados.questoes.forEach((q, i) => {
    if (q.texto_base) {
      // comando de leitura — funciona como divisória "aqui começa um texto"
      if (!cabe(lh(8.5) + 6)) novaColOuPag();
      doc.setFont(F, "bold").setFontSize(8.5).setTextColor(...TEAL);
      doc.text("Leia o texto para responder à questão.", colX(col), y);
      y += lh(8.5) + 4;
      const blocos = q.texto_base.split("\n\n");
      blocos.forEach((b, k) => {
        if (b.includes("\n")) verso(b, SUP, [55, 60, 58], 14, true);
        else prosa(b, SUP, "normal", [55, 60, 58], { indent: 14, recuo: 14, barra: true });
        if (k < blocos.length - 1) y += 4;
      });
      if (q.fonte_texto_base) {
        doc.setFont(F, "normal").setFontSize(FT).setTextColor(...SUAVE);
        const lf = doc.splitTextToSize(q.fonte_texto_base, colW - 14) as string[];
        for (const l of lf) {
          if (!cabe(lh(FT))) novaColOuPag();
          doc.text(l, colX(col) + colW, y, { align: "right" });
          y += lh(FT);
        }
      }
      y += 6;
    }

    prosa(`${i + 1}) ${q.enunciado}`, ENUN, "bold", TEXTO, {});
    y += 2;
    q.alternativas.forEach((op, k) =>
      prosa(`${"ABCDE"[k]}) ${op}`, ALT, "normal", [50, 55, 53], { indent: 16 })
    );

    y += 6;
    if (cabe(1)) {
      doc.setDrawColor(224, 232, 230).setLineWidth(0.5);
      doc.line(colX(col), y, colX(col) + colW, y);
    }
    y += 9;
  });

  // ---------------- GABARITO ----------------
  doc.addPage();
  marca();
  y = M;
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, W, 6, "F");
  doc.setFont(F, "bold").setFontSize(15).setTextColor(...TEAL);
  doc.text("Gabarito", M, y + 6);
  doc.setDrawColor(...CORAL).setLineWidth(2.2);
  doc.line(M, y + 13, M + 46, y + 13);
  y += 34;
  const cg = 5;
  const wg = (W - M * 2) / cg;
  dados.questoes.forEach((q, i) => {
    const c = i % cg, r = Math.floor(i / cg);
    const gx = M + c * wg, gy = y + r * 24;
    doc.setFont(F, "bold").setFontSize(11).setTextColor(...TEAL);
    doc.text(`${String(i + 1).padStart(2, "0")}.`, gx, gy);
    doc.setTextColor(...TEXTO);
    doc.text(`${"ABCDE"[q.gabaritoIndex]}`, gx + 24, gy);
  });

  // ---------------- RODAPÉ ----------------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("courier", "normal").setFontSize(7.5).setTextColor(160);
    doc.text(serie, M, H - 22);
    doc.text("Material autoral — proibida a redistribuição.", W / 2, H - 22, { align: "center" });
    doc.text(`Pág. ${p}/${total}`, W - M, H - 22, { align: "right" });
  }

  doc.save(`simulado-${serie}.pdf`);
  return serie;
}
