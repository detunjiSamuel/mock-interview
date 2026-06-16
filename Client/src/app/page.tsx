'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, MAIN_API_URL } from './AuthContext';
import LoadingSpinner from './components/common/LoadingSpinner';

interface Question {
  _id: string;
  topic: string;
  difficulty: string;
  category: string;
  status?: boolean;
  slug: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function Home() {
  const { isLoggedIn, token } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0
  });
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchQuestions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build the query string
      const queryParams = new URLSearchParams();
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.limit.toString());
      
      if (categoryFilter) queryParams.append('category', categoryFilter);
      if (difficultyFilter) queryParams.append('difficulty', difficultyFilter);
      if (searchQuery) queryParams.append('search', searchQuery);
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${MAIN_API_URL}/api/questions?${queryParams.toString()}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      setQuestions(data.questions);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, pagination.page, categoryFilter, difficultyFilter, searchQuery]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when applying filters
  };

  const clearFilters = () => {
    setCategoryFilter('');
    setDifficultyFilter('');
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <main className="flex min-h-screen flex-col">
      <div className="pb-12"></div>

      <section className="mb-8">
        <h2 className="font-mono text-2xl font-bold mb-4">
          Perfect your interview performance
        </h2>
        <p className="text-gray-800 mb-4">
          Select a question or topic to practice. Our AI will ask you questions and give you feedback 
          instantly to help you ace your next interview.
        </p>
        
        {/* Search and Filter Form */}
        <form onSubmit={applyFilters} className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions..."
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">All Categories</option>
                <option value="Behavioral">Behavioral</option>
                <option value="Technical">Technical</option>
                <option value="Cultural">Cultural</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty
              </label>
              <select
                id="difficulty"
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
              >
                Apply Filters
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

      {/* Questions Section */}
      <section className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">Practice Questions</h3>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center">{error}</div>
        ) : questions.length === 0 ? (
          <div className="text-gray-500 p-4 text-center">No questions found. Try adjusting your filters.</div>
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
                  {questions.map((question) => (
                    <tr key={question._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {question.status ? (
                            <div className="w-4 h-4 bg-green-500 rounded-full" title="Completed" />
                          ) : (
                            <div className="w-4 h-4 bg-red-500 rounded-full" title="Not attempted" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          href={`/questions/${question.slug}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {question.topic}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap capitalize">{question.difficulty}</td>
                      <td className="px-6 py-4 whitespace-nowrap capitalize">{question.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-center mt-6">
                <nav className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className={`px-3 py-1 rounded ${
                      pagination.page === 1
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 rounded ${
                        page === pagination.page
                          ? 'bg-black text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className={`px-3 py-1 rounded ${
                      pagination.page === pagination.pages
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </section>
      
      {/* Resources Section */}
      <section className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">Interview Tips</h4>
            <p className="text-gray-700 mb-3">Learn strategies and tips to excel in your interviews.</p>
            <Link href="/resources/tips" className="text-blue-600 hover:underline">
              View Tips →
            </Link>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">Resume Building</h4>
            <p className="text-gray-700 mb-3">Craft the perfect resume to stand out to employers.</p>
            <Link href="/resources/resume" className="text-blue-600 hover:underline">
              View Guide →
            </Link>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">Career Development</h4>
            <p className="text-gray-700 mb-3">Resources to help you grow in your professional journey.</p>
            <Link href="/resources/career" className="text-blue-600 hover:underline">
              Explore Resources →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}