import { Skeleton } from "@/components/ui/skeleton";

export default function InvestmentsLoading() {
  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-32" />
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, g) => (
            <div key={g} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <div className="overflow-hidden rounded-lg border">
                <div className="border-b bg-muted/40 px-4 py-3">
                  <Skeleton className="h-4 w-full max-w-md" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-6 items-center gap-4 border-b px-4 py-3 last:border-0"
                  >
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="ml-auto h-4 w-20" />
                    <Skeleton className="ml-auto h-4 w-24" />
                    <Skeleton className="ml-auto h-4 w-24" />
                    <Skeleton className="ml-auto h-4 w-24" />
                    <Skeleton className="ml-auto h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/40 px-4 py-3">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-6 items-center gap-4 border-b px-4 py-3 last:border-0"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="ml-auto h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
