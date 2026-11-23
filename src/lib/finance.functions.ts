import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emptyVault, vaultSchema } from "./finance";

export const loadVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("finance_vaults")
      .select("data,version,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar seus dados. Tente novamente.");
    return data
      ? { vault: vaultSchema.parse(data.data), version: data.version, updatedAt: data.updated_at }
      : { vault: emptyVault(), version: -1, updatedAt: null };
  });
export const saveVault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ vault: vaultSchema, version: z.number().int().min(-1) }))
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      data: JSON.parse(JSON.stringify(data.vault)),
      version: data.version + 1,
      updated_at: new Date().toISOString(),
    };
    const result =
      data.version === -1
        ? await context.supabase
            .from("finance_vaults")
            .insert(payload)
            .select("version,updated_at")
            .single()
        : await context.supabase
            .from("finance_vaults")
            .update(payload)
            .eq("user_id", context.userId)
            .eq("version", data.version)
            .select("version,updated_at")
            .maybeSingle();
    if (result.error || !result.data)
      throw new Error(
        "Não foi possível salvar. Recarregue os dados antes de tentar novamente; suas alterações não foram confirmadas.",
      );
    return { version: result.data.version, updatedAt: result.data.updated_at };
  });
