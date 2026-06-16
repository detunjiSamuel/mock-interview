'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AudioRecorder, useAudioRecorder } from 'react-audio-voice-recorder';
import { useAuth, MAIN_API_URL } from '@/app/AuthContext';
import LoadingSpinner from '@/app/components/common/LoadingSpinner';

interface Question {
  _id: string;
  topic: string;
  text: string;
  video_url: string;
  difficulty: string;
  category: string;
  helpful_tip: string;
  slug: string;
}

interface Feedback {
  _id: string;
  feedback: string;
  audio_transcript: string;
  audio_url: string;
  createdAt: string;
}

export default function QuestionDetailPage() {
  const { isLoggedIn, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  
  const [question, setQuestion] = useState<Question | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);
  
  const recorderControls = useAudioRecorder();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Fetch question data
  useEffect(() => {
    const fetchQuestion = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${MAIN_API_URL}/api/questions/${slug}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch question');
        }
        
        const data = await response.json();
        setQuestion(data.question);
      } catch (err) {
        console.error('Error fetching question:', err);
        setError('Failed to load question. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchQuestion();
  }, [slug]);
  
  // Fetch feedback history if logged in
  useEffect(() => {
    if (isLoggedIn && token && question) {
      fetchFeedbackHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, token, question]);
  
  const fetchFeedbackHistory = async () => {
    try {
      const response = await fetch(`${MAIN_API_URL}/api/questions/${slug}/feedback`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch feedback history');
      }
      
      const data = await response.json();
      setFeedbacks(data.interviews || []);
    } catch (err) {
      console.error('Error fetching feedback history:', err);
    }
  };
  
  const handleAudioComplete = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
  };
  
  const handleRedo = () => {
    setAudioUrl('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };
  
  const handleSubmit = async () => {
    if (!isLoggedIn) {
      router.push('/auth/login');
      return;
    }
    
    if (!recorderControls.recordingBlob) {
      setError('No recording found. Please record your answer first.');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('audio_response', recorderControls.recordingBlob, 'recording.webm');
      formData.append('question_id', slug);
      
      const response = await fetch(`${MAIN_API_URL}/api/submit-recording`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit recording');
      }
      
      const data = await response.json();
      setSubmissionSuccess(true);
      
      // Poll for feedback for this interview
      startPollingForFeedback(data.interview);
    } catch (err) {
      console.error('Error submitting recording:', err);
      setError('Failed to submit recording. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const startPollingForFeedback = (interviewId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${MAIN_API_URL}/api/interviews/${interviewId}/feedback`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch interview feedback');
        }
        
        const data = await response.json();
        
        if (data.interview && data.interview.feedback) {
          // Feedback is available
          clearInterval(pollInterval);
          setSelectedFeedback(data.interview);
          setShowFeedback(true);
          
          // Refresh feedback history
          fetchFeedbackHistory();
        }
      } catch (err) {
        console.error('Error polling for feedback:', err);
      }
    }, 5000); // Poll every 5 seconds
    
    // Clear interval after 2 minutes if no feedback is received
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 120000);
  };
  
  const toggleFeedbackHistory = () => {
    setShowFeedback(!showFeedback);
  };
  
  const viewFeedback = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setShowFeedback(true);
  };
  
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
          {error}
        </div>
        <button
          onClick={() => router.push('/')}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          Back to Questions
        </button>
      </div>
    );
  }
  
  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-gray-700 p-4">Question not found</div>
        <button
          onClick={() => router.push('/')}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          Back to Questions
        </button>
      </div>
    );
  }
  
  return (
    <main className="flex flex-col md:flex-row min-h-screen p-6 gap-8">
      {/* Question Information Section */}
      <section className="md:w-2/5 bg-white rounded-lg shadow-lg p-6 h-fit">
        {question.video_url && (
          <div className="mb-6">
            <video 
              src={question.video_url} 
              controls 
              className="w-full rounded-lg"
            ></video>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-mono text-xl font-bold">{question.topic}</h1>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm capitalize">
              {question.difficulty}
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm capitalize">
              {question.category}
            </span>
          </div>
        </div>
        
        <div className="mb-6">
          <h2 className="font-semibold mb-2">Question:</h2>
          <p className="text-gray-700">{question.text}</p>
        </div>
        
        {question.helpful_tip && (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h2 className="font-semibold mb-2">Helpful Tip:</h2>
            <p className="text-gray-700 text-sm">{question.helpful_tip}</p>
          </div>
        )}
      </section>

      {/* Recording Section */}
      <section className="md:w-3/5 flex flex-col">
        <div className="flex justify-between mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:underline"
          >
            ← Back to Questions
          </button>
          
          <button
            onClick={toggleFeedbackHistory}
            className="text-blue-600 hover:underline"
          >
            {showFeedback ? 'Hide Feedback' : 'View Feedback History'}
          </button>
        </div>
        
        {!showFeedback ? (
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center">
            <h2 className="font-mono text-xl font-bold mb-6 text-center">
              {audioUrl ? 'Review Your Answer' : 'Record Your Answer'}
            </h2>
            
            {!isLoggedIn && (
              <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-6 w-full">
                Please <a href="/auth/login" className="underline">login</a> to save your recording and get feedback.
              </div>
            )}
            
            {submissionSuccess ? (
              <div className="text-center mb-8">
                <div className="text-green-600 text-xl mb-4">
                  Your answer has been submitted successfully!
                </div>
                <p className="text-gray-600 mb-4">
                  {"We're generating feedback for your answer. This might take a minute."}
                </p>
                <LoadingSpinner />
              </div>
            ) : (
              <>
                <div className="w-full max-w-lg mb-8">
                  {audioUrl ? (
                    <div className="flex flex-col items-center">
                      <audio 
                        ref={audioRef}
                        src={audioUrl} 
                        controls 
                        className="w-full mb-4"
                      ></audio>
                      <p className="text-gray-600 text-center mb-6">
                        {"Listen to your answer and submit it for feedback, or re-record if you'd like to try again."}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center w-full mb-4">
                        <AudioRecorder
                          onRecordingComplete={handleAudioComplete}
                          recorderControls={recorderControls}
                          audioTrackConstraints={{
                            noiseSuppression: true,
                            echoCancellation: true,
                          }}
                          downloadOnSavePress={false}
                          showVisualizer={true}
                        />
                        
                        {!recorderControls.isRecording && (
                          <p className="text-gray-600 mt-4 text-center">
                            Click the microphone to start recording your answer
                          </p>
                        )}
                      </div>
                      <p className="text-gray-600 text-center">
                        {"Read the question carefully and prepare your answer. When you're ready, click the microphone to start recording."}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-4">
                  {audioUrl && (
                    <>
                      <button
                        onClick={handleRedo}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                        disabled={submitting}
                      >
                        Re-record
                      </button>
                      <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <LoadingSpinner size="small" color="white" />
                            Submitting...
                          </span>
                        ) : (
                          'Submit for Feedback'
                        )}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex flex-col md:flex-row md:gap-8">
              <div className={`${selectedFeedback ? 'md:w-1/3' : 'w-full'} mb-6 md:mb-0`}>
                <h2 className="font-semibold text-lg mb-4">Feedback History</h2>
                
                {feedbacks.length === 0 ? (
                  <p className="text-gray-600">
                    {"You haven't submitted any answers for this question yet."}
                  </p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {feedbacks.map((feedback) => (
                      <div 
                        key={feedback._id}
                        className={`p-4 rounded-lg cursor-pointer border transition-colors ${
                          selectedFeedback?._id === feedback._id
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                        onClick={() => viewFeedback(feedback)}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">
                            {new Date(feedback.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(feedback.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {feedback.audio_transcript || 'No transcript available'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {selectedFeedback && (
                <div className="md:w-2/3">
                  <h2 className="font-semibold text-lg mb-4">Feedback Details</h2>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h3 className="font-medium mb-2">Your Answer:</h3>
                    <p className="text-gray-700 mb-2">
                      {selectedFeedback.audio_transcript || 'No transcript available'}
                    </p>
                    
                    {selectedFeedback.audio_url && (
                      <audio 
                        src={selectedFeedback.audio_url} 
                        controls 
                        className="w-full mt-2"
                      ></audio>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">AI Feedback:</h3>
                    <div className="prose prose-sm max-w-none">
                      {selectedFeedback.feedback ? (
                        <div className="whitespace-pre-line">
                          {selectedFeedback.feedback}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-4">
                          <p className="text-gray-600 mb-4">
                            Generating feedback for your answer...
                          </p>
                          <LoadingSpinner />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}