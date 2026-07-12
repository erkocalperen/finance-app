import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          finance-app
        </h1>
        <p className="text-muted-foreground text-lg">
          Kişisel gelirinizi, giderlerinizi ve hesaplarınızı tek bir yerden takip edin.Alperen
        </p>
        <Button asChild size="lg">
          <Link href="/login">Giriş Yap</Link>
        </Button>
      </div>
    </main>
  );
}
