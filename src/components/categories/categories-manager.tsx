"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/constants";
import { deleteCategory } from "@/app/(dashboard)/categories/actions";
import { CategoryFormDialog } from "./category-form-dialog";

type Category = {
  id: string;
  name: string;
  type: EntryType;
  color: string;
};

type Props = {
  categories: Category[];
};

type FormState =
  | { mode: "create"; defaultType: EntryType }
  | { mode: "edit"; category: Category };

export function CategoriesManager({ categories }: Props) {
  const [tab, setTab] = useState<EntryType>("expense");
  const [formState, setFormState] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const expenses = categories
    .filter((c) => c.type === "expense")
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const incomes = categories
    .filter((c) => c.type === "income")
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  function openCreate() {
    setFormState({ mode: "create", defaultType: tab });
  }

  function openEdit(category: Category) {
    setFormState({ mode: "edit", category });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    startDelete(async () => {
      const result = await deleteCategory(target.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Kategori silindi.");
      setToDelete(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kategoriler
          </h1>
          <p className="text-muted-foreground text-sm">
            Gelir ve gider işlemlerini gruplamak için kategori tanımla.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Kategori
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as EntryType)}>
        <TabsList>
          <TabsTrigger value="expense">
            {ENTRY_TYPE_LABELS.expense} ({expenses.length})
          </TabsTrigger>
          <TabsTrigger value="income">
            {ENTRY_TYPE_LABELS.income} ({incomes.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expense">
          <CategoryList
            items={expenses}
            onEdit={openEdit}
            onDelete={setToDelete}
          />
        </TabsContent>
        <TabsContent value="income">
          <CategoryList
            items={incomes}
            onEdit={openEdit}
            onDelete={setToDelete}
          />
        </TabsContent>
      </Tabs>

      <CategoryFormDialog
        open={formState !== null}
        onOpenChange={(open) => {
          if (!open) setFormState(null);
        }}
        mode={formState?.mode ?? "create"}
        initial={
          formState?.mode === "edit"
            ? {
                id: formState.category.id,
                name: formState.category.name,
                type: formState.category.type,
                color: formState.category.color,
              }
            : undefined
        }
        defaultType={
          formState?.mode === "create" ? formState.defaultType : undefined
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
            <AlertDialogTitle>Kategoriyi sil?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{toDelete?.name}</span>{" "}
              kategorisi kalıcı olarak silinecek. Bu işlem geri alınamaz.
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

function CategoryList({
  items,
  onEdit,
  onDelete,
}: {
  items: Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        Bu tipte kategori yok. Yeni bir kategori ekleyerek başlayın.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {items.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            <span className="font-medium">{c.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(c)}
              aria-label={`${c.name} kategorisini düzenle`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(c)}
              aria-label={`${c.name} kategorisini sil`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
