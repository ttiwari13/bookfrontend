import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import axios from 'axios';
import { LogOut, ChevronDown, ChevronUp, Pencil, Sun, Moon, X, AlertCircle } from 'lucide-react';
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [fetchError, setFetchError] = useState('');

  const token = localStorage.getItem('token');
  const objectUrlRef = useRef(null);
  const fileInputRef = useRef(null);
  const initialLoadRef = useRef(false);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Profile Debug Info:');
    console.log('Token exists:', !!token);
    console.log('Token value:', token ? `${token.substring(0, 10)}...` : 'null');
    console.log('User from context:', user);
    console.log('Initial load ref:', initialLoadRef.current);
  }, [token, user]);

  const getAvatarUrl = useCallback(() => {
    if (selectedFile && objectUrlRef.current) return objectUrlRef.current;
    if (user?.avatar) return `http://localhost:5000/uploads/${user.avatar}?t=${avatarKey}`;
    return '/default-avatar.png';
  }, [user?.avatar, selectedFile, avatarKey]);

  useEffect(() => {
    const fetchProfile = async () => {
      console.log('🚀 Attempting to fetch profile...');
      
      if (!token) {
        console.log('❌ No token found');
        setFetchError('No authentication token found. Please login again.');
        setIsInitialized(true);
        return;
      }

      if (initialLoadRef.current) {
        console.log('⏭️ Already fetched, skipping');
        return;
      }

      initialLoadRef.current = true;
      setIsLoading(true);
      setFetchError('');

      try {
        console.log('📡 Making API request to profile endpoint...');
        
        const response = await axios.get('http://localhost:5000/api/profile', {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        });

        console.log('✅ Profile fetch successful:', response.data);
        
        setUser(response.data);
        setUsername(response.data.username || '');
        setEmail(response.data.email || '');
        setIsInitialized(true);
        setAvatarKey(Date.now());
        
      } catch (err) {
        console.error('❌ Profile fetch error:', err);
        
        let errorMessage = 'Failed to load profile';
        
        if (err.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout - server may be down';
        } else if (err.response) {
          // Server responded with error status
          console.log('Server error response:', err.response.data);
          console.log('Status code:', err.response.status);
          
          if (err.response.status === 401) {
            errorMessage = 'Authentication failed. Please login again.';
            // Clear invalid token
            localStorage.removeItem('token');
          } else if (err.response.status === 404) {
            errorMessage = 'Profile endpoint not found';
          } else if (err.response.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          } else {
            errorMessage = err.response.data?.message || `Server error (${err.response.status})`;
          }
        } else if (err.request) {
          // Network error
          console.log('Network error:', err.request);
          errorMessage = 'Cannot connect to server. Check if backend is running on http://localhost:5000';
        }
        
        setFetchError(errorMessage);
        setIsInitialized(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [token, setUser]);

  useLayoutEffect(() => {
    if (isInitialized && !selectedFile) {
      setAvatarPreview(getAvatarUrl());
    }
  }, [isInitialized, selectedFile, getAvatarUrl]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (showPasswordFields && (!currentPassword || !newPassword)) {
      setError('Both current and new passwords are required');
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
      
      const response = await axios.put('http://localhost:5000/api/profile', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 15000
      });

      console.log('✅ Profile update successful:', response.data);

      setUser(response.data);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setAvatarKey(Date.now());
      setAvatarPreview(getAvatarUrl());
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordFields(false);
      
      // Success notification
      alert('✅ Profile updated successfully!');
      
    } catch (err) {
      console.error('❌ Profile update error:', err);
      
      let errorMessage = 'Failed to update profile';
      
      if (err.response) {
        errorMessage = err.response.data?.message || `Update failed (${err.response.status})`;
      } else if (err.request) {
        errorMessage = 'Cannot connect to server';
      }
      
      setError(errorMessage);
      alert(`❌ ${errorMessage}`);
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
    localStorage.removeItem('token');
    localStorage.removeItem('theme');
    window.location.reload();
  };

  const retryFetch = () => {
    initialLoadRef.current = false;
    setFetchError('');
    setIsInitialized(false);
    // This will trigger the useEffect to run again
    window.location.reload();
  };

  // Loading state
  if (isLoading && !isInitialized) {
    return (
      <div className={`p-6 max-w-xl mx-auto rounded-xl shadow-md ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="text-center">
          <div className="animate-pulse">Loading profile...</div>
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
          <div className="space-y-2">
            <button 
              onClick={retryFetch}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
            >
              Retry
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
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

      <h2 className="text-2xl font-bold mb-6 text-center">Your Profile</h2>

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
          <img
            key={`${user?.avatar}-${avatarKey}`}
            src={avatarPreview}
            onError={handleAvatarError}
            className="w-24 h-24 rounded-full object-cover border-2 dark:border-green-400 border-gray-300"
            alt="Profile avatar"
          />
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
                placeholder="Enter new password"
                required
                className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-600 border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-all ${
            isLoading 
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