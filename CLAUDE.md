# finance-app

Kişisel finans takip uygulaması. Kullanıcılar hesaplarını, gelir/gider işlemlerini ve kategorilerini yönetir; panel üzerinden özet grafiklerle nakit akışını takip eder.

## Stack

- **Next.js 15** — App Router, TypeScript strict mode
- **Tailwind CSS v4** + **shadcn/ui** (New York style, slate base color, CSS variables)
- **Supabase** — `@supabase/supabase-js` + `@supabase/ssr` (auth + Postgres + RLS)
- **react-hook-form** + **zod** — tüm form validasyonu
- **recharts** — grafikler (shadcn `chart` bileşenleri üzerinden)
- **pnpm** — paket yöneticisi
- **lucide-react** — ikonlar

## Klasör yapısı

```
src/
├── app/
│   ├── (auth)/              # Public auth route grubu
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/         # Auth'lu route grubu
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── categories/
│   │   └── settings/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing
│   └── globals.css
├── components/
│   ├── ui/                  # shadcn/ui bileşenleri (elle düzenleme)
│   └── ...                  # Uygulamaya özel bileşenler
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Browser client (Client Components)
│   │   ├── server.ts        # Server client (Server Components / Actions / Route Handlers)
│   │   └── middleware.ts    # updateSession helper (cookie yenileme)
│   ├── validations/         # zod şemaları (form + payload)
│   └── utils.ts             # cn() vb.
└── types/
    └── database.ts          # `supabase gen types typescript` çıktısı

supabase/
└── migrations/              # SQL migration'ları
```

## Kod konvansiyonları

- **Server Components varsayılan.** Ancak state, effect veya tarayıcı API'si gerekliyse dosyaya `"use client"` ekle.
- **Veri yazma işlemleri Server Actions ile.** İstemciden `fetch` ile API route'a yazma yapma; `"use server"` fonksiyonlarını doğrudan formlardan çağır.
- **Tüm formlar zod ile valide edilir.** Şema `src/lib/validations/` altında tanımlanır, hem `react-hook-form` (`zodResolver`) hem de Server Action girişinde aynı şema kullanılır.
- **Para birimi hesapları asla float ile yapılmaz.** Tutarları veritabanında `numeric` veya minor unit (kuruş) olarak `bigint`/`integer` sakla; UI'da formatla, hesaplamalarda `Decimal` benzeri güvenli bir tip kullan.
- **TypeScript strict.** `any` yerine `unknown`, tip daraltmayı runtime kontrolüyle yap.
- **Path alias `@/*` → `src/*`.**
- **shadcn bileşenlerini elle düzenle.** `components.json` new-york + slate; renk/token değişiklikleri `globals.css` içindeki CSS değişkenleri üzerinden.

## Supabase / güvenlik

- **Her tabloda RLS zorunlu.** Yeni bir migration şu adımları içermeli:
  1. Tablo tanımı,
  2. `alter table <t> enable row level security;`,
  3. `select`, `insert`, `update`, `delete` için `auth.uid()` bazlı politika(lar).
  RLS'siz merge edilen bir tablo bug'dır.
- Servis-role anahtarı **hiçbir zaman istemciye sızdırılmaz**; yalnız Server Actions içinde ve gerçekten gerekliyse kullanılır.
- Env değişkenleri `.env.local` (git'e girmez); referans `.env.example` içinde.

## Komutlar

```bash
pnpm dev             # geliştirme sunucusu
pnpm build           # üretim build'i
pnpm start           # üretim sunucusunu başlat
pnpm lint            # eslint
pnpm dlx shadcn@latest add <component>   # yeni shadcn bileşeni ekle
```
