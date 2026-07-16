"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  findExistingImportFingerprints,
  importTransactions,
} from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccountType, Currency, EntryType } from "@/lib/constants";
import { ENTRY_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  createImportFingerprint,
  mapTabularRows,
  parsePdfStatement,
  readCsv,
  readExcel,
  type ImportFileKind,
  type ImportPreviewRow,
  type TabularData,
  type TabularMapping,
} from "@/lib/transaction-import";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type AccountOption = {
  id: string;
  name: string;
  currency: Currency;
  type: AccountType;
};

type CategoryOption = {
  id: string;
  name: string;
  type: EntryType;
  color: string;
};

type EditableRow = ImportPreviewRow & {
  included: boolean;
  selected: boolean;
  categoryId: string;
  fingerprint: string | null;
  duplicate: boolean;
};

type Props = {
  accounts: AccountOption[];
  categories: CategoryOption[];
};

const EMPTY_MAPPING: TabularMapping = {
  dateColumn: -1,
  descriptionColumn: -1,
  typeMode: "signed",
  amountColumn: -1,
  debitColumn: -1,
  creditColumn: -1,
  dateFormat: "dmy",
  numberFormat: "tr",
};

function fileKind(file: File): ImportFileKind | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf" || extension === "csv") return extension;
  if (extension === "xlsx" || extension === "xls") return "xlsx";
  return null;
}

function accountTypeLabel(type: AccountType) {
  if (type === "credit_card") return "Kredi kartı";
  if (type === "bank") return "Banka";
  return "Nakit";
}

function guessColumn(headers: string[], terms: string[]) {
  return headers.findIndex((header) => {
    const normalized = header.toLocaleLowerCase("tr-TR");
    return terms.some((term) => normalized.includes(term));
  });
}

function guessedMapping(table: TabularData): TabularMapping {
  const dateColumn = guessColumn(table.headers, ["tarih", "date"]);
  const descriptionColumn = guessColumn(table.headers, ["açıklama", "aciklama", "description", "işlem", "islem"]);
  const amountColumn = guessColumn(table.headers, ["tutar", "amount"]);
  const debitColumn = guessColumn(table.headers, ["borç", "borc", "debit"]);
  const creditColumn = guessColumn(table.headers, ["alacak", "credit"]);
  return {
    ...EMPTY_MAPPING,
    dateColumn,
    descriptionColumn,
    amountColumn,
    debitColumn,
    creditColumn,
    typeMode: debitColumn >= 0 && creditColumn >= 0 ? "debit-credit" : "signed",
  };
}

