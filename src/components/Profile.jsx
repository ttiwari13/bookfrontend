import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import axios from 'axios';
import { LogOut, ChevronDown, ChevronUp, Pencil, Sun, Moon, X, AlertCircle, RefreshCw, Shield } from 'lucide-react';
import { useAuth } from '../context/useAuth';

const Profile = () => {
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('/default-avatar.png');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [editAvatarMode, setEditAvatarMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage?.getItem('theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [fetchError, setFetchError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  const objectUrlRef = useRef(null);
  const fileInputRef = useRef(null);
  const initialLoadRef = useRef(false);
  const retryTimeoutRef = useRef(null);

  // Enhanced token management
  const getToken = useCallback(() => {
    try {
      return localStorage?.getItem('token') || null;
    } catch {
      return null;
    }
  }, []);

  const setToken = useCallback((token) => {
    try {
      if (token) {
        localStorage?.setItem('token', token);
      } else {
        localStorage?.removeItem('token');
      }
    } catch {
      console.warn('Cannot access localStorage');
    }
  }, []);

  // JWT Token validation
  const validateToken = useCallback((token) => {
    if (!token) return false;
    
    try {
      // Basic JWT structure validation
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Decode payload
      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiration
      if (payload.exp && payload.exp * 1000 <= Date.now()) {
        console.log('🔒 Token expired');
        return false;
      }
      
      return true;
    } catch (err) {
      console.log('🔒 Token validation failed:', err.message);
      return false;
    }
  }, []);

  // Enhanced API client with interceptors
  const createApiClient = useCallback(() => {
    const client = axios.create({
      baseURL: 'http://localhost:5000/api',
      timeout: 15000,
    });

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        const token = getToken();
        if (token && validateToken(token)) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        setConnectionStatus('connected');
        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          setIsTokenValid(false);
          setToken(null);
          setConnectionStatus('unauthorized');
        } else if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          setConnectionStatus('offline');
        } else {
          setConnectionStatus('error');
        }
        return Promise.reject(error);
      }
    );

    return client;
  }, [getToken, validateToken, setToken]);

  // Token validation on mount
  useEffect(() => {
    const token = getToken();
    const isValid = validateToken(token);
    setIsTokenValid(isValid);
    
    if (!isValid && token) {
      setToken(null);
      setFetchError('Session expired. Please login again.');
    }
    
    console.log('🔍 Profile Debug Info:');
    console.log('Token exists:', !!token);
    console.log('Token valid:', isValid);
    console.log('User from context:', user);
  }, [getToken, validateToken, setToken, user]);

  const getAvatarUrl = useCallback(() => {
    if (selectedFile && objectUrlRef.current) return objectUrlRef.current;
    if (user?.avatar) return `http://localhost:5000/uploads/${user.avatar}?t=${avatarKey}`;
    return '/default-avatar.png';
  }, [user?.avatar, selectedFile, avatarKey]);

  // Enhanced profile fetching with retry logic
  const fetchProfile = useCallback(async (isRetry = false) => {
    const token = getToken();
    
    if (!token || !validateToken(token)) {
      setFetchError('No valid authentication token found. Please login again.');
      setIsInitialized(true);
      setConnectionStatus('unauthorized');
      return;
    }

    if (initialLoadRef.current && !isRetry) {
      return;
    }

    if (!isRetry) {
      initialLoadRef.current = true;
    }

    setIsLoading(true);
    setFetchError('');
    setConnectionStatus('checking');

    try {
      const apiClient = createApiClient();
      const response = await apiClient.get('/profile');

      console.log('✅ Profile fetch successful:', response.data);
      
      setUser(response.data);
      setUsername(response.data.username || '');
      setEmail(response.data.email || '');
      setIsInitialized(true);
      setAvatarKey(Date.now());
      setRetryCount(0);
      setConnectionStatus('connected');
      
    } catch (err) {
      console.error('❌ Profile fetch error:', err);
      
      let errorMessage = 'Failed to load profile';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout - server may be down';
        setConnectionStatus('offline');
      } else if (err.response) {
        const status = err.response.status;
        const serverMessage = err.response.data?.message;
        
        switch (status) {
          case 401:
            errorMessage = 'Authentication failed. Please login again.';
            setToken(null);
            setIsTokenValid(false);
            setConnectionStatus('unauthorized');
            break;
          case 403:
            errorMessage = 'Access denied. Insufficient permissions.';
            break;
          case 404:
            errorMessage = 'Profile endpoint not found';
            break;
          case 429:
            errorMessage = 'Too many requests. Please wait a moment.';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = 'Server error. Please try again later.';
            setConnectionStatus('error');
            break;
          default:
            errorMessage = serverMessage || `Server error (${status})`;
        }
      } else if (err.request) {
        errorMessage = 'Cannot connect to server. Check if backend is running on http://localhost:5000';
        setConnectionStatus('offline');
      }
      
      setFetchError(errorMessage);
      setIsInitialized(true);
      
      // Auto-retry logic for network errors
      if (retryCount < 3 && (err.code === 'ECONNABORTED' || err.request)) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`🔄 Auto-retry in ${delay}ms (attempt ${retryCount + 1}/3)`);
        
        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchProfile(true);
        }, delay);
      }
      
    } finally {
      setIsLoading(false);
    }
  }, [getToken, validateToken, createApiClient, setUser, setToken, retryCount]);

  useEffect(() => {
    fetchProfile();
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchProfile]);

  useLayoutEffect(() => {
    if (isInitialized && !selectedFile) {
      setAvatarPreview(getAvatarUrl());
    }
  }, [isInitialized, selectedFile, getAvatarUrl]);

  // Theme management
  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', darkMode);
      localStorage?.setItem('theme', darkMode ? 'dark' : 'light');
    } catch {
      console.warn('Cannot save theme preference');
    }
  }, [darkMode]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced file handling
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, GIF, WebP)');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Cleanup previous object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    objectUrlRef.current = URL.createObjectURL(file);
    setSelectedFile(file);
    setAvatarPreview(objectUrlRef.current);
    setEditAvatarMode(false);
    setError('');
  };

  const cancelAvatarEdit = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSelectedFile(null);
    setEditAvatarMode(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setAvatarPreview(getAvatarUrl());
    setError('');
  };

  // Enhanced form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (showPasswordFields && (!currentPassword || !newPassword)) {
      setError('Both current and new passwords are required');
      return;
    }

    if (showPasswordFields && newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    const token = getToken();
    if (!token || !validateToken(token)) {
      setError('Authentication token is invalid. Please login again.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('username', username.trim());
      formData.append('email', email.trim());
      
      if (selectedFile) {
        formData.append('image', selectedFile);
      }
      
      if (showPasswordFields && newPassword && currentPassword) {
        formData.append('password', newPassword);
        formData.append('currentPassword', currentPassword);
      }

      console.log('📤 Submitting profile update...');
      
      const apiClient = createApiClient();
      const response = await apiClient.put('/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Profile update successful:', response.data);

      // Update state
      setUser(response.data);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setAvatarKey(Date.now());
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordFields(false);
      
      // Success notification
      setError('');
      // You might want to use a toast notification instead of alert
      alert('✅ Profile updated successfully!');
      
    } catch (err) {
      console.error('❌ Profile update error:', err);
      
      let errorMessage = 'Failed to update profile';
      
      if (err.response) {
        const status = err.response.status;
        const serverMessage = err.response.data?.message;
        
        switch (status) {
          case 400:
            errorMessage = serverMessage || 'Invalid data provided';
            break;
          case 401:
            errorMessage = 'Authentication failed. Please login again.';
            setToken(null);
            setIsTokenValid(false);
            break;
          case 403:
            errorMessage = 'Current password is incorrect';
            break;
          case 409:
            errorMessage = 'Username or email already exists';
            break;
          case 413:
            errorMessage = 'File size too large';
            break;
          case 422:
            errorMessage = serverMessage || 'Invalid file format';
            break;
          default:
            errorMessage = serverMessage || `Update failed (${status})`;
        }
      } else if (err.request) {
        errorMessage = 'Cannot connect to server';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarError = useCallback((e) => {
    console.log('🖼️ Avatar load error:', e.target.src);
    if (!e.target.src.includes('default-avatar')) {
      e.target.src = '/default-avatar.png';
    }
  }, []);

  const handleLogout = () => {
    try {
      setToken(null);
      localStorage?.removeItem('theme');
    } catch {
      console.warn('Cannot clear localStorage');
    }
    window.location.reload();
  };

  const retryFetch = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    initialLoadRef.current = false;
    setFetchError('');
    setIsInitialized(false);
    setRetryCount(0);
    fetchProfile(true);
  };

  // Connection status indicator
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'checking': return 'text-yellow-500';
      case 'offline': return 'text-red-500';
      case 'unauthorized': return 'text-red-500';
      case 'error': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'checking': return 'Connecting...';
      case 'offline': return 'Offline';
      case 'unauthorized': return 'Unauthorized';
      case 'error': return 'Server Error';
      default: return 'Unknown';
    }
  };

  // Loading state
  if (isLoading && !isInitialized) {
    return (
      <div className={`p-6 max-w-xl mx-auto rounded-xl shadow-md ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="text-center">
          <div className="animate-spin mx-auto mb-4 w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full"></div>
          <div className="animate-pulse">Loading profile...</div>
          {retryCount > 0 && (
            <div className="text-sm text-gray-500 mt-2">
              Retry attempt {retryCount}/3
            </div>
          )}
        </div>
      </div>
    );
  }

  // Authentication error state
  if (!isTokenValid) {
    return (
      <div className={`p-6 max-w-xl mx-auto rounded-xl shadow-md ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="text-center">
          <Shield className="mx-auto mb-4 text-red-500" size={48} />
          <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
          <p className="text-red-500 mb-4">Your session has expired. Please login again.</p>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Fetch error state
  if (fetchError && !user) {
    return (
      <div className={`p-6 max-w-xl mx-auto rounded-xl shadow-md ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h3 className="text-lg font-semibold mb-2">Unable to Load Profile</h3>
          <p className="text-red-500 mb-4">{fetchError}</p>
          <div className={`text-sm mb-4 ${getConnectionStatusColor()}`}>
            Status: {getConnectionStatusText()}
          </div>
          <div className="space-y-2">
            <button 
              onClick={retryFetch}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <RefreshCw className="animate-spin mr-2" size={16} />
              ) : (
                <RefreshCw className="mr-2" size={16} />
              )}
              Retry
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
          {retryCount > 0 && (
            <div className="text-sm text-gray-500 mt-2">
              Auto-retry attempts: {retryCount}/3
            </div>
          )}
        </div>
      </div>
    );
  }

  // User not found state
  if (isInitialized && !user) {
    return (
      <div className={`p-6 max-w-xl mx-auto rounded-xl shadow-md ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="text-center text-red-500">
          <AlertCircle className="mx-auto mb-2" size={48} />
          <p>User data not available</p>
          <button 
            onClick={handleLogout}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 max-w-xl mx-auto rounded-xl shadow-md relative ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
      {/* Connection status indicator */}
      <div className="absolute top-2 right-2">
        <div className={`text-xs ${getConnectionStatusColor()} flex items-center`}>
          <div className={`w-2 h-2 rounded-full mr-1 ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'checking' ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500'
          }`}></div>
          {getConnectionStatusText()}
        </div>
      </div>

      {/* Theme toggle for mobile */}
      <div className="absolute top-4 left-4 sm:hidden">
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Logout button */}
      <div className="absolute top-4 right-4">
        <button 
          onClick={handleLogout} 
          className="text-red-500 flex items-center hover:text-red-600 transition-colors"
        >
          <LogOut className="mr-1" size={18} /> 
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-6 text-center pt-8">Your Profile</h2>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded border border-red-300 dark:border-red-700 flex items-center">
          <AlertCircle size={16} className="mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar section */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <img
              key={`${user?.avatar}-${avatarKey}`}
              src={avatarPreview}
              onError={handleAvatarError}
              className="w-24 h-24 rounded-full object-cover border-2 dark:border-green-400 border-gray-300"
              alt="Profile avatar"
            />
            {selectedFile && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                ✓
              </div>
            )}
          </div>
          {!editAvatarMode ? (
            <button 
              type="button" 
              onClick={() => setEditAvatarMode(true)} 
              className="text-sm text-teal-400 hover:text-teal-500 hover:underline mt-2 transition-colors"
            >
              <Pencil className="inline mr-1" size={14} /> Edit Avatar
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 mt-2">
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100" 
              />
              <button 
                type="button" 
                onClick={cancelAvatarEdit} 
                className="text-xs text-red-400 hover:text-red-500 hover:underline transition-colors"
              >
                <X size={12} className="inline mr-1" /> Cancel
              </button>
            </div>
          )}
        </div>

        {/* Username input */}
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            placeholder="Enter username"
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Email input */}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter email"
            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Password change toggle */}
        <button
          type="button"
          onClick={() => setShowPasswordFields(!showPasswordFields)}
          className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-500 hover:underline transition-colors"
        >
          {showPasswordFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showPasswordFields ? 'Hide Password Fields' : 'Change Password'}
        </button>

        {/* Password fields */}
        {showPasswordFields && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                required
                minLength={6}
                className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
              />
              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
              )}
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading || !isTokenValid}
          className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-all ${
            isLoading || !isTokenValid
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-teal-500 hover:bg-teal-600 active:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            'Save Changes'
          )}
        </button>
      </form>
    </div>
  );
};

export default Profile;