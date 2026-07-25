// lib/pdf.ts
// Gera o PDF do simulado no navegador.
// Recursos: marca d'água atrás do texto, texto justificado, layout em 1 ou 2
// colunas, cabeçalho configurável e número de série para rastreabilidade.
// Requer:  npm install jspdf

import { jsPDF } from "jspdf";
import type { QuestaoSorteada } from "@/lib/sorteio";

export type CampoCabecalho = { on: boolean; valor: string };

export type Cabecalho = {
  disciplina: boolean; // imprime "Língua Portuguesa" no título
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

export function gerarNumeroSerie(etapa: string): string {
  const sigla = etapa.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 3);
  const h = new Date();
  const data =
    h.getFullYear().toString() +
    String(h.getMonth() + 1).padStart(2, "0") +
    String(h.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rnd = "";
  for (let i = 0; i < 6; i++)
    rnd += chars[Math.floor(Math.random() * chars.length)];
  return `BQPD-${sigla}-${data}-${rnd}`;
}

export function gerarPDF(dados: DadosPDF): string {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const serie = gerarNumeroSerie(dados.etapa);
  const M = 46;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const RODAPE = 40;
  const colunas = dados.formato === "colunas" ? 2 : 1;
  const gap = 24;
  const colW = (W - M * 2 - gap * (colunas - 1)) / colunas;
  const colX = (i: number) => M + i * (colW + gap);

  // ---------- MARCA D'ÁGUA (desenhada ANTES do conteúdo = fica atrás) ----------
  const marcaDagua = () => {
    doc.setTextColor(240, 241, 247); // cinza bem claro
    doc.setFont("helvetica", "bold").setFontSize(40);
    for (let yy = 130; yy < H; yy += 175) {
      for (let xx = -10; xx < W; xx += 210) {
        doc.text("BQPD", xx, yy, { angle: 32 });
      }
    }
  };

  marcaDagua();

  // ---------- CABEÇALHO (só na primeira página, largura total) ----------
  let y = M;
  doc.setFillColor(30, 39, 102);
  doc.rect(0, 0, W, 8, "F");
  const titulo =
    "Simulado" + (dados.cabecalho.disciplina ? " — Língua Portuguesa" : "");
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(30, 39, 102);
  doc.text(titulo, M, y + 15);
  y += 15;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  doc.text(dados.etapa, M, y + 15);
  y += 26;
  doc.setDrawColor(210).line(M, y, W - M, y);
  y += 16;

  // linha de campos (escola/turma), depois (aluno/data)
  const campo = (rotulo: string, c: CampoCabecalho, largura: number) => {
    const texto = c.valor.trim()
      ? `${rotulo}: ${c.valor.trim()}`
      : `${rotulo}: ${"_".repeat(Math.max(6, Math.floor(largura / 5)))}`;
    return texto;
  };
  doc.setFontSize(10).setTextColor(70);
  const linha1: string[] = [];
  if (dados.cabecalho.escola.on)
    linha1.push(campo("Escola", dados.cabecalho.escola, 40));
  if (dados.cabecalho.turma.on)
    linha1.push(campo("Turma", dados.cabecalho.turma, 12));
  if (linha1.length) {
    doc.text(linha1[0], M, y);
    if (linha1[1]) doc.text(linha1[1], W - M, y, { align: "right" });
    y += 17;
  }
  const linha2: string[] = [];
  if (dados.cabecalho.aluno.on)
    linha2.push(campo("Aluno(a)", dados.cabecalho.aluno, 44));
  if (dados.cabecalho.data.on) {
    const d = dados.cabecalho.data.valor.trim() || "___/___/____";
    linha2.push(`Data: ${d}`);
  }
  if (linha2.length) {
    doc.text(linha2[0], M, y);
    if (linha2[1]) doc.text(linha2[1], W - M, y, { align: "right" });
    y += 17;
  }
  y += 6;

  const topoConteudo = y; // onde as questões começam na 1ª página
  const topoResto = M + 10; // topo das páginas seguintes
  let col = 0;

  // ---------- controle de fluxo em colunas/páginas ----------
  const novaColunaOuPagina = () => {
    if (col < colunas - 1) {
      col++;
      y = topoConteudo;
    } else {
      doc.addPage();
      marcaDagua();
      col = 0;
      y = topoResto;
    }
  };
  const garantir = (altura: number) => {
    if (y + altura > H - RODAPE) novaColunaOuPagina();
  };

  // escreve um parágrafo justificado (a última linha não estica)
  const paragrafo = (
    texto: string,
    opts: {
      size: number;
      estilo: "normal" | "bold" | "italic";
      cor: [number, number, number];
      indent?: number;
      justificar?: boolean;
    }
  ) => {
    const indent = opts.indent || 0;
    const largura = colW - indent;
    doc.setFont("helvetica", opts.estilo).setFontSize(opts.size);
    doc.setTextColor(...opts.cor);
    const linhas = doc.splitTextToSize(texto, largura) as string[];
    const lh = opts.size * 1.35;
    linhas.forEach((linha, i) => {
      garantir(lh);
      const ehUltima = i === linhas.length - 1;
      const x = colX(col) + indent;
      if (opts.justificar && !ehUltima) {
        doc.text(linha, x, y, { align: "justify", maxWidth: largura });
      } else {
        doc.text(linha, x, y);
      }
      y += lh;
    });
  };

  // ---------- QUESTÕES ----------
  dados.questoes.forEach((q, i) => {
    if (q.texto_base) {
      paragrafo(q.texto_base, {
        size: 9.5,
        estilo: "italic",
        cor: [90, 90, 90],
        justificar: true,
      });
      y += 4;
    }
    paragrafo(`${i + 1}) ${q.enunciado}`, {
      size: 10.5,
      estilo: "bold",
      cor: [25, 25, 25],
      justificar: true,
    });
    y += 2;
    q.alternativas.forEach((op, k) => {
      paragrafo(`${"ABCDE"[k]}) ${op}`, {
        size: 10,
        estilo: "normal",
        cor: [45, 45, 45],
        indent: 16,
      });
    });
    y += 10;
  });

  // ---------- GABARITO (nova página, largura total) ----------
  doc.addPage();
  marcaDagua();
  y = M;
  doc.setFillColor(30, 39, 102);
  doc.rect(0, 0, W, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(30, 39, 102);
  doc.text("Gabarito", M, y + 15);
  y += 32;
  doc.setDrawColor(210).line(M, y, W - M, y);
  y += 22;
  const colsGab = 5;
  const larguraGab = (W - M * 2) / colsGab;
  dados.questoes.forEach((q, i) => {
    const c = i % colsGab;
    const r = Math.floor(i / colsGab);
    const gx = M + c * larguraGab;
    const gy = y + r * 24;
    doc.setFont("courier", "bold").setFontSize(11).setTextColor(46, 59, 143);
    doc.text(`${String(i + 1).padStart(2, "0")}.`, gx, gy);
    doc.setFont("helvetica", "bold").setTextColor(30);
    doc.text(`${"ABCDE"[q.gabaritoIndex]}`, gx + 26, gy);
  });

  // ---------- RODAPÉ com número de série (todas as páginas) ----------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("courier", "normal").setFontSize(7.5).setTextColor(150);
    doc.text(serie, M, H - 22);
    doc.text("Material autoral — proibida a redistribuição.", W / 2, H - 22, {
      align: "center",
    });
    doc.text(`Pág. ${p}/${total}`, W - M, H - 22, { align: "right" });
  }

  doc.save(`simulado-${serie}.pdf`);
  return serie;
}
