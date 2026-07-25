// lib/pdf.ts
// Gera o PDF do simulado no navegador.
// Recursos: marca d'água atrás do texto, texto JUSTIFICADO de verdade,
// texto-base agrupado à questão (barra lateral) com a fonte recuada à direita,
// layout em 1 ou 2 colunas, cabeçalho configurável e número de série.
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
  etapa: string; // usado só no número de série, NÃO é impresso no cabeçalho
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
  doc.setLineHeightFactor(1.35);
  const serie = gerarNumeroSerie(dados.etapa);
  const M = 46;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const RODAPE = 42;
  const colunas = dados.formato === "colunas" ? 2 : 1;
  const gap = 26;
  const colW = (W - M * 2 - gap * (colunas - 1)) / colunas;
  const colX = (i: number) => M + i * (colW + gap);
  const lh = (size: number) => size * 1.35;
  const nLinhas = (texto: string, largura: number) =>
    (doc.splitTextToSize(texto, largura) as string[]).length;

  // ---------- MARCA D'ÁGUA (antes do conteúdo = fica atrás) ----------
  const marcaDagua = () => {
    doc.setTextColor(242, 243, 248);
    doc.setFont("helvetica", "bold").setFontSize(40);
    for (let yy = 130; yy < H; yy += 178) {
      for (let xx = -10; xx < W; xx += 215) {
        doc.text("BQPD", xx, yy, { angle: 32 });
      }
    }
  };
  marcaDagua();

  // ---------- CABEÇALHO (só na 1ª página, largura total) ----------
  let y = M;
  doc.setFillColor(30, 39, 102);
  doc.rect(0, 0, W, 8, "F");
  const titulo =
    "Simulado" + (dados.cabecalho.disciplina ? " — Língua Portuguesa" : "");
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(30, 39, 102);
  doc.text(titulo, M, y + 16);
  y += 30;

  // caixa de identificação (só se houver algum campo ligado)
  const linhaCampo = (rotulo: string, c: CampoCabecalho) =>
    c.valor.trim() ? `${rotulo}: ${c.valor.trim()}` : `${rotulo}: ______________________`;
  const l1: string[] = [];
  if (dados.cabecalho.escola.on) l1.push(linhaCampo("Escola", dados.cabecalho.escola));
  if (dados.cabecalho.turma.on) l1.push(linhaCampo("Turma", dados.cabecalho.turma));
  const l2: string[] = [];
  if (dados.cabecalho.aluno.on) l2.push(linhaCampo("Aluno(a)", dados.cabecalho.aluno));
  if (dados.cabecalho.data.on)
    l2.push(`Data: ${dados.cabecalho.data.valor.trim() || "___/___/____"}`);

  if (l1.length || l2.length) {
    const linhas = [l1, l2].filter((l) => l.length);
    const boxH = linhas.length * 20 + 12;
    doc.setDrawColor(214).setFillColor(248, 249, 252);
    doc.roundedRect(M, y, W - M * 2, boxH, 6, 6, "FD");
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
    let ly = y + 20;
    for (const linha of linhas) {
      doc.text(linha[0], M + 14, ly);
      if (linha[1]) doc.text(linha[1], W - M - 14, ly, { align: "right" });
      ly += 20;
    }
    y += boxH + 14;
  } else {
    y += 6;
  }

  const topoConteudo = y;
  const topoResto = M + 12;
  const alturaColuna = H - RODAPE - topoResto;
  let col = 0;

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
  const cabe = (altura: number) => y + altura <= H - RODAPE;

  // desenha um parágrafo justificado (última linha não estica)
  const paragrafo = (
    texto: string,
    size: number,
    estilo: "normal" | "bold" | "italic",
    cor: [number, number, number],
    indent = 0
  ) => {
    const largura = colW - indent;
    const linhas = doc.splitTextToSize(texto, largura) as string[];
    doc.setFont("helvetica", estilo).setFontSize(size).setTextColor(...cor);
    const x = colX(col) + indent;
    linhas.forEach((linha, i) => {
      if (!cabe(lh(size))) novaColunaOuPagina();
      const ultima = i === linhas.length - 1;
      if (ultima) doc.text(linha, colX(col) + indent, y);
      else doc.text(linha, colX(col) + indent, y, { align: "justify", maxWidth: largura });
      y += lh(size);
    });
  };

  // ---------- QUESTÕES ----------
  const SUP = 9.5, ENUN = 10.5, ALT = 10, FONTE = 8;
  dados.questoes.forEach((q, i) => {
    // altura estimada do bloco inteiro (texto + fonte + enunciado + alternativas)
    let alturaBloco = 0;
    if (q.texto_base) {
      alturaBloco += nLinhas(q.texto_base, colW - 12) * lh(SUP) + 6;
      alturaBloco += lh(FONTE) + 4;
    }
    alturaBloco += nLinhas(`${i + 1}) ${q.enunciado}`, colW) * lh(ENUN) + 3;
    for (const op of q.alternativas)
      alturaBloco += nLinhas(op, colW - 18) * lh(ALT);
    // mantém o bloco junto se couber numa coluna inteira
    const cabeInteiro = alturaBloco <= alturaColuna;
    if (cabeInteiro && !cabe(alturaBloco)) novaColunaOuPagina();

    // ----- TEXTO-BASE com barra lateral (agrupa visualmente) -----
    if (q.texto_base) {
      const linhasSup = doc.splitTextToSize(q.texto_base, colW - 12) as string[];
      const barTop = y - SUP * 0.8;
      const xTexto = colX(col) + 12;
      doc.setFont("helvetica", "italic").setFontSize(SUP).setTextColor(70, 70, 70);
      linhasSup.forEach((linha, k) => {
        if (!cabe(lh(SUP))) novaColunaOuPagina();
        const ultima = k === linhasSup.length - 1;
        if (ultima) doc.text(linha, xTexto, y);
        else doc.text(linha, xTexto, y, { align: "justify", maxWidth: colW - 12 });
        y += lh(SUP);
      });
      // barra vertical à esquerda do texto
      doc.setDrawColor(150, 160, 200).setLineWidth(2);
      doc.line(colX(col) + 2, barTop, colX(col) + 2, y - lh(SUP) + SUP * 0.4);
      doc.setLineWidth(0.2);
      // fonte: menor e recuada à direita, logo abaixo do texto
      if (q.fonte_texto_base) {
        y += 2;
        doc.setFont("helvetica", "italic").setFontSize(FONTE).setTextColor(120, 120, 120);
        const lf = doc.splitTextToSize(q.fonte_texto_base, colW - 12) as string[];
        for (const linha of lf) {
          if (!cabe(lh(FONTE))) novaColunaOuPagina();
          doc.text(linha, colX(col) + colW, y, { align: "right" });
          y += lh(FONTE);
        }
      }
      y += 5; // pequeno respiro entre texto e enunciado (ficam juntos)
    }

    // ----- ENUNCIADO -----
    paragrafo(`${i + 1}) ${q.enunciado}`, ENUN, "bold", [25, 25, 25]);
    y += 2;
    // ----- ALTERNATIVAS -----
    q.alternativas.forEach((op, k) => {
      paragrafo(`${"ABCDE"[k]}) ${op}`, ALT, "normal", [45, 45, 45], 18);
    });

    // ----- separador entre questões (respiro maior + filete) -----
    y += 10;
    if (cabe(1)) {
      doc.setDrawColor(228).setLineWidth(0.5);
      doc.line(colX(col), y, colX(col) + colW, y);
    }
    y += 12;
  });

  // ---------- GABARITO (nova página) ----------
  doc.addPage();
  marcaDagua();
  y = M;
  doc.setFillColor(30, 39, 102);
  doc.rect(0, 0, W, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(30, 39, 102);
  doc.text("Gabarito", M, y + 16);
  y += 34;
  doc.setDrawColor(210).setLineWidth(0.5).line(M, y, W - M, y);
  y += 22;
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

  // ---------- RODAPÉ (todas as páginas) ----------
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
