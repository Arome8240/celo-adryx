import { Plane } from "lucide-react";
import { SearchForm } from "@/components/flights/SearchForm";

export default function Home() {
  return (
    <main className="flex-1">
      <section className="relative py-16 lg:py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Plane className="h-4 w-4" />
              Pay with your wallet
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              Book flights, pay in <span className="text-primary">USDm</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Search real flights and pay directly from your connected wallet — no cards,
              no bank transfers.
            </p>
          </div>

          <SearchForm />
        </div>
      </section>
    </main>
  );
}
