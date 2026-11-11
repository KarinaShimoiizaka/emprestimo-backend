/**
 * Erros de domínio. Cada um carrega o código e a mensagem que a BE-02 §8
 * manda devolver — o filtro de exceção só traduz para HTTP.
 */
export abstract class ErroDeDominio extends Error {
  abstract readonly codigo: string;
  abstract readonly status: number;

  constructor(readonly mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/**
 * Toda falha de token colapsa aqui — ausente, malformado, assinatura
 * inválida ou vencido. Distinguir ajudaria quem ataca, não quem usa.
 */
export class NaoAutenticado extends ErroDeDominio {
  readonly codigo = "NAO_AUTENTICADO";
  readonly status = 401;

  constructor() {
    super("Sua sessão expirou.");
  }
}

export class SemPermissao extends ErroDeDominio {
  readonly codigo = "SEM_PERMISSAO";
  readonly status = 403;

  constructor() {
    super("Você não tem acesso a esta área.");
  }
}

// Recusas ao solicitar empréstimo (BE-04 §3), na ordem em que são conferidas.

export class EquipamentoNaoEncontrado extends ErroDeDominio {
  readonly codigo = "NAO_ENCONTRADO";
  readonly status = 404;

  constructor() {
    super("Equipamento não encontrado.");
  }
}

export class EmManutencao extends ErroDeDominio {
  readonly codigo = "EM_MANUTENCAO";
  readonly status = 422;

  constructor() {
    super("Este equipamento está em manutenção.");
  }
}

export class EquipamentoIndisponivel extends ErroDeDominio {
  readonly codigo = "EQUIPAMENTO_INDISPONIVEL";
  readonly status = 409;

  constructor() {
    super("Este equipamento já está emprestado.");
  }
}

export class BloqueadoPorAtraso extends ErroDeDominio {
  readonly codigo = "BLOQUEADO_POR_ATRASO";
  readonly status = 422;

  constructor() {
    super("Você tem um item em atraso. Devolva antes de solicitar outro.");
  }
}

export class LimiteAtingido extends ErroDeDominio {
  readonly codigo = "LIMITE_ATINGIDO";
  readonly status = 422;

  constructor() {
    super("Você já está com 5 itens.");
  }
}
