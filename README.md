# Skupni koledar (Next.js + Supabase)

Skupni koledar z vlogami. Prijava je obvezna, javne registracije ni — nove uporabnike
doda izključno **administrator**, ki vsakemu dodeli vlogo:

- **Administrator** — vse pravice + upravljanje uporabnikov (`/admin`)
- **Urejevalec** — lahko dodaja, ureja in briše dogodke
- **Gledalec** — koledar lahko samo pregleduje

Model dovoljenj je vsiljen na ravni baze s **Row-Level Security (RLS)**, ne le v vmesniku —
tudi če bi kdo klical bazo mimo aplikacije, gledalec ne more spreminjati dogodkov.

## Funkcije

- Mesečni, tedenski in dnevni pogled
- Ustvarjanje / urejanje / brisanje dogodkov (glede na vlogo)
- Ponavljajoči se termini: dnevno / tedensko / mesečno, z neobveznim datumom zaključka
- En skupni koledar (vsi uporabniki vidijo iste dogodke)
- Prijava z e-pošto in geslom, katerakoli e-mail domena
- (Neobvezno) sinhronizacija v realnem času med uporabniki

## Tehnologija

- **Next.js 14** (App Router, TypeScript)
- **Supabase** — Postgres baza, avtentikacija in RLS
- Brez zunanjih koledarskih knjižnic (vmesnik je lasten, lahek)

---

## Namestitev (korak za korakom)

### 1) Ustvari Supabase projekt
Na <https://supabase.com> ustvari nov projekt (brezplačni plan zadostuje).

### 2) Ustvari shemo baze
V Supabase odpri **SQL Editor** in zaženi celotno vsebino datoteke
[`supabase/schema.sql`](supabase/schema.sql). To ustvari tabeli `profiles` in `events`
ter vsa RLS pravila.

### 3) Vpiši okoljske spremenljivke
Kopiraj `.env.local.example` v `.env.local` in vpiši vrednosti iz
**Supabase → Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=...        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon / public ključ
SUPABASE_SERVICE_ROLE_KEY=...       # service_role ključ (TAJNO — samo strežnik)
```

> `SUPABASE_SERVICE_ROLE_KEY` se uporablja izključno strežniško (za to, da admin ustvari
> uporabnike). Nikoli ga ne izpostavi na odjemalcu in ga ne dodajaj s predpono `NEXT_PUBLIC_`.

### 4) Ustvari prvega administratorja
Ker javne registracije ni, prvega uporabnika ustvariš ročno:

1. Supabase → **Authentication → Users → Add user** (vnesi e-pošto + geslo).
2. V **SQL Editor** zaženi (zamenjaj e-pošto in ime):

```sql
insert into public.profiles (id, email, full_name, role)
select id, email, 'Ime Priimek', 'admin'
from auth.users where email = 'tvoj-email@primer.com'
on conflict (id) do update set role = 'admin';
```

Od tu naprej vse ostale uporabnike dodajaš kar iz aplikacije na strani **/admin**.

### 5) Zaženi
```bash
npm install
npm run dev
```
Odpri <http://localhost:3000>, prijavi se kot administrator in dodaj uporabnike.

---

## Namestitev v produkcijo (Vercel)

1. Potisni kodo v Git in uvozi projekt v [Vercel](https://vercel.com).
2. V nastavitvah projekta dodaj iste tri okoljske spremenljivke kot v `.env.local`.
3. Deploy. (Deluje tudi na Netlify ali kjer koli, kjer teče Next.js.)

## Sinhronizacija v realnem času (neobvezno)

Če želiš, da se spremembe pri enem uporabniku takoj pokažejo pri drugih:
Supabase → **Database → Replication** → vklopi Realtime za tabelo `events`.
Aplikacija se nanjo že naroči.

---

## Struktura projekta

```
supabase/schema.sql              baza + RLS (model dovoljenj)
src/middleware.ts                zaščita poti + osvežitev seje
src/lib/supabase/{client,server,admin}.ts   Supabase odjemalci
src/lib/recurrence.ts            logika ponavljajočih se dogodkov
src/lib/types.ts, ui.ts          tipi in UI konstante
src/app/login/                   prijava
src/app/(app)/                   zaščiteni del (koledar + admin)
src/components/CalendarApp.tsx    koledar (mesec/teden/dan, dogodki)
src/components/AdminApp.tsx       upravljanje uporabnikov
src/app/(app)/admin/actions.ts   strežniške akcije (ustvari/spremeni/izbriši uporabnika)
```

## Opombe in omejitve

- **Ponavljajoči se dogodki**: urejanje ali brisanje trenutno velja za *celotno serijo*.
  Opciji »samo ta dogodek« in »ta in vsi naslednji« (kot v Google Koledarju) je mogoče
  dodati z ločeno tabelo izjem — po dogovoru.
- **Opomniki**: namerno jih ni (po zahtevi). Enostavno se jih doda kasneje (npr. Supabase
  Edge Functions + e-pošta).
- **Časovni pas**: dogodki se hranijo kot `timestamptz`; vmesnik prikazuje lokalni čas brskalnika.
- **Prijava**: uporablja e-pošto + geslo. Za prijavo prek povezave (magic link) zamenjaj
  `signInWithPassword` v `src/app/login/page.tsx` s `signInWithOtp` (potreben je nastavljen SMTP
  v Supabase).
