"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  ACCOUNT_TYPE_LABELS,
  type AccountType,
  type Currency,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  deleteAccount,
  setAccountArchived,
} from "@/app/(dashboard)/accounts/actions";
import { AccountFormDialog } from "./account-form-dialog";

export type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  initial_balance: number;
  is_archived: boolean;
  balance: number;
};

type FormState =
  | { mode: "create" }
  | { mode: "edit"; account: AccountRow };

export function AccountsManager({ accounts }: { accounts: AccountRow[] }) {
  const [formState, setFormState] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<AccountRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [isArchiving, startArchive] = useTransition();

  const visible = useMemo(() => {
    const list = showArchived
      ? accounts
      : accounts.filter((a) => !a.is_archived);
    return list
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [accounts, showArchived]);

  const archivedCount = accounts.filter((a) => a.is_archived).length;

  function toggleArchived(account: AccountRow) {
    startArchive(async () => {
      const result = await setAccountArchived(
        account.id,
        !account.is_archived,
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        account.is_archived ? "Hesap arşivden çıkarıldı." : "Hesap arşivlendi.",
      );
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    startDelete(async () => {
      const result = await deleteAccount(target.id);
      if (result?.error) {
        toast.error(result.error);
        setToDelete(null);
        return;
      }
      toast.success("Hesap silindi.");
      setToDelete(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hesaplar</h1>
          <p className="text-muted-foreground text-sm">
            Nakit, banka ve kredi kartı hesaplarını yönet.
          </p>
        </div>
        <Button onClick={() => setFormState({ mode: "create" })}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Hesap
        </Button>
      </div>

      {archivedCount > 0 && (
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="text-sm">
            Arşivi göster ({archivedCount})
          </Label>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState onCreate={() => setFormState({ mode: "create" })} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => setFormState({ mode: "edit", account })}
              onDelete={() => setToDelete(account)}
              onToggleArchive={() => toggleArchived(account)}
              archiveDisabled={isArchiving}
            />
          ))}
        </div>
      )}

      <AccountFormDialog
        open={formState !== null}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        mode={formState?.mode ?? "create"}
        initial={
          formState?.mode === "edit"
            ? {
                id: formState.account.id,
                name: formState.account.name,
                type: formState.account.type,
                currency: formState.account.currency,
                initial_balance: formState.account.initial_balance,
              }
            : undefined
        }
      />

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hesabı sil?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{toDelete?.name}</span>{" "}
              hesabı kalıcı olarak silinecek. Bu işlem geri alınamaz.
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
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onDelete,
  onToggleArchive,
  archiveDisabled,
}: {
  account: AccountRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
  archiveDisabled: boolean;
}) {
  return (
    <Card className={account.is_archived ? "opacity-70" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{account.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {ACCOUNT_TYPE_LABELS[account.type]}
            </Badge>
            {account.is_archived && (
              <Badge variant="outline">Arşiv</Badge>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${account.name} işlemleri`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onToggleArchive}
              disabled={archiveDisabled}
            >
              {account.is_archived ? (
                <>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Arşivden çıkar
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Arşivle
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">
          {formatCurrency(account.balance, account.currency)}
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground text-xs">
        Başlangıç: {formatCurrency(account.initial_balance, account.currency)}
      </CardFooter>
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
      <div className="bg-muted rounded-full p-3">
        <Wallet className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="text-lg font-medium">Henüz hesap eklemediniz</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        İşlem eklemeye başlamadan önce en az bir hesap (nakit, banka veya
        kredi kartı) tanımlayın.
      </p>
      <Button onClick={onCreate} className="mt-2">
        <Plus className="mr-2 h-4 w-4" />
        İlk hesabını ekle
      </Button>
    </div>
  );
}
