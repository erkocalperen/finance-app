export interface PriceQuote {
  symbol: string;
  price: number;
  asOf: string; // ISO tarih
  source: string; // 'bigpara' | ...
  changePercent?: number;
}

export interface PriceProvider {
  readonly name: string;
  /**
   * Verilen sembol listesi için fiyat çeker. Bazı semboller başarısız
   * olabilir — sadece BAŞARILI olanları döndür, hata FIRLATMA.
   */
  fetchQuotes(symbols: string[]): Promise<PriceQuote[]>;
  /** Bu provider hangi instrument kind'larını destekler? */
  supports(kind: "gold" | "silver" | "stock"): boolean;
}
