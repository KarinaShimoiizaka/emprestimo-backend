-- BE-04 §2: tabela emprestimo e as invariantes da BE-01 §3.

-- CreateTable
CREATE TABLE "emprestimo" (
    "id" UUID NOT NULL,
    "equipamento_id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "retirada_em" DATE NOT NULL,
    "devolver_ate" DATE NOT NULL,
    "devolvido_em" DATE,

    CONSTRAINT "emprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emprestimo_perfil_id_idx" ON "emprestimo"("perfil_id");

-- AddForeignKey
ALTER TABLE "emprestimo" ADD CONSTRAINT "emprestimo_equipamento_id_fkey" FOREIGN KEY ("equipamento_id") REFERENCES "equipamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emprestimo" ADD CONSTRAINT "emprestimo_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Um equipamento não pode ter dois empréstimos abertos. É o que garante que,
-- de dois pedidos simultâneos ao mesmo item, só um é criado.
CREATE UNIQUE INDEX "emprestimo_aberto_unico" ON "emprestimo"("equipamento_id") WHERE "devolvido_em" IS NULL;

-- Prazo nunca é anterior à retirada.
ALTER TABLE "emprestimo" ADD CONSTRAINT "prazo_coerente" CHECK ("devolver_ate" > "retirada_em");

-- Trava de manutenção e limite de 5 abertos por pessoa. O service confere as
-- duas antes, para devolver mensagem legível; aqui é a rede de segurança
-- contra corrida. A mensagem da exceção é o código que o backend traduz.
CREATE FUNCTION "emprestimo_antes_de_inserir"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  abertos integer;
BEGIN
  IF (SELECT "situacao" FROM "equipamento" WHERE "id" = NEW."equipamento_id") = 'manutencao' THEN
    RAISE EXCEPTION 'EM_MANUTENCAO';
  END IF;

  -- Serializa os pedidos da mesma pessoa: dois inserts simultâneos não
  -- conseguem contar o mesmo total e passar os dois do limite.
  PERFORM pg_advisory_xact_lock(hashtext(NEW."perfil_id"::text));

  SELECT count(*) INTO abertos
    FROM "emprestimo"
   WHERE "perfil_id" = NEW."perfil_id" AND "devolvido_em" IS NULL;

  IF abertos >= 5 THEN
    RAISE EXCEPTION 'LIMITE_ATINGIDO';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "emprestimo_antes_de_inserir"
  BEFORE INSERT ON "emprestimo"
  FOR EACH ROW EXECUTE FUNCTION "emprestimo_antes_de_inserir"();

-- RLS ligado e sem política (ADR-003): a API pública do Supabase não lê nem
-- escreve empréstimos. Só o backend, pela conexão direta.
ALTER TABLE "emprestimo" ENABLE ROW LEVEL SECURITY;
