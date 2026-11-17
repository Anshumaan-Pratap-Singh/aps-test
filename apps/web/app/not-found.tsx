import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-mono text-cyan text-4xl">404</p>
      <p className="mt-2 text-muted">That page does not exist.</p>
      <Link href="/" className="mt-4 inline-block text-cyan">Back to the dashboard</Link>
    </div>
  );
}
