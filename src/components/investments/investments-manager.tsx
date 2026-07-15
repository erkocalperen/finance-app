"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteTrade } from "@/app/(dashboard)/investments/actions";
import type { Currency } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  InstrumentKind,
  TradeSide,
} from "@/types/database-investments";
import {
  TradeFormDialog,
  type TradeAccountOption,
  type TradeInstrumentOption,
} from "./trade-form-dialog";
import { ManualPricePopover } from "./manual-price-popover";

export type HoldingRow = {
  instrumentId: string;
  symbol: string;
  name: string;
  kind: InstrumentKind;
  unit: string;
  currency: Currency;
  quantity: number;
  avgCost: number;
  totalCost: number;
  currentPrice: number | null;
  priceAsOf: string | null;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
};

export type TradeHistoryRow = {
  id: string;
  side: TradeSide;
  quantity: number;
  unitPrice: number;
  fee: number;
  countsAsCashFlow: boolean;
  occurredOn: string;
  note: string | null;
  instrument: {
    id: string;
    name: string;
    symbol: string;
    unit: string;
    currency: Currency;
    kind: InstrumentKind;
  };
  account: {
    id: string;
    name: string;
    currency: Currency;
  };
};

type Props = {
  holdings: HoldingRow[];
  trades: TradeHistoryRow[];
  instruments: TradeInstrumentOption[];
  accounts: TradeAccountOption[];
  baseCurrency: Currency;
  emptyKind: "none" | "no-data";
};

type FormState =
  | { mode: "create" }
  | { mode: "edit"; trade: TradeHistoryRow };

const KIND_ORDER: InstrumentKind[] = ["gold", "silver", "stock"];
const KIND_LABEL: Record<InstrumentKind, string> = {
  gold: "Altın",
  silver: "Gümüş",
  stock: "Hisse",
};

function pnlToneClass(v: number | null) {
  if (v == null) return "text-muted-foreground";
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-rose-600 dark:text-rose-400";
  return "";
}

function formatQuantity(n: number, unit: string): string {
  return `${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 6,
  }).format(n)} ${unit}`;
}

