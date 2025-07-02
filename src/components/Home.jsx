// Home.js - Updated with improved floating button visibility and modal handling
import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from "../context/ThemeContext";
import LoginModal from "../components/LoginModal";
import SignupModal from "../components/SignupModal";
import BookCard from './BookCard';
import Layout from "../components/Layout";
import API from "../api/axios"; // ✅ Use your custom instance named API
import { useAuth } from "../context/useAuth";
import FloatingFeedbackButton from './FloatingFeedbackButton';

const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const { darkMode } = useTheme();
  const { isLoggedIn, setIsLoggedIn } = useAuth();
  const [modalType, setModalType] = useState("login");
  const [connectionError, setConnectionError] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const authCheckRef = useRef(false);

  const [filters, setFilters] = useState({
    language: '', genre: '', duration: '', author: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    languages: [], genres: [], authors: []
  });

  const currentPage = parseInt(searchParams.get('page')) || 1;

  // Update filters and search query from URL parameters
  useEffect(() => {
    const urlFilters = {
      language: searchParams.get('language') || '',
      genre: searchParams.get('genre') || '',
      duration: searchParams.get('duration') || '',
      author: searchParams.get('author') || ''
    };
    setFilters(urlFilters);
    setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

  // Pagination handler
  const setPage = (newPage) => {
    const params = new URLSearchParams(searchParams);
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', newPage.toString());
    }
    setSearchParams(params);
  };

  // Filter update handler
  const updateFilters = (newFilters) => {
    setFilters(newFilters);
    const params = new URLSearchParams(searchParams);
    params.delete('page'); // Reset to first page when filters change
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    setSearchParams(params);
  };

  // Clear all filters
  const clearFilters = () => {
    updateFilters({ language: '', genre: '', duration: '', author: '' });
  };

  // Authentication check
  useEffect(() => {
    if (authCheckRef.current) return;
    authCheckRef.current = true;

    const checkLogin = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setIsLoggedIn(false);
          setAuthChecked(true);
          return;
        }
        
        setIsLoggedIn(true);
        setAuthChecked(true);
        
        try {
          const res = await API.get("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000
          });
          if (!res.data) {
            localStorage.removeItem("token");
            setIsLoggedIn(false);
          }
        } catch (error) {
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            localStorage.removeItem("token");
            setIsLoggedIn(false);
          }
        }
      } catch {
        const token = localStorage.getItem("token");
        setIsLoggedIn(!!token);
      } finally {
        setAuthChecked(true);
      }
    };

    checkLogin();
  }, [setIsLoggedIn]);

  // Debug log for API base URL
  console.log("👉 Base URL:", API.defaults.baseURL);

  // Fetch books and filter options
  useEffect(() => {
    const fetchBooks = async () => {
      if (initialLoad) setLoading(true);
      setConnectionError(null); // Clear previous errors
      
      try {
        const queryParams = new URLSearchParams();
        if (searchQuery.trim()) queryParams.set("q", searchQuery.trim());
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value.trim() !== '') queryParams.set(key, value);
        });
        
        queryParams.set('page', currentPage.toString());
        queryParams.set('limit', '12');
        
        const res = await API.get(`/api/books?${queryParams.toString()}`, { 
          timeout: 10000 
        });
        
        const data = res.data;
        setBooks(Array.isArray(data.books) ? data.books : []);

      } catch (error) {
        console.error("Fetch error:", error.message);
        setBooks([]);
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          setConnectionError('Connection timeout. Please check your internet connection.');
        } else if (error.code === 'ERR_NETWORK') {
          setConnectionError('Network error. Please check if the server is running.');
        } else {
          setConnectionError('Failed to load books. Please try again.');
        }
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };

    const fetchFilterOptions = async () => {
      try {
        const res = await API.get('/api/books/filters', { timeout: 5000 });
        if (res.data) {
          setFilterOptions(prev => ({
            ...prev,
            languages: res.data.languages || [],
            genres: res.data.genres || [],
            authors: res.data.authors || []
          }));
        }
      } catch (error) {
        console.warn("Failed to fetch filter options, using defaults:", error.message);
        // Fallback to default options
        setFilterOptions(prev => ({
          ...prev,
          languages: ['English', 'Hindi', 'Spanish', 'French'],
          genres: ['Fiction', 'Romance', 'Mystery', 'Thriller', 'Science Fiction'],
          authors: ['Agatha Christie', 'Stephen King', 'J.K. Rowling']
        }));
      }
    };

    if (authChecked) {
      fetchBooks();
      if (initialLoad) fetchFilterOptions();
    }
  }, [currentPage, authChecked, initialLoad, filters, searchQuery]);

  // Search handler
  const handleSearch = () => {
    const params = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    } else {
      params.delete("q");
    }
    params.delete("page"); // Reset to first page on new search
    setSearchParams(params);
  };

  // Modal close handler
  const closeModal = () => {
    setIsLoggedIn(true);
    setConnectionError(null);
    setAuthChecked(true);
    authCheckRef.current = true;
  };

  // Modal switch handlers
  const switchToSignup = () => setModalType("signup");
  const switchToLogin = () => setModalType("login");

  // Loading state
  if (!authChecked) {
    return (
      <div className={`flex justify-center items-center min-h-screen ${
        darkMode ? 'bg-gray-950 text-white' : 'bg-gray-100 text-black'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Modal overlay and modals */}
      {!isLoggedIn && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
          {modalType === "login" && (
            <LoginModal 
              onClose={closeModal} 
              onSwitchToSignup={switchToSignup} 
            />
          )}
          {modalType === "signup" && (
            <SignupModal 
              onClose={closeModal} 
              onSwitchToLogin={switchToLogin} 
            />
          )}
        </>
      )}

      <Layout
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        showSearch={true}
        filters={filters}
        filterOptions={filterOptions}
        onFiltersChange={updateFilters}
        onClearFilters={clearFilters}
      >
        <main className="container mx-auto px-4 py-6">
          {/* Connection Error Alert */}
          {connectionError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="font-semibold">Connection Error:</strong>
                  <span className="ml-2">{connectionError}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.location.reload()} 
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
                  >
                    Retry
                  </button>
                  <button 
                    onClick={() => setConnectionError(null)} 
                    className="text-red-500 hover:text-red-700 text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-lg">Loading books...</p>
            </div>
          ) : (
            <>
              {/* Books Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-2 sm:p-4">
                {books.length > 0 ? (
                  books.map(book => (
                    <BookCard 
                      key={book._id} 
                      book={book} 
                      currentPage={currentPage} 
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-20">
                    <div className="text-gray-500 dark:text-gray-400">
                      <p className="text-xl mb-2">📚 No books found</p>
                      <p>Try adjusting your search or filters</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {books.length > 0 && (
                <div className="flex justify-center items-center mt-12 gap-4">
                  <button 
                    onClick={() => setPage(Math.max(currentPage - 1, 1))} 
                    disabled={currentPage === 1} 
                    className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 p-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <span className="px-4 py-2 bg-green-200 dark:bg-green-700 text-black dark:text-white rounded font-medium">
                    Page {currentPage}
                  </span>
                  
                  <button 
                    onClick={() => setPage(currentPage + 1)} 
                    className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 p-2 rounded transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* Floating Feedback Button - High z-index to appear above modals */}
        <div className="fixed bottom-4 right-4 z-50">
          <FloatingFeedbackButton />
        </div>
      </Layout>
    </>
  );
};

export default Home;