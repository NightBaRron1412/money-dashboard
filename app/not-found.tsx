import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-main p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-text-primary">404</h1>
        <p className="mt-4 text-lg text-text-secondary">Page not found</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-accent-purple px-6 py-2.5 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
