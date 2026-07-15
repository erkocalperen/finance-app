"use client";

import { useState, useTransition } from "react";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import { deleteTransaction } from "@/app/(dashboard)/transactions/actions";
import type { Currency, EntryType } from "@/lib/constants";
import { ENTRY_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  TransactionFormDialog,
  type FormAccountOption,
  type FormCategoryOption,
} from "./transaction-form-dialog";

export type TransactionRow = {
  id: string;
  kind: "transaction" | "investment" | "debt_payment";
  type: EntryType;
  amount: number;
  currency: Currency;
  fx_rate: number;
  occurred_on: string;
  note: string | null;
  category: {
    id: string;
    name: string;
    color: string;
    type: EntryType;
  };
  account: {
    id: string;
    name: string;
    currency: Currency;
  };
  relatedAccountIds?: string[];
  typeLabel?: string;
  isReadonly?: boolean;
  countsInSummary?: boolean;
};

type Props = {
  transactions: TransactionRow[];
  accounts: FormAccountOption[];
  categories: FormCategoryOption[];
  baseCurrency: Currency;
  emptyKind: "none" | "no-data" | "no-matches";
};

type FormState =
  | { mode: "create" }
  | { mode: "edit"; transaction: TransactionRow };

export function TransactionsManager({
  transactions,
  accounts,
  categories,
  baseCurrency,
  emptyKind,
}: Props) {
  const [formState, setFormState] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<TransactionRow | null>(null);
  const [isDeleting, startDelete] = useTransition();

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    startDelete(async () => {
      const result = await deleteTransaction(target.id);
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
          <h1 className="text-2xl font-semibold tracking-tight">İşlemler</h1>
          <p className="text-muted-foreground text-sm">
            Gelir ve gider hareketlerini yönet, filtrele ve düzenle.
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
        <EmptyNoData
          hasAccounts={accounts.length > 0}
          onCreate={() => setFormState({ mode: "create" })}
        />
      ) : emptyKind === "no-matches" ? (
        <EmptyNoMatches />
      ) : (
        <div className="space-y-4">
          <TransactionTable
            rows={transactions}
            baseCurrency={baseCurrency}
            onEdit={(t) => setFormState({ mode: "edit", transaction: t })}
            onDelete={setToDelete}
          />
          <TransactionCards
            rows={transactions}
            onEdit={(t) => setFormState({ mode: "edit", transaction: t })}
            onDelete={setToDelete}
          />
        </div>
      )}

      <TransactionFormDialog
        open={formState !== null}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        mode={formState?.mode ?? "create"}
        initial={
          formState?.mode === "edit" &&
          formState.transaction.kind === "transaction"
            ? {
                id: formState.transaction.id,
                type: formState.transaction.type,
                account_id: formState.transaction.account.id,
                category_id: formState.transaction.category.id,
                amount: formState.transaction.amount,
                currency: formState.transaction.currency,
                fx_rate: formState.transaction.fx_rate,
                occurred_on: formState.transaction.occurred_on,
                note: formState.transaction.note ?? "",
              }
            : undefined
        }
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
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
                ? `${formatDate(toDelete.occurred_on)} tarihli ${toDelete.category.name} işlemi kalıcı olarak silinecek.`
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

function amountClass(type: EntryType) {
  return type === "income"
    ? "text-income"
    : "text-expense";
}

function amountText(row: TransactionRow) {
  const sign = row.type === "income" ? "+" : "−";
  return `${sign} ${formatCurrency(row.amount, row.currency)}`;
}

function typeLabel(row: TransactionRow) {
  return row.typeLabel ?? ENTRY_TYPE_LABELS[row.type];
}

function TransactionTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: TransactionRow[];
  baseCurrency: Currency;
  onEdit: (t: TransactionRow) => void;
  onDelete: (t: TransactionRow) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Tarih</TableHead>
            <TableHead className="w-32">Tip</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Hesap</TableHead>
            <TableHead>Not</TableHead>
            <TableHead className="text-right">Tutar</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground">
                {formatDate(row.occurred_on)}
              </TableCell>
              <TableCell>
                <TypePill row={row} />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.category.color }}
                  />
                  <span>{row.category.name}</span>
                </span>
              </TableCell>
              <TableCell>{row.account.name}</TableCell>
              <TableCell className="text-muted-foreground max-w-xs truncate">
                {row.note ?? ""}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  amountClass(row.type),
                )}
              >
                {amountText(row)}
              </TableCell>
              <TableCell>
                {row.isReadonly ? null : (
                  <RowMenu
                    onEdit={() => onEdit(row)}
                    onDelete={() => onDelete(row)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TransactionCards({
  rows,
  onEdit,
  onDelete,
}: {
  rows: TransactionRow[];
  onEdit: (t: TransactionRow) => void;
  onDelete: (t: TransactionRow) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border md:hidden">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-3 px-4 py-3">
          <span
            aria-hidden
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.category.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">
                {row.category.name}
              </span>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  amountClass(row.type),
                )}
              >
                {amountText(row)}
              </span>
            </div>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
              <span>{typeLabel(row)}</span>
              <span>·</span>
              <span>{formatDate(row.occurred_on)}</span>
              <span>·</span>
              <span className="truncate">{row.account.name}</span>
            </div>
            {row.note && (
              <div className="text-muted-foreground mt-1 truncate text-xs">
                {row.note}
              </div>
            )}
          </div>
          {row.isReadonly ? null : (
            <RowMenu
              onEdit={() => onEdit(row)}
              onDelete={() => onDelete(row)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function TypePill({ row }: { row: TransactionRow }) {
  const className =
    row.kind === "investment"
      ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300"
      : row.kind === "debt_payment"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        : row.type === "income"
          ? "border-income/30 bg-income/10 text-income"
          : "border-expense/30 bg-expense/10 text-expense";

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium",
        className,
      )}
    >
      {typeLabel(row)}
    </span>
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

function EmptyNoData({
  hasAccounts,
  onCreate,
}: {
  hasAccounts: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
      <div className="bg-muted rounded-full p-3">
        <Receipt className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="text-lg font-medium">Henüz işlem eklemediniz</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        {hasAccounts
          ? "Nakit akışını takip etmek için ilk gelir veya gider hareketinizi ekleyin."
          : "İşlem eklemek için önce Hesaplar sayfasından bir hesap tanımlayın."}
      </p>
      {hasAccounts && (
        <Button className="mt-2" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          İlk işlemini ekle
        </Button>
      )}
    </div>
  );
}

function EmptyNoMatches() {
  return (
    <div className="rounded-lg border border-dashed py-10 text-center">
      <p className="text-muted-foreground text-sm">
        Bu filtrelere uygun işlem yok. Filtre çubuğundaki
        <span className="text-foreground"> Filtreleri temizle</span>{" "}
        seçeneğiyle sıfırlayabilirsiniz.
      </p>
    </div>
  );
}
