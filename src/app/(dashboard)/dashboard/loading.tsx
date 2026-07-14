import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-48" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-3 h-3 w-40" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-4 aspect-video max-h-64 w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <ul className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-3 w-40" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
