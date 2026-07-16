"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { AddStockDialog } from "./add-stock-dialog";
import { ManualPricePopover } from "./manual-price-popover";
import {
  ManualPriceQuickUpdate,
  type ManualPriceItem,
} from "./manual-price-quick-update";
import { RefreshPricesButton } from "./refresh-prices-button";

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
  /** 'bigpara' | 'manual' | ... — latest_instrument_prices.source. */
  priceSource: string | null;
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

const KIND_DOT_CLASS: Record<InstrumentKind, string> = {
  gold: "bg-amber-500",
  silver: "bg-slate-400",
  stock: "bg-sky-500",
};

function pnlToneClass(v: number | null) {
  if (v == null) return "text-muted-foreground";
  if (v > 0) return "text-income";
  if (v < 0) return "text-expense";
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
  const sixHours = 6 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  if (age > 7 * oneDay) return "text-expense";
  if (age > sixHours) return "text-amber-600 dark:text-amber-400";
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

  const manualPriceItems: ManualPriceItem[] = useMemo(
    () =>
      holdings
        .filter((h) => h.quantity > 0 && (h.kind === "gold" || h.kind === "silver"))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "tr"))
        .map((h) => ({
          instrumentId: h.instrumentId,
          name: h.name,
          symbol: h.symbol,
          kind: h.kind,
          currency: h.currency,
          currentPrice: h.currentPrice,
          priceAsOf: h.priceAsOf,
        })),
    [holdings],
  );

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
            Altın, gümüş ve hisse pozisyonlarını takip et. Hisse fiyatları
            otomatik çekilir; altın/gümüş manuel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshPricesButton />
          <AddStockDialog />
          <Button
            onClick={() => setFormState({ mode: "create" })}
            disabled={accounts.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Yeni İşlem
          </Button>
        </div>
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

          <ManualPriceQuickUpdate items={manualPriceItems} />

          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Varlıklar</h2>
            {groupedHoldings.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                Aktif pozisyon yok. Yukarıdan yeni bir alım işlemi ekleyin.
              </div>
            ) : (
              <PositionsList groups={groupedHoldings} />
            )}
          </section>

          <TradesHistoryCollapsible
            rows={trades}
            onEdit={(t) => setFormState({ mode: "edit", trade: t })}
            onDelete={setToDelete}
          />
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

function compactPriceAge(asOf: string | null): string {
  if (!asOf) return "fiyat yok";
  const diff = Date.now() - new Date(asOf).getTime();
  if (!Number.isFinite(diff)) return "";
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}dk`;
  if (diff < day) return `${Math.floor(diff / hour)}sa`;
  return `${Math.floor(diff / day)}g`;
}

function priceSourceLabel(source: string | null): string {
  if (source === "bigpara") return "Bigpara";
  if (source === "manual") return "Manuel";
  return source ?? "";
}

function PositionsList({
  groups,
}: {
  groups: Array<{ kind: InstrumentKind; items: HoldingRow[] }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      {groups.map((group) => (
        <div key={group.kind}>
          <div className="bg-muted/30 text-muted-foreground border-b px-3 py-2 text-[11px] font-medium tracking-[0.12em] uppercase">
            {KIND_LABEL[group.kind]}
          </div>
          <div className="divide-y">
            {group.items.map((h) => (
              <PositionRow key={h.instrumentId} holding={h} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PositionRow({ holding: h }: { holding: HoldingRow }) {
  const source = priceSourceLabel(h.priceSource);
  const age = compactPriceAge(h.priceAsOf);
  const pnlText =
    h.pnl == null
      ? "—"
      : `${h.pnl >= 0 ? "+" : ""}${formatCurrency(h.pnl, h.currency)}`;
  const pnlPctText =
    h.pnlPct == null ? "" : ` · %${Math.abs(h.pnlPct).toFixed(1)}`;

  return (
    <div className="grid gap-2.5 px-3 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 gap-2.5">
        <span
          aria-hidden
          className={cn(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
            KIND_DOT_CLASS[h.kind],
          )}
        />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-1.5">
            <span className="truncate text-sm font-medium">{h.name}</span>
            <span className="text-muted-foreground text-[11px]">{h.symbol}</span>
          </div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px]">
            <span>{formatQuantity(h.quantity, h.unit)}</span>
            <span aria-hidden>·</span>
            <span>ort. {formatCurrency(h.avgCost, h.currency)}</span>
            <span aria-hidden>·</span>
            <span className={cn(h.currentPrice == null && "text-expense")}>
              Güncel {h.currentPrice == null ? "—" : formatCurrency(h.currentPrice, h.currency)}
            </span>
            {source && (
              <>
                <span aria-hidden>·</span>
                <span>{source}</span>
              </>
            )}
            {age && (
              <>
                <span aria-hidden>·</span>
                <span className={cn(priceAgeClass(h.priceAsOf))}>{age}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 border-t pt-2 sm:border-t-0 sm:pt-0 sm:text-right">
        <div className="text-muted-foreground mb-0.5 text-[10px] font-medium tracking-[0.08em] uppercase">
          Pozisyon değeri
        </div>
        {h.marketValue == null ? (
          <div className="flex items-center gap-2 sm:justify-end">
            <span className="font-display text-base font-semibold tabular-nums">—</span>
            <ManualPricePopover
              instrumentId={h.instrumentId}
              instrumentName={h.name}
              currency={h.currency}
              currentPrice={null}
              trigger={
                <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                  Fiyat gir
                </Button>
              }
            />
          </div>
        ) : (
          <div className="font-display text-base font-semibold tabular-nums leading-tight">
            {formatCurrency(h.marketValue, h.currency)}
          </div>
        )}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 text-xs font-medium tabular-nums sm:justify-end",
            pnlToneClass(h.pnl),
          )}
        >
          <span className="text-muted-foreground text-[10px]">K/Z</span>
          <span>
            {pnlText}
            {pnlPctText}
          </span>
        </div>
      </div>
    </div>
  );
}

function TradesHistoryCollapsible({
  rows,
  onEdit,
  onDelete,
}: {
  rows: TradeHistoryRow[];
  onEdit: (t: TradeHistoryRow) => void;
  onDelete: (t: TradeHistoryRow) => void;
}) {
  return (
    <Collapsible>
      <section className="overflow-hidden rounded-xl border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group hover:bg-muted/30 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
          >
            <span className="text-sm font-semibold">
              İşlem Geçmişi ({rows.length})
            </span>
            <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {rows.length === 0 ? (
            <div className="text-muted-foreground border-t p-6 text-center text-sm">
              Henüz kayıt yok.
            </div>
          ) : (
            <div className="border-t">
              <TradesTable rows={rows} onEdit={onEdit} onDelete={onDelete} />
              <TradesCards rows={rows} onEdit={onEdit} onDelete={onDelete} />
            </div>
          )}
        </CollapsibleContent>
      </section>
    </Collapsible>
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
      ? "text-income"
      : tone === "negative"
        ? "text-expense"
        : "";
  return (
    <div className="rounded-xl border p-4">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
        {label}
      </div>
      <div
        className={cn(
          "font-display mt-1 text-2xl font-semibold tabular-nums leading-tight",
          cls,
        )}
      >
        {value}
      </div>
      {subValue && (
        <div className={cn("text-xs tabular-nums", cls)}>{subValue}</div>
      )}
    </div>
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
            <TableRow key={row.id} className="[&>td]:py-2">
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
