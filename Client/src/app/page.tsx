"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { apiClient } from "@/lib/api-client";

interface Question {
  id: string;
  topic: string;
  difficulty: string;
  category: string;
  has_attempted: boolean;
  slug: string;
}

interface QuestionsResponse {
  questions: Question[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

function QuestionRowSkeleton() {
  return (
    <tr>
      <td className="px-6 py-4"><div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse mx-auto" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-48" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-16" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-20" /></td>
    </tr>
  );
}

export default function Home() {
  const { isLoggedIn } = useAuth();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");

  const { data, isLoading, isError } = useQuery<QuestionsResponse>({
    queryKey: ["questions", page, category, difficulty, search],
    queryFn: () =>
      apiClient
        .get("/api/questions", { params: { page, limit: 10, category, difficulty, search: search || undefined } })
        .then((r) => r.data),
  });

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(draftSearch);
    setPage(1);
  };

  const clearFilters = () => {
    setCategory("");
    setDifficulty("");
    setSearch("");
    setDraftSearch("");
    setPage(1);
  };

  const pagination = data?.pagination;

  return (
    <main className="flex min-h-screen flex-col">
      <div className="pb-12" />

      <section className="mb-8">
        <h2 className="font-mono text-2xl font-bold mb-4">Perfect your interview performance</h2>
        <p className="text-gray-800 mb-4">
          Select a question to practise. Our AI will transcribe your answer and give you structured
          feedback to help you ace your next interview.
        </p>

        <form onSubmit={applyFilters} className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                id="search"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search questions…"
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">All Categories</option>
                <option value="behavioral">Behavioral</option>
                <option value="technical">Technical</option>
                <option value="situational">Situational</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">Practice Questions</h3>

        {isError ? (
          <div className="text-red-500 p-4 text-center">Failed to load questions. Please try again.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difficulty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => <QuestionRowSkeleton key={i} />)
                    : data?.questions.length === 0
                    ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No questions found. Try adjusting your filters.
                        </td>
                      </tr>
                    )
                    : data?.questions.map((q: Question) => (
                      <tr key={q.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {isLoggedIn ? (
                              <div
                                className={`w-4 h-4 rounded-full ${q.has_attempted ? "bg-green-500" : "bg-red-500"}`}
                                title={q.has_attempted ? "Attempted" : "Not attempted"}
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-gray-300" title="Log in to track progress" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/questions/${q.slug}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {q.topic}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">{q.difficulty}</td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">{q.category}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex justify-center mt-6">
                <nav className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1 rounded ${p === page ? "bg-black text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === pagination.pages}
                    className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
