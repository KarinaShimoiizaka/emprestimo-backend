import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Monta a URL pública de uma foto a partir do caminho guardado no banco
 * (BE-03 §2: caminho, não URL). Lê SUPABASE_URL e STORAGE_NAME; nenhum dos
 * dois é segredo (secrets.md).
 */
@Injectable()
export class FotosPublicas {
  private readonly base: string;

  constructor(config: ConfigService) {
    const url = String(config.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
    const bucket = encodeURIComponent(String(config.get("STORAGE_NAME") ?? ""));
    this.base = `${url}/storage/v1/object/public/${bucket}`;
  }

  url(caminho: string | null): string | null {
    if (!caminho) return null;
    return `${this.base}/${caminho.split("/").map(encodeURIComponent).join("/")}`;
  }
}
