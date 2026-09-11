import Link from "next/link";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="text-center"><p className="text-sm font-bold text-violet-600">404</p><h1 className="mt-2 text-3xl font-black text-slate-900">Page not found</h1><Link href="/" className="mt-6 inline-block rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white">Return home</Link></div></main>;
}
