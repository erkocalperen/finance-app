import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-32" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-9 w-36" />
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 items-center gap-4 border-b px-4 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
