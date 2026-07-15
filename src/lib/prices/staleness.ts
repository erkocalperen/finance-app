/**
 * Fiyat cache eşiği. 6 saatten eski bir fiyat "stale" sayılır ve arka planda
 * tazelenmeye çalışılır. Otomatik çekmenin günde birkaç kez tetiklenmesi
 * yeterlidir; anlık borsa değil, kişisel finans takibi.
 */
export const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

/**
 * Verilen `as_of` tarihlerinin en yenisi eşikten eski mi? Boş dizi -> true
 * (henüz hiç fiyat yoksa çekmeyi tetikle).
 */
export function shouldRefresh(
  latestAsOfDates: ReadonlyArray<string | null | undefined>,
): boolean {
  const times = latestAsOfDates
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t));
  if (times.length === 0) return true;
  const newest = Math.max(...times);
  return Date.now() - newest > STALE_THRESHOLD_MS;
}

/** Tek bir tarih eskimiş mi? UI'da stale rozetlerini boyamak için. */
export function isStale(asOf: string | null | undefined): boolean {
  if (!asOf) return true;
  const t = new Date(asOf).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > STALE_THRESHOLD_MS;
}
