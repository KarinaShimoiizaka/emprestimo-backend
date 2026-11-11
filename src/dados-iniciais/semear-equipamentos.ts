// O seed de equipamentos (BE-03 §4): cria o que falta e atualiza o que existe
// para o que está no arquivo, por patrimônio. Nunca apaga. Só conhece o
// repositório de equipamentos: não cria usuário, perfil nem empréstimo.

import { EquipamentoInicial, validarDadosIniciais } from "./dados-iniciais";

export interface RepositorioDeEquipamentos {
  existe(patrimonio: string): Promise<boolean>;
  criar(equipamento: EquipamentoInicial): Promise<void>;
  atualizar(equipamento: EquipamentoInicial): Promise<void>;
}

export interface ResultadoDoSeed {
  criados: string[];
  atualizados: string[];
}

export async function semearEquipamentos(
  dados: EquipamentoInicial[],
  repositorio: RepositorioDeEquipamentos,
): Promise<ResultadoDoSeed> {
  const problemas = validarDadosIniciais(dados);
  if (problemas.length) {
    throw new Error(`dados iniciais inválidos:\n- ${problemas.join("\n- ")}`);
  }

  const resultado: ResultadoDoSeed = { criados: [], atualizados: [] };
  for (const equipamento of dados) {
    if (await repositorio.existe(equipamento.patrimonio)) {
      await repositorio.atualizar(equipamento);
      resultado.atualizados.push(equipamento.patrimonio);
    } else {
      await repositorio.criar(equipamento);
      resultado.criados.push(equipamento.patrimonio);
    }
  }
  return resultado;
}
