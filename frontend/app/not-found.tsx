import Link from "next/link";
import { PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-300">
        <PenTool className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold text-white">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-400">
        This page could not be found. It may have been moved or the link is incorrect.
      </p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
