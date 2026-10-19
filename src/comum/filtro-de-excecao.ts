import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

import { ErroDeDominio } from "./erros";

type CorpoDeErro = { erro: string; mensagem: string; status: number };

/**
 * Formato único de erro (BE-01 §7). Nada de detalhe interno vaza para o
 * cliente: o que não é erro de domínio vira 500 genérico e só aparece no log.
 */
@Catch()
export class FiltroDeExcecao implements ExceptionFilter {
  private readonly log = new Logger(FiltroDeExcecao.name);

  catch(excecao: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();
    const corpo = this.traduzir(excecao);

    if (corpo.status >= 500) {
      this.log.error(excecao instanceof Error ? excecao.stack : excecao);
    }

    resposta.status(corpo.status).json(corpo);
  }

  private traduzir(excecao: unknown): CorpoDeErro {
    if (excecao instanceof ErroDeDominio) {
      return {
        erro: excecao.codigo,
        mensagem: excecao.mensagem,
        status: excecao.status,
      };
    }

    if (excecao instanceof HttpException) {
      return {
        erro: "REQUISICAO_INVALIDA",
        mensagem: excecao.message,
        status: excecao.getStatus(),
      };
    }

    return {
      erro: "ERRO_INTERNO",
      mensagem: "Algo deu errado. Tente de novo.",
      status: 500,
    };
  }
}
