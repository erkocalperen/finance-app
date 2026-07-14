import { Skeleton } from "@/components/ui/skeleton";

export default function TransfersLoading() {
  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-5 items-center gap-4 border-b px-4 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="col-span-2 h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
