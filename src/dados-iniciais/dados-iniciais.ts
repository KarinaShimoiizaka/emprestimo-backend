// Dados iniciais (BE-03): os 12 equipamentos da prática, com a foto de cada
// um. A fonte é backend/prisma/dados/equipamentos.json; aqui ficam o formato,
// a leitura e a validação, sem banco.

import { readFileSync } from "fs";
import { join } from "path";

export const CATEGORIAS = ["notebook", "monitor", "cabo", "camera", "acessorio"] as const;
export const SITUACOES = ["disponivel", "manutencao"] as const;

export type Categoria = (typeof CATEGORIAS)[number];
export type SituacaoFisica = (typeof SITUACOES)[number];

export interface FotoDoEquipamento {
  caminho: string;
  autor: string;
  origem: string;
  licenca: string;
}

export interface EquipamentoInicial {
  patrimonio: string;
  nome: string;
  categoria: Categoria;
  situacao: SituacaoFisica;
  imagem: FotoDoEquipamento;
}

export const ARQUIVO_DE_DADOS = join(__dirname, "..", "..", "prisma", "dados", "equipamentos.json");

export function carregarDadosIniciais(arquivo: string = ARQUIVO_DE_DADOS): EquipamentoInicial[] {
  const conteudo = JSON.parse(readFileSync(arquivo, "utf8")) as { equipamentos?: EquipamentoInicial[] };
  return conteudo.equipamentos ?? [];
}

// Devolve a lista de problemas; vazia quer dizer que pode semear.
export function validarDadosIniciais(dados: EquipamentoInicial[]): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();

  for (const e of dados) {
    const p = e.patrimonio || "(sem patrimônio)";
    if (!e.patrimonio) problemas.push("equipamento sem patrimônio");
    else if (vistos.has(e.patrimonio)) problemas.push(`${p}: patrimônio repetido`);
    else vistos.add(e.patrimonio);

    if (!e.nome?.trim()) problemas.push(`${p}: sem nome`);
    if (!CATEGORIAS.includes(e.categoria)) problemas.push(`${p}: categoria "${e.categoria}" inválida`);
    if (!SITUACOES.includes(e.situacao)) problemas.push(`${p}: situação "${e.situacao}" inválida`);

    if (e.imagem?.caminho !== `equipamentos/${e.patrimonio}.jpg`) {
      problemas.push(`${p}: caminho da foto "${e.imagem?.caminho}" fora do padrão`);
    }
    for (const campo of ["autor", "origem", "licenca"] as const) {
      if (!e.imagem?.[campo]?.trim()) problemas.push(`${p}: foto sem ${campo}`);
    }
  }
  return problemas;
}
