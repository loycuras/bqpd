// lib/pdf.ts
// Gera o PDF do simulado no navegador, com marca d'água (diagonal + rodapé)
// e número de série para rastreabilidade.
// Requer o pacote jspdf:  npm install jspdf

import { jsPDF } from "jspdf";
import type { QuestaoSorteada } from "@/lib/sorteio";

export type DadosPDF = {
  etapa: string;
  escola: string;
  turma: string;
  questoes: QuestaoSorteada[];
};

// Gera um número de série único para o PDF.
// Ex.: BQPD-3EM-20260725-A7F3K2
// (Na M4, este número será também salvo no banco, ligado à conta que gerou.)
export function gerarNumeroSerie(etapa: string): string {
  const sigla = etapa.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 3);
  const hoje = new Date();
  const data =
    hoje.getFullYear().toString() +
    String(hoje.getMonth() + 1).padStart(2, "0") +
    String(hoje.getDate()).padStart(2, "0");
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rnd = "";
  for (let i = 0; i < 6; i++)
    rnd += letras[Math.floor(Math.random() * letras.length)];
  return `BQPD-${sigla}-${data}-${rnd}`;
}

export function gerarPDF(dados: DadosPDF): string {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const serie = gerarNumeroSerie(dados.etapa);
  const M = 48; // margem
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const CW = W - M * 2; // largura útil
  let y = M;

  const novaPagina = () => {
    doc.addPage();
    y = M;
  };
  const checar = (precisa: number) => {
    if (y + precisa > H - 60) novaPagina();
  };

  // ---------- CABEÇALHO ----------
  doc.setFillColor(30, 39, 102);
  doc.rect(0, 0, W, 8, "F");
  doc.setTextColor(30, 39, 102).setFont("helvetica", "bold").setFontSize(17);
  doc.text("Simulado — Língua Portuguesa", M, y + 16);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(90);
  doc.text(`${dados.etapa}`, M, y + 16);
  y += 30;
  doc.setDrawColor(210).line(M, y, W - M, y);
  y += 18;

  // ---------- IDENTIFICAÇÃO (escola/turma, sem nome do professor) ----------
  doc.setFontSize(10).setTextColor(70);
  doc.text(`Escola: ${dados.escola || "______________________________"}`, M, y);
  doc.text(`Turma: ${dados.turma || "____________"}`, W - M, y, {
    align: "right",
  });
  y += 18;
  doc.text(
    "Aluno(a): ______________________________________   Data: ___/___/____",
    M,
    y
  );
  y += 24;

  // ---------- QUESTÕES ----------
  doc.setFontSize(11);
  dados.questoes.forEach((q, i) => {
    // texto-base (quando houver)
    if (q.texto_base) {
      const linhas = doc.splitTextToSize(q.texto_base, CW);
      checar(linhas.length * 13 + 20);
      doc.setFont("helvetica", "italic").setTextColor(80);
      doc.text(linhas, M, y);
      y += linhas.length * 13 + 8;
    }
    // enunciado
    const enun = doc.splitTextToSize(`${i + 1}) ${q.enunciado}`, CW);
    checar(enun.length * 14 + q.alternativas.length * 15 + 16);
    doc.setFont("helvetica", "bold").setTextColor(25);
    doc.text(enun, M, y);
    y += enun.length * 14 + 4;
    // alternativas
    doc.setFont("helvetica", "normal").setTextColor(45);
    q.alternativas.forEach((op, k) => {
      const la = doc.splitTextToSize(`${"ABCDE"[k]}) ${op}`, CW - 18);
      checar(la.length * 14);
      doc.text(la, M + 18, y);
      y += la.length * 14 + 1;
    });
    y += 12;
  });

  // ---------- GABARITO (página ao final) ----------
  novaPagina();
  doc.setFillColor(30, 39, 102);
  doc.rect(0, 0, W, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(30, 39, 102);
  doc.text("Gabarito", M, y + 16);
  y += 34;
  doc.setDrawColor(210).line(M, y, W - M, y);
  y += 22;
  const col = CW / 5;
  dados.questoes.forEach((q, i) => {
    const c = i % 5;
    const r = Math.floor(i / 5);
    const gx = M + c * col;
    const gy = y + r * 24;
    doc.setFont("courier", "bold").setTextColor(46, 59, 143);
    doc.text(`${String(i + 1).padStart(2, "0")}.`, gx, gy);
    doc.setFont("helvetica", "bold").setTextColor(30);
    doc.text(`${"ABCDE"[q.gabaritoIndex]}`, gx + 26, gy);
  });

  // ---------- MARCA D'ÁGUA + RODAPÉ (em todas as páginas) ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    // diagonal clara ao fundo
    doc.setTextColor(232, 234, 244);
    doc.setFont("helvetica", "bold").setFontSize(34);
    for (let yy = 120; yy < H; yy += 150) {
      for (let xx = -20; xx < W; xx += 240) {
        doc.text("BQPD", xx, yy, { angle: 30 });
      }
    }
    // rodapé com número de série
    doc.setFont("courier", "normal").setFontSize(7.5).setTextColor(150);
    doc.text(serie, M, H - 24);
    doc.text(
      "Material autoral — proibida a redistribuição.",
      W / 2,
      H - 24,
      { align: "center" }
    );
    doc.text(`Pág. ${p}/${totalPaginas}`, W - M, H - 24, { align: "right" });
  }

  const nome = `simulado-${serie}.pdf`;
  doc.save(nome);
  return serie;
}
