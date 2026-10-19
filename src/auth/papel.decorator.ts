import { SetMetadata } from "@nestjs/common";

import { Papel } from "../comum/valores/papel";

export const PAPEL_EXIGIDO = "papelExigido";

/** Marca uma rota como exclusiva de um papel. Ex.: `@ExigePapel(Papel.Operacoes)`. */
export const ExigePapel = (papel: Papel) => SetMetadata(PAPEL_EXIGIDO, papel);
