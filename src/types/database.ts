/**
 * Placeholder: `pnpm db:types` çalıştığında bu dosya
 * `supabase gen types typescript --linked` çıktısıyla üzerine yazılır.
 * O ana kadar minimal bir iskelet ile Database generic'i tatmin ediyoruz.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
