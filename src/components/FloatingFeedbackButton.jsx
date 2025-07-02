import React, { useState } from 'react';
import { MessageSquare, X, Send, Star, ChevronDown, Shield } from 'lucide-react';
import API from '../api/axios';

export default function FloatingFeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(0);
  const [feedbackType, setFeedbackType] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const feedbackTypes = [
    'Bug Report', 'Feature Request', 'General Feedback', 'Performance Issue', 'UI/UX Feedback'
  ];

  const ratingLabels = {
    1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent'
  };

  const handleSubmit = async () => {
    if (!feedback.trim() || rating === 0 || !feedbackType) return;

    try {
      await API.post(
        "/api/feedback",
        { feedback, rating, feedbackType },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setIsOpen(false);
        setFeedback('');
        setRating(0);
        setFeedbackType('');
      }, 2500);
    } catch (error) {
      console.error("Failed to send feedback:", error);
      alert("❌ Feedback failed to send. Please try again later.");
    }
  };

  return (
    <div className="relative">
      {!isOpen ? (
        <button
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition fixed bottom-4 right-4 z-50"
          onClick={() => setIsOpen(true)}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      ) : (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-800 shadow-xl rounded-lg w-96 p-6 border border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Send Feedback</h3>
            <X className="w-5 h-5 cursor-pointer text-slate-400 hover:text-white" onClick={() => setIsOpen(false)} />
          </div>

          {/* Overall Rating */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-orange-400 font-mono">$</span>
              <span className="text-orange-400 text-sm font-medium">Overall Rating</span>
              <span className="text-red-400 text-sm">●</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((val) => (
                <Star
                  key={val}
                  className={`w-5 h-5 cursor-pointer ${val <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`}
                  onClick={() => setRating(val)}
                />
              ))}
              {rating > 0 && (
                <span className="text-sm ml-2 text-slate-300">{ratingLabels[rating]}</span>
              )}
            </div>
          </div>

          {/* Feedback Type */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 font-mono">$</span>
              <span className="text-green-400 text-sm font-medium">Feedback Type</span>
              <span className="text-red-400 text-sm">●</span>
            </div>
            <div className="relative">
              <button
                className="w-full border border-slate-600 rounded-lg px-4 py-3 flex justify-between items-center bg-slate-700 text-left"
                onClick={() => setIsDropdownOpen(prev => !prev)}
              >
                <span className={feedbackType ? 'text-white' : 'text-slate-400'}>
                  {feedbackType || 'Select feedback type...'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {isDropdownOpen && (
                <div className="absolute bg-slate-700 border border-slate-600 mt-1 w-full rounded-lg shadow-lg z-50">
                  {feedbackTypes.map((type) => (
                    <div
                      key={type}
                      className="px-4 py-3 hover:bg-slate-600 cursor-pointer text-white first:rounded-t-lg last:rounded-b-lg"
                      onClick={() => {
                        setFeedbackType(type);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {type}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detailed Feedback */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-400 font-mono">$</span>
              <span className="text-blue-400 text-sm font-medium">Detailed Feedback</span>
              <span className="text-red-400 text-sm">●</span>
            </div>
            <div className="relative">
              <textarea
                className="w-full border border-slate-600 rounded-lg px-4 py-3 resize-none h-32 bg-slate-700 text-white placeholder-slate-400 font-mono text-sm"
                placeholder="// Type your detailed feedback here..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition font-medium"
            disabled={isSubmitted}
          >
            {isSubmitted ? 'Sent ✅' : <>
              <Send className="w-4 h-4" />
              Submit Feedback
            </>}
          </button>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 mt-4 text-slate-400 text-sm">
            <span>Your feedback helps us improve BookRadio</span>
          </div>
        </div>
      )}
    </div>
  );
}