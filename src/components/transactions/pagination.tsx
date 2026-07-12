"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  totalPages: number;
};

export function Pagination({ page, totalPages }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const buildHref = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <div className="text-muted-foreground text-sm">
        Sayfa {page} / {totalPages}
      </div>
      <div className="flex gap-1">
        <Button
          asChild={!prevDisabled}
          variant="outline"
          size="sm"
          disabled={prevDisabled}
        >
          {prevDisabled ? (
            <span>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Önceki
            </span>
          ) : (
            <Link href={buildHref(page - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Önceki
            </Link>
          )}
        </Button>
        <Button
          asChild={!nextDisabled}
          variant="outline"
          size="sm"
          disabled={nextDisabled}
        >
          {nextDisabled ? (
            <span>
              Sonraki
              <ChevronRight className="ml-1 h-4 w-4" />
            </span>
          ) : (
            <Link href={buildHref(page + 1)}>
              Sonraki
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}