export function TransactionImportWizard({ accounts, categories }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ImportFileKind | null>(null);
  const [accountId, setAccountId] = useState("");
  const [table, setTable] = useState<TabularData | null>(null);
  const [mapping, setMapping] = useState<TabularMapping>(EMPTY_MAPPING);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [skippedPayments, setSkippedPayments] = useState(0);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isImporting, startImport] = useTransition();

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const readyRows = rows.filter((row) => row.status === "ready");
  const duplicateCount = rows.filter((row) => row.duplicate).length;
  const newCount = readyRows.length - duplicateCount;
  const uncertainCount = rows.filter((row) => row.status === "uncertain").length;
  const includedRows = rows.filter((row) => row.included && !row.duplicate && row.status === "ready");
  const missingCategoryCount = includedRows.filter((row) => !row.categoryId).length;
  const selectedCount = rows.filter((row) => row.selected).length;

  const mappingComplete =
    mapping.dateColumn >= 0 &&
    mapping.descriptionColumn >= 0 &&
    (mapping.typeMode === "signed"
      ? mapping.amountColumn >= 0
      : mapping.debitColumn >= 0 && mapping.creditColumn >= 0);

  function chooseFile(nextFile: File | null) {
    if (!nextFile) return;
    const nextKind = fileKind(nextFile);
    if (!nextKind) {
      toast.error("PDF, CSV veya Excel dosyası seçin.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      toast.error("Dosya boyutu 10 MB'ı geçemez.");
      return;
    }
    setFile(nextFile);
    setKind(nextKind);
    setTable(null);
    setRows([]);
  }

  async function preparePreview(parsedRows: ImportPreviewRow[], paymentCount: number) {
    if (!accountId) return;
    const fingerprints = await Promise.all(
      parsedRows.map(async (row) =>
        row.status === "ready" && row.occurredOn && row.amount
          ? createImportFingerprint({
              occurredOn: row.occurredOn,
              amount: row.amount,
              note: row.note,
              accountId,
            })
          : null,
      ),
    );
    const validFingerprints = fingerprints.filter((value): value is string => Boolean(value));
    const existingResult = await findExistingImportFingerprints(accountId, validFingerprints);
    if (existingResult.error) throw new Error(existingResult.error);
    const existing = new Set(existingResult.fingerprints ?? []);
    setRows(
      parsedRows.map((row, index) => {
        const fingerprint = fingerprints[index];
        const duplicate = fingerprint ? existing.has(fingerprint) : false;
        return {
          ...row,
          fingerprint,
          duplicate,
          included: row.status === "ready" && !duplicate,
          selected: false,
          categoryId: "",
        };
      }),
    );
    setSkippedPayments(paymentCount);
    setStep(3);
  }

  async function continueFromFile() {
    if (!file || !kind || !accountId) return;
    if (selectedAccount?.currency !== "TRY") {
      toast.error("Ekstre importu şu anda yalnızca TRY hesapları destekliyor.");
      return;
    }
    setIsReading(true);
    try {
      if (kind === "pdf") {
        const result = await parsePdfStatement(file);
        await preparePreview(result.rows, result.skippedPayments);
      } else {
        const nextTable = kind === "csv" ? await readCsv(file) : await readExcel(file);
        if (nextTable.headers.length === 0 || nextTable.rows.length === 0) {
          throw new Error("Dosyada eşleştirilecek veri bulunamadı.");
        }
        setTable(nextTable);
        setMapping(guessedMapping(nextTable));
        setStep(2);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dosya okunamadı.");
    } finally {
      setIsReading(false);
    }
  }

  async function continueFromMapping() {
    if (!table || !mappingComplete) return;
    setIsReading(true);
    try {
      await preparePreview(mapTabularRows(table, mapping), 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Önizleme hazırlanamadı.");
    } finally {
      setIsReading(false);
    }
  }

  function updateRow(id: string, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function setRowType(row: EditableRow, type: EntryType) {
    const category = categories.find((item) => item.id === row.categoryId);
    updateRow(row.id, {
      type,
      categoryId: category && category.type !== type ? "" : row.categoryId,
    });
  }

  function applyBulkCategory() {
    const category = categories.find((item) => item.id === bulkCategoryId);
    if (!category) return;
    let applied = 0;
    setRows((current) =>
      current.map((row) => {
        if (!row.selected || row.type !== category.type || row.status !== "ready") return row;
        applied += 1;
        return { ...row, categoryId: category.id };
      }),
    );
    if (applied === 0) toast.info("Kategori tipi seçili satırlarla eşleşmedi.");
    else toast.success(`${applied} satıra kategori atandı.`);
  }

  function confirmImport() {
    if (includedRows.length === 0 || missingCategoryCount > 0) return;
    startImport(async () => {
      const result = await importTransactions(
        includedRows.map((row) => ({
          account_id: accountId,
          category_id: row.categoryId,
          type: row.type,
          amount: row.amount as number,
          occurred_on: row.occurredOn as string,
          note: row.note,
        })),
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.inserted} işlem eklendi, ${result.skipped} atlandı.`);
      router.push("/transactions");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="İşlemlere dön">
          <Link href="/transactions"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-semibold">Ekstre İçe Aktar</h1>
          <p className="text-muted-foreground text-sm">
            PDF, CSV veya Excel ekstresindeki işlemleri kontrol ederek ekleyin.
          </p>
        </div>
      </div>

      <StepIndicator step={step} skipMapping={kind === "pdf"} />

      {step === 1 && (
        <section className="space-y-5 rounded-lg border p-4 sm:p-6">
          <div>
            <h2 className="font-medium">Dosya ve hesap</h2>
            <p className="text-muted-foreground text-sm">Dosya yalnızca bu tarayıcıda okunur; ham ekstre sunucuya gönderilmez.</p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0] ?? null);
            }}
            className="hover:bg-muted/40 focus-visible:ring-ring flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {file ? (
              <>
                {kind === "pdf" ? <FileText className="h-7 w-7" /> : <FileSpreadsheet className="h-7 w-7" />}
                <div><div className="font-medium">{file.name}</div><div className="text-muted-foreground text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB · Değiştirmek için tıklayın</div></div>
              </>
            ) : (
              <>
                <Upload className="text-muted-foreground h-7 w-7" />
                <div><div className="font-medium">Dosyayı sürükleyin veya seçin</div><div className="text-muted-foreground text-xs">PDF, CSV, XLSX · En fazla 10 MB</div></div>
              </>
            )}
          </button>
          <Input ref={inputRef} type="file" accept=".pdf,.csv,.xlsx,.xls" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />

          <div className="max-w-md space-y-1.5">
            <label className="text-sm font-medium">Bu hangi hesabın ekstresi?</label>
            <Select value={accountId || undefined} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Hesap seçin" /></SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id} disabled={account.currency !== "TRY"}>
                    {account.name} · {accountTypeLabel(account.type)} · {account.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accounts.length === 0 && <p className="text-expense text-xs">Önce bir hesap oluşturun.</p>}
          </div>

          <div className="flex justify-end">
            <Button onClick={continueFromFile} disabled={!file || !accountId || isReading}>
              {isReading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              {kind === "pdf" ? "Önizlemeyi hazırla" : "Devam"}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && table && (
        <MappingStep
          table={table}
          mapping={mapping}
          onChange={setMapping}
          onBack={() => setStep(1)}
          onContinue={continueFromMapping}
          canContinue={mappingComplete}
          busy={isReading}
        />
      )}

      {step === 3 && (
        <PreviewStep
          rows={rows}
          categories={categories}
          skippedPayments={skippedPayments}
          newCount={newCount}
          duplicateCount={duplicateCount}
          uncertainCount={uncertainCount}
          selectedCount={selectedCount}
          bulkCategoryId={bulkCategoryId}
          onBulkCategoryChange={setBulkCategoryId}
          onApplyBulkCategory={applyBulkCategory}
          onUpdateRow={updateRow}
          onSetRowType={setRowType}
          onBack={() => setStep(kind === "pdf" ? 1 : 2)}
          onContinue={() => setStep(4)}
          includedCount={includedRows.length}
        />
      )}

      {step === 4 && (
        <section className="space-y-6 rounded-lg border p-4 sm:p-6">
          <div>
            <h2 className="font-display text-xl font-semibold">İçe aktarmayı onayla</h2>
            <p className="text-muted-foreground text-sm">Seçilen işlemler {selectedAccount?.name} hesabına TRY olarak eklenecek.</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
            <SummaryCell label="Eklenecek" value={String(includedRows.length)} />
            <SummaryCell label="Atlanacak tekrar" value={String(duplicateCount)} />
            <SummaryCell label="Toplam tutar" value={formatCurrency(includedRows.reduce((sum, row) => sum + (row.amount ?? 0), 0), "TRY")} />
          </div>
          {missingCategoryCount > 0 && <p className="text-expense text-sm">{missingCategoryCount} dahil satır için kategori seçilmedi.</p>}
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(3)} disabled={isImporting}><ArrowLeft className="mr-2 h-4 w-4" />Önizlemeye dön</Button>
            <Button onClick={confirmImport} disabled={isImporting || includedRows.length === 0 || missingCategoryCount > 0}>
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {includedRows.length} işlemi içe aktar
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function StepIndicator({ step, skipMapping }: { step: number; skipMapping: boolean }) {
  const items = ["Dosya", "Eşleştirme", "Önizleme", "Onay"];
  return (
    <ol className="grid grid-cols-4 border-y">
      {items.map((label, index) => {
        const number = index + 1;
        const skipped = skipMapping && number === 2;
        const active = step === number;
        const complete = step > number || (skipMapping && step > 1 && number === 2);
        return (
          <li key={label} className={cn("flex min-w-0 items-center gap-2 px-2 py-3 text-xs sm:px-4 sm:text-sm", active && "text-foreground", !active && "text-muted-foreground")}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs", (active || complete) && "border-primary bg-primary text-primary-foreground")}>
              {complete ? <Check className="h-3.5 w-3.5" /> : number}
            </span>
            <span className="truncate">{label}{skipped ? " (otomatik)" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ColumnSelect({ label, value, headers, onChange }: { label: string; value: number; headers: string[]; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value >= 0 ? String(value) : undefined} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger><SelectValue placeholder="Sütun seçin" /></SelectTrigger>
        <SelectContent>{headers.map((header, index) => <SelectItem key={`${header}-${index}`} value={String(index)}>{header}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function MappingStep({ table, mapping, onChange, onBack, onContinue, canContinue, busy }: { table: TabularData; mapping: TabularMapping; onChange: (mapping: TabularMapping) => void; onBack: () => void; onContinue: () => void; canContinue: boolean; busy: boolean }) {
  return (
    <section className="space-y-6 rounded-lg border p-4 sm:p-6">
      <div><h2 className="font-medium">Sütunları eşleştir</h2><p className="text-muted-foreground text-sm">İlk satır başlık kabul edildi. Dosyanızdaki alanları işlem alanlarıyla eşleştirin.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ColumnSelect label="Tarih sütunu" value={mapping.dateColumn} headers={table.headers} onChange={(value) => onChange({ ...mapping, dateColumn: value })} />
        <ColumnSelect label="Açıklama sütunu" value={mapping.descriptionColumn} headers={table.headers} onChange={(value) => onChange({ ...mapping, descriptionColumn: value })} />
        <div className="space-y-1.5"><label className="text-sm font-medium">Tip yöntemi</label><Select value={mapping.typeMode} onValueChange={(value) => onChange({ ...mapping, typeMode: value as TabularMapping["typeMode"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="signed">Negatif = gider</SelectItem><SelectItem value="debit-credit">Ayrı Borç / Alacak</SelectItem></SelectContent></Select></div>
        {mapping.typeMode === "signed" ? (
          <ColumnSelect label="Tutar sütunu" value={mapping.amountColumn} headers={table.headers} onChange={(value) => onChange({ ...mapping, amountColumn: value })} />
        ) : (
          <><ColumnSelect label="Borç sütunu" value={mapping.debitColumn} headers={table.headers} onChange={(value) => onChange({ ...mapping, debitColumn: value })} /><ColumnSelect label="Alacak sütunu" value={mapping.creditColumn} headers={table.headers} onChange={(value) => onChange({ ...mapping, creditColumn: value })} /></>
        )}
        <div className="space-y-1.5"><label className="text-sm font-medium">Tarih formatı</label><Select value={mapping.dateFormat} onValueChange={(value) => onChange({ ...mapping, dateFormat: value as TabularMapping["dateFormat"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dmy">GG/AA/YYYY</SelectItem><SelectItem value="mdy">AA/GG/YYYY</SelectItem><SelectItem value="ymd">YYYY/AA/GG</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><label className="text-sm font-medium">Sayı formatı</label><Select value={mapping.numberFormat} onValueChange={(value) => onChange({ ...mapping, numberFormat: value as TabularMapping["numberFormat"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tr">Türkçe (1.234,56)</SelectItem><SelectItem value="en">İngilizce (1,234.56)</SelectItem></SelectContent></Select></div>
      </div>
      <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>{table.headers.map((header, index) => <TableHead key={`${header}-${index}`} className="whitespace-nowrap">{header}</TableHead>)}</TableRow></TableHeader><TableBody>{table.rows.slice(0, 4).map((row, rowIndex) => <TableRow key={rowIndex}>{table.headers.map((_, columnIndex) => <TableCell key={columnIndex} className="max-w-56 truncate whitespace-nowrap">{row[columnIndex]}</TableCell>)}</TableRow>)}</TableBody></Table></div>
      <div className="flex justify-between"><Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Geri</Button><Button onClick={onContinue} disabled={!canContinue || busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}Önizle</Button></div>
    </section>
  );
}

function PreviewStep({ rows, categories, skippedPayments, newCount, duplicateCount, uncertainCount, selectedCount, bulkCategoryId, onBulkCategoryChange, onApplyBulkCategory, onUpdateRow, onSetRowType, onBack, onContinue, includedCount }: { rows: EditableRow[]; categories: CategoryOption[]; skippedPayments: number; newCount: number; duplicateCount: number; uncertainCount: number; selectedCount: number; bulkCategoryId: string; onBulkCategoryChange: (value: string) => void; onApplyBulkCategory: () => void; onUpdateRow: (id: string, patch: Partial<EditableRow>) => void; onSetRowType: (row: EditableRow, type: EntryType) => void; onBack: () => void; onContinue: () => void; includedCount: number }) {
  const selectableRows = rows.filter((row) => row.status === "ready" && !row.duplicate);
  const allSelectableSelected = selectableRows.length > 0 && selectableRows.every((row) => row.selected);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-medium">İşlemleri kontrol et</h2><p className="text-muted-foreground text-sm">{rows.length + skippedPayments} işlem bulundu · {newCount} yeni · {duplicateCount} zaten var · {skippedPayments} ödeme atlandı{uncertainCount > 0 ? ` · ${uncertainCount} belirsiz` : ""}</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 space-y-1"><label className="text-muted-foreground text-xs">Seçililere kategori</label><Select value={bulkCategoryId || undefined} onValueChange={onBulkCategoryChange}><SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name} · {ENTRY_TYPE_LABELS[category.type]}</span></SelectItem>)}</SelectContent></Select></div>
          <Button variant="outline" onClick={onApplyBulkCategory} disabled={!bulkCategoryId || selectedCount === 0}>Uygula ({selectedCount})</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[1050px]">
          <TableHeader><TableRow><TableHead className="w-10"><input aria-label="Tüm satırları seç" type="checkbox" checked={allSelectableSelected} onChange={(event) => selectableRows.forEach((row) => onUpdateRow(row.id, { selected: event.target.checked }))} className="accent-primary h-4 w-4" /></TableHead><TableHead className="w-28">Tarih</TableHead><TableHead>Açıklama</TableHead><TableHead className="text-right">Tutar</TableHead><TableHead className="w-32">Tip</TableHead><TableHead className="w-52">Kategori</TableHead><TableHead className="w-28">Durum</TableHead><TableHead className="w-16 text-center">Dahil</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((row) => {
            const rowCategories = categories.filter((category) => category.type === row.type);
            const disabled = row.status !== "ready" || row.duplicate;
            return <TableRow key={row.id} className={cn(disabled && "bg-muted/25 text-muted-foreground")}><TableCell><input aria-label="Toplu işlem için seç" type="checkbox" checked={row.selected} disabled={disabled} onChange={(event) => onUpdateRow(row.id, { selected: event.target.checked })} className="accent-primary h-4 w-4" /></TableCell><TableCell className="whitespace-nowrap">{row.occurredOn ? formatDate(row.occurredOn) : "—"}</TableCell><TableCell><div className="max-w-md truncate" title={row.note || row.raw}>{row.note || row.raw || "—"}</div>{row.statusMessage && <div className="text-expense text-xs">{row.statusMessage}</div>}</TableCell><TableCell className="text-right font-medium tabular-nums">{row.amount ? formatCurrency(row.amount, "TRY") : "—"}</TableCell><TableCell><Select value={row.type} disabled={row.status !== "ready"} onValueChange={(value) => onSetRowType(row, value as EntryType)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Gider</SelectItem><SelectItem value="income">Gelir</SelectItem></SelectContent></Select></TableCell><TableCell><Select value={row.categoryId || undefined} disabled={row.status !== "ready"} onValueChange={(value) => onUpdateRow(row.id, { categoryId: value })}><SelectTrigger className="h-8"><SelectValue placeholder="Kategori seç" /></SelectTrigger><SelectContent>{rowCategories.map((category) => <SelectItem key={category.id} value={category.id}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span></SelectItem>)}</SelectContent></Select></TableCell><TableCell><StatusLabel row={row} /></TableCell><TableCell className="text-center"><input aria-label="İçe aktarmaya dahil et" type="checkbox" checked={row.included} disabled={disabled} onChange={(event) => onUpdateRow(row.id, { included: event.target.checked })} className="accent-primary h-4 w-4" /></TableCell></TableRow>;
          })}</TableBody>
        </Table>
      </div>
      <div className="flex justify-between gap-3"><Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Geri</Button><Button onClick={onContinue} disabled={includedCount === 0}>{includedCount} işlemle devam et<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
    </section>
  );
}

function StatusLabel({ row }: { row: EditableRow }) {
  if (row.duplicate) return <span className="text-amber-600 dark:text-amber-400">Zaten var</span>;
  if (row.status === "uncertain") return <span className="text-expense">Belirsiz</span>;
  return <span className="text-income">Yeni</span>;
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return <div className="bg-background p-4"><div className="text-muted-foreground text-xs">{label}</div><div className="font-display mt-1 text-xl font-semibold tabular-nums">{value}</div></div>;
}
