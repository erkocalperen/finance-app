import type { PriceProvider, PriceQuote } from "./types";
import { BigparaProvider } from "./providers/bigpara";

/**
 * Aktif fiyat kaynakları. Yeni bir kaynak eklemek için: bir provider yaz
 * (implements PriceProvider), buraya ekle. Bu fazda sadece Bigpara ve
 * sadece hisse. Altın/gümüş için provider yok — sessizce atlanırlar,
 * manuel modda kalırlar.
 */
const providers: readonly PriceProvider[] = [new BigparaProvider()];

type InstrumentSlice = {
  id: string;
  symbol: string;
  kind: "gold" | "silver" | "stock";
};

/**
 * Verilen instrument'ları destekleyen ilk provider'a yönlendirir ve tüm
 * başarılı quote'ları birleştirir. Provider tamamen çökse bile diğerleri
 * çalışır; sonuç dizisi sadece BAŞARILI sonuçları içerir.
 */
export async function getQuotesForInstruments(
  instruments: readonly InstrumentSlice[],
): Promise<PriceQuote[]> {
  const byProvider = new Map<PriceProvider, string[]>();
  for (const ins of instruments) {
    const p = providers.find((pp) => pp.supports(ins.kind));
    if (!p) continue;
    const list = byProvider.get(p) ?? [];
    list.push(ins.symbol);
    byProvider.set(p, list);
  }

  const all: PriceQuote[] = [];
  for (const [provider, symbols] of byProvider) {
    try {
      const quotes = await provider.fetchQuotes(symbols);
      all.push(...quotes);
    } catch (err) {
      // Provider fetchQuotes zaten iç hatalarını yutmalı; buraya düşerse
      // kaynağı toptan atla, diğer sağlayıcılar çalışmaya devam etsin.
      console.warn(`provider ${provider.name} çöktü`, err);
    }
  }
  return all;
}

export type { PriceProvider, PriceQuote } from "./types";
