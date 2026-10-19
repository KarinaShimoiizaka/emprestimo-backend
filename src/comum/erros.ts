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
