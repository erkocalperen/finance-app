import { ModeToggle } from "@/components/mode-toggle";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Görünüm ve tercih ayarları.
        </p>
      </div>

      <section className="rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Tema</h2>
            <p className="text-muted-foreground text-xs">
              Açık, karanlık veya sistem tercihi.
            </p>
          </div>
          <ModeToggle />
        </div>
      </section>
    </div>
  );
}
