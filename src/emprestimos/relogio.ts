/** De onde vem "agora". Em produção, o relógio do sistema; nos testes, uma data fixa. */
export abstract class Relogio {
  abstract agora(): Date;
}

export class RelogioDoSistema extends Relogio {
  agora(): Date {
    return new Date();
  }
}