function priceAgeClass(asOf: string | null): string {
  if (!asOf) return "";
  const age = Date.now() - new Date(asOf).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  if (age > 7 * oneDay) return "text-rose-600 dark:text-rose-400";
  if (age > oneDay) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function InvestmentsManager({
  holdings,
  trades,
  instruments,
  accounts,
  baseCurrency,
  emptyKind,
}: Props) {
  const [formState, setFormState] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<TradeHistoryRow | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const missingPriceCount = holdings.filter(
    (h) => h.currentPrice == null,
  ).length;

  // Toplam maliyet ve değer sadece base_currency'deki pozisyonlar üzerinden
  // — farklı para birimlerini uydurma kurla toplamıyoruz.
  const baseHoldings = holdings.filter((h) => h.currency === baseCurrency);
  const totalCost = baseHoldings.reduce((s, h) => s + h.totalCost, 0);
  const marketValue = baseHoldings.reduce(
    (s, h) => s + (h.marketValue ?? 0),
    0,
  );
  const pricedMarketValue = baseHoldings
    .filter((h) => h.marketValue != null)
    .reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const pricedCost = baseHoldings
    .filter((h) => h.marketValue != null)
    .reduce((s, h) => s + h.totalCost, 0);
  const pnlAbs =
    baseHoldings.some((h) => h.marketValue != null)
      ? pricedMarketValue - pricedCost
      : null;
  const pnlPct =
    pnlAbs != null && pricedCost > 0 ? (pnlAbs / pricedCost) * 100 : null;

  const groupedHoldings = useMemo(() => {
    const groups = new Map<InstrumentKind, HoldingRow[]>();
    for (const h of holdings) {
      const list = groups.get(h.kind) ?? [];
      list.push(h);
      groups.set(h.kind, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    }
    return KIND_ORDER.filter((k) => groups.has(k)).map((k) => ({
      kind: k,
      items: groups.get(k) ?? [],
    }));
  }, [holdings]);

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    startDelete(async () => {
      const result = await deleteTrade(target.id);
      if (result?.error) {
        toast.error(result.error);
        setToDelete(null);
        return;
      }
      toast.success("İşlem silindi.");
      setToDelete(null);
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Yatırımlar</h1>
          <p className="text-muted-foreground text-sm">
            Altın, gümüş ve hisse pozisyonlarını takip et. Fiyatlar manuel
            girilir; gelir/gider raporlarına dahil olmaz.
          </p>
        </div>
        <Button
          onClick={() => setFormState({ mode: "create" })}
          disabled={accounts.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Yeni İşlem
        </Button>
      </div>

      {emptyKind === "no-data" ? (
        <EmptyState
          canCreate={accounts.length > 0}
          onCreate={() => setFormState({ mode: "create" })}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              label="Toplam Maliyet"
              value={formatCurrency(totalCost, baseCurrency)}
            />
            <SummaryTile
              label="Güncel Değer"
              value={
                pnlAbs == null
                  ? "—"
                  : formatCurrency(marketValue, baseCurrency)
              }
            />
            <SummaryTile
              label="Kâr / Zarar"
              value={
                pnlAbs == null
                  ? "—"
                  : formatCurrency(pnlAbs, baseCurrency)
              }
              subValue={
                pnlPct == null
                  ? undefined
                  : `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`
              }
              tone={pnlAbs == null ? "neutral" : pnlAbs >= 0 ? "positive" : "negative"}
            />
          </div>

          {missingPriceCount > 0 && (
            <div className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-start gap-2 rounded-md border p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {missingPriceCount} enstrümanın güncel fiyatı yok. Değerler
                eksik hesaplanıyor — tablodan fiyat girebilirsiniz.
              </span>
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Varlıklar</h2>
            {groupedHoldings.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                Aktif pozisyon yok. Yukarıdan yeni bir alım işlemi ekleyin.
              </div>
            ) : (
              <div className="space-y-6">
                {groupedHoldings.map((group) => (
                  <div key={group.kind} className="space-y-2">
                    <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {KIND_LABEL[group.kind]}
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Enstrüman</TableHead>
                            <TableHead className="text-right">Miktar</TableHead>
                            <TableHead className="text-right">Ort. Maliyet</TableHead>
                            <TableHead className="text-right">Güncel Fiyat</TableHead>
                            <TableHead className="text-right">Değer</TableHead>
                            <TableHead className="text-right">K/Z</TableHead>
                            <TableHead className="text-right">K/Z %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.items.map((h) => (
                            <TableRow key={h.instrumentId}>
                              <TableCell>
                                <div className="font-medium">{h.name}</div>
                                <div className="text-muted-foreground text-xs">
                                  {h.symbol}
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatQuantity(h.quantity, h.unit)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(h.avgCost, h.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                <PriceCell h={h} />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {h.marketValue == null
                                  ? "—"
                                  : formatCurrency(h.marketValue, h.currency)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums",
                                  pnlToneClass(h.pnl),
                                )}
                              >
                                {h.pnl == null
                                  ? "—"
                                  : formatCurrency(h.pnl, h.currency)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums",
                                  pnlToneClass(h.pnlPct),
                                )}
                              >
                                {h.pnlPct == null
                                  ? "—"
                                  : `${h.pnlPct >= 0 ? "+" : ""}${h.pnlPct.toFixed(2)}%`}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">İşlem geçmişi</h2>
            {trades.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                Henüz kayıt yok.
              </div>
            ) : (
              <>
                <TradesTable
                  rows={trades}
                  onEdit={(t) => setFormState({ mode: "edit", trade: t })}
                  onDelete={setToDelete}
                />
                <TradesCards
                  rows={trades}
                  onEdit={(t) => setFormState({ mode: "edit", trade: t })}
                  onDelete={setToDelete}
                />
              </>
            )}
          </section>
        </div>
      )}

      <TradeFormDialog
        open={formState !== null}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        mode={formState?.mode ?? "create"}
        initial={
          formState?.mode === "edit"
            ? {
                id: formState.trade.id,
                instrument_id: formState.trade.instrument.id,
                account_id: formState.trade.account.id,
                side: formState.trade.side,
                quantity: formState.trade.quantity,
                unit_price: formState.trade.unitPrice,
                fee: formState.trade.fee,
                counts_as_cash_flow: formState.trade.countsAsCashFlow,
                occurred_on: formState.trade.occurredOn,
                note: formState.trade.note ?? "",
              }
            : undefined
        }
        instruments={instruments}
        accounts={accounts}
      />

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşlemi sil?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `${formatDate(toDelete.occurredOn)} tarihli ${toDelete.instrument.name} ${toDelete.side === "buy" ? "alım" : "satım"} işlemi kalıcı olarak silinecek.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryTile({
  label,
  value,
  subValue,
  tone = "neutral",
}: {
  label: string;
  value: string;
  subValue?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const cls =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "";
  return (
    <div className="rounded-lg border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", cls)}>
        {value}
      </div>
      {subValue && (
        <div className={cn("text-xs tabular-nums", cls)}>{subValue}</div>
      )}
    </div>
  );
}

function PriceCell({ h }: { h: HoldingRow }) {
  if (h.currentPrice == null) {
    return (
      <ManualPricePopover
        instrumentId={h.instrumentId}
        instrumentName={h.name}
        currency={h.currency}
        currentPrice={null}
        trigger={
          <Button variant="outline" size="sm" className="h-7">
            <Sparkles className="mr-1 h-3 w-3" />
            Fiyat gir
          </Button>
        }
      />
    );
  }
  return (
    <ManualPricePopover
      instrumentId={h.instrumentId}
      instrumentName={h.name}
      currency={h.currency}
      currentPrice={h.currentPrice}
      trigger={
        <button
          type="button"
          className="hover:bg-accent inline-flex flex-col items-end rounded px-2 py-0.5 text-right transition-colors"
        >
          <span className="tabular-nums">
            {formatCurrency(h.currentPrice, h.currency)}
          </span>
          {h.priceAsOf && (
            <span className={cn("text-[10px]", priceAgeClass(h.priceAsOf))}>
              {formatDistanceToNow(new Date(h.priceAsOf), {
                locale: tr,
                addSuffix: true,
              })}
            </span>
          )}
        </button>
      }
    />
  );
}

function tradeTotal(row: TradeHistoryRow): number {
  const gross = row.quantity * row.unitPrice;
  return row.side === "buy" ? gross + row.fee : gross - row.fee;
}

function sideBadge(side: TradeSide) {
  if (side === "buy") {
    return (
      <Badge variant="secondary" className="gap-1">
        <ArrowUp className="h-3 w-3" />
        Al
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <ArrowDown className="h-3 w-3" />
      Sat
    </Badge>
  );
}

function ReportBadge({ row }: { row: TradeHistoryRow }) {
  if (row.countsAsCashFlow) return null;
  return (
    <Badge variant="outline" className="border-slate-300 text-slate-600">
      Rapor dışı
    </Badge>
  );
}

function TradesTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: TradeHistoryRow[];
  onEdit: (t: TradeHistoryRow) => void;
  onDelete: (t: TradeHistoryRow) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Tarih</TableHead>
            <TableHead>Enstrüman</TableHead>
            <TableHead className="w-20">Yön</TableHead>
            <TableHead className="text-right">Miktar</TableHead>
            <TableHead className="text-right">Birim Fiyat</TableHead>
            <TableHead className="text-right">Toplam</TableHead>
            <TableHead>Hesap</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground">
                {formatDate(row.occurredOn)}
              </TableCell>
              <TableCell>
                <div className="font-medium">{row.instrument.name}</div>
                <div className="text-muted-foreground text-xs">
                  {row.instrument.symbol}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  {sideBadge(row.side)}
                  <ReportBadge row={row} />
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatQuantity(row.quantity, row.instrument.unit)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.unitPrice, row.instrument.currency)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCurrency(tradeTotal(row), row.instrument.currency)}
              </TableCell>
              <TableCell>{row.account.name}</TableCell>
              <TableCell>
                <RowMenu
                  onEdit={() => onEdit(row)}
                  onDelete={() => onDelete(row)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TradesCards({
  rows,
  onEdit,
  onDelete,
}: {
  rows: TradeHistoryRow[];
  onEdit: (t: TradeHistoryRow) => void;
  onDelete: (t: TradeHistoryRow) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border md:hidden">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-3 px-4 py-3">
          <div className="bg-muted mt-0.5 rounded-full p-1.5">
            <TrendingUp className="text-muted-foreground h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">
                {row.instrument.name}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatCurrency(tradeTotal(row), row.instrument.currency)}
              </span>
            </div>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
              {sideBadge(row.side)}
              <ReportBadge row={row} />
              <span className="tabular-nums">
                {formatQuantity(row.quantity, row.instrument.unit)}
              </span>
              <span>·</span>
              <span>{formatDate(row.occurredOn)}</span>
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {row.account.name}
            </div>
          </div>
          <RowMenu
            onEdit={() => onEdit(row)}
            onDelete={() => onDelete(row)}
          />
        </li>
      ))}
    </ul>
  );
}

function RowMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="İşlem menüsü">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Düzenle
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Sil
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
      <div className="bg-muted rounded-full p-3">
        <TrendingUp className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="text-lg font-medium">Henüz yatırım kaydınız yok</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        {canCreate
          ? "Altın, gümüş veya hisse alımınızı ekleyerek portföyünüzü takip etmeye başlayın."
          : "Yatırım için önce Hesaplar sayfasından bir hesap tanımlayın."}
      </p>
      {canCreate && (
        <Button className="mt-2" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          İlk yatırımını ekle
        </Button>
      )}
    </div>
  );
}
