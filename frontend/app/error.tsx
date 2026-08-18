"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="max-w-sm text-sm text-slate-400">
        An unexpected error occurred while loading this page. You can try again, or head back
        home.
      </p>
      <div className="mt-2 flex gap-3">
        <Button variant="outline" onClick={() => router.push("/")}>
          Back to home
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
