"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/AuthContext";

export default function DashboardPage() {
  const { isLoggedIn, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.push("/auth/login");
  }, [isLoading, isLoggedIn, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-black border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <main className="flex min-h-screen flex-col">
      <div className="pb-8" />

      <section className="mb-8">
        <h1 className="font-mono text-3xl font-bold mb-1">Your Dashboard</h1>
        <p className="text-gray-600">{user?.email}</p>
      </section>

      <section className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Interview History</h2>
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 flex flex-col items-center text-center gap-3">
          <p className="text-gray-500">Your interview history will appear here.</p>
          <p className="text-gray-400 text-sm">
            A dedicated endpoint for listing all your interviews is coming in a future phase.
          </p>
          <Link
            href="/"
            className="mt-2 inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors text-sm"
          >
            Browse Practice Questions
          </Link>
        </div>
      </section>
    </main>
  );
}
