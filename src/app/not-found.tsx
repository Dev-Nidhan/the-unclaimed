import Link from "next/link";
import { buttonClass } from "@/components/ui/panel";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <h1 className="font-serif text-3xl">Record not found</h1>
      <p className="text-sm leading-6 text-muted">That investigation is not in the catalog.</p>
      <Link href="/" className={buttonClass()}>
        Return to the dashboard
      </Link>
    </div>
  );
}
