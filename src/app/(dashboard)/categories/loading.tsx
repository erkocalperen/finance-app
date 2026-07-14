import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="space-y-4">
        <div className="flex gap-1 rounded-md bg-muted p-1">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>

        <ul className="divide-y rounded-lg border">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
