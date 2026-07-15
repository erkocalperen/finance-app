"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
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
import { deleteTransfer } from "@/app/(dashboard)/transfers/actions";
import type { Currency } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  TransferFormDialog,
  type TransferAccountOption,
} from "./transfer-form-dialog";

export type TransferRow = {
  id: string;
  amount: number;
  currency: Currency;
  received_amount: number;
  counts_as_expense: boolean;
  occurred_on: string;
  note: string | null;
  fromAccount: { id: string; name: string; currency: Currency };
  toAccount: { id: string; name: string; currency: Currency };
};

type Props = {
  transfers: TransferRow[];
  accounts: TransferAccountOption[];
  emptyKind: "none" | "no-data";
};

type FormState =
  | { mode: "create" }
  | { mode: "edit"; transfer: TransferRow };

export function TransfersManager({
  transfers,
  accounts,
  emptyKind,
}: Props) {
  const [formState, setFormState] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<TransferRow | null>(null);
  const [isDeleting, startDelete] = useTransition();

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    startDelete(async () => {
      const result = await deleteTransfer(target.id);
      if (result?.error) {
        toast.error(result.error);
        setToDelete(null);
        return;
      }
      toast.success("Transfer silindi.");
      setToDelete(null);
    });
  }

  const canCreate = accounts.length >= 2;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transferler</h1>
          <p className="text-muted-foreground text-sm">
            Hesaplar arası para hareketleri — gelir/gider raporlarına dahil değildir.
          </p>
        </div>
        <Button
          onClick={() => setFormState({ mode: "create" })}
          disabled={!canCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Yeni Transfer
        </Button>
      </div>

      {emptyKind === "no-data" ? (
        <EmptyState canCreate={canCreate} onCreate={() => setFormState({ mode: "create" })} />
      ) : (
        <div className="space-y-4">
          <TransfersTable
            rows={transfers}
            onEdit={(t) => setFormState({ mode: "edit", transfer: t })}
            onDelete={setToDelete}
          />
          <TransfersCards
            rows={transfers}
            onEdit={(t) => setFormState({ mode: "edit", transfer: t })}
            onDelete={setToDelete}
          />
        </div>
      )}

      <TransferFormDialog
        open={formState !== null}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        mode={formState?.mode ?? "create"}
        initial={
          formState?.mode === "edit"
            ? {
                id: formState.transfer.id,
                from_account_id: formState.transfer.fromAccount.id,
                to_account_id: formState.transfer.toAccount.id,
                amount: formState.transfer.amount,
                received_amount: formState.transfer.received_amount,
                counts_as_expense: formState.transfer.counts_as_expense,
                occurred_on: formState.transfer.occurred_on,
                note: formState.transfer.note ?? "",
              }
            : undefined
        }
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
            <AlertDialogTitle>Transferi sil?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `${formatDate(toDelete.occurred_on)} tarihli ${toDelete.fromAccount.name} → ${toDelete.toAccount.name} transferi silinecek.`
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

function amountText(row: TransferRow) {
  const sent = formatCurrency(row.amount, row.currency);
  if (row.fromAccount.currency === row.toAccount.currency) return sent;
  const received = formatCurrency(row.received_amount, row.toAccount.currency);
  return `${sent} → ${received}`;
}

function DirectionCell({ row }: { row: TransferRow }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate">{row.fromAccount.name}</span>
      <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{row.toAccount.name}</span>
    </span>
  );
}

function TransfersTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: TransferRow[];
  onEdit: (t: TransferRow) => void;
  onDelete: (t: TransferRow) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Tarih</TableHead>
            <TableHead>Aktarım</TableHead>
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
                <div className="space-y-1">
                  <DirectionCell row={row} />
                  {row.counts_as_expense && <ExpenseBadge />}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground max-w-xs truncate">
                {row.note ?? ""}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {amountText(row)}
              </TableCell>
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

function TransfersCards({
  rows,
  onEdit,
  onDelete,
}: {
  rows: TransferRow[];
  onEdit: (t: TransferRow) => void;
  onDelete: (t: TransferRow) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border md:hidden">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start gap-3 px-4 py-3">
          <div className="bg-muted mt-0.5 rounded-full p-1.5">
            <Repeat className="text-muted-foreground h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1">
                <DirectionCell row={row} />
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {amountText(row)}
              </span>
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {formatDate(row.occurred_on)}
            </div>
            {row.counts_as_expense && (
              <div className="mt-1">
                <ExpenseBadge />
              </div>
            )}
            {row.note && (
              <div className="text-muted-foreground mt-1 truncate text-xs">
                {row.note}
              </div>
            )}
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

function ExpenseBadge() {
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-expense/30 bg-expense/10 px-2 text-xs font-medium text-expense">
      Gider sayılır
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
        <Button variant="ghost" size="icon" aria-label="Transfer menüsü">
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
        <Repeat className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="text-lg font-medium">Henüz transfer yok</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        {canCreate
          ? "Hesaplar arası ilk transferini oluştur."
          : "Transfer için en az iki aktif hesap gerekli. Önce Hesaplar sayfasından hesap ekle."}
      </p>
      {canCreate && (
        <Button className="mt-2" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          İlk transferini oluştur
        </Button>
      )}
    </div>
  );
}
