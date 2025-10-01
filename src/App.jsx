import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const login = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        username,
        password
      });
      setToken(response.data.access_token);
      setIsAuthenticated(true);
      localStorage.setItem('token', response.data.access_token);
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${token || localStorage.getItem('token')}`
    };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        await sendAudioToBackend(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const sendAudioToBackend = async (audioBlob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('session_id', sessionId);
    formData.append('role', 'user');

    try {
      const response = await axios.post(`${API_BASE}/transcribe`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          ...getAuthHeaders()
        },
      });

      setIsTranscribing(false);
      
      const transcriptMessage = {
        id: Date.now(),
        role: 'user',
        type: 'audio_transcript',
        content: response.data.text,
        confidence: response.data.confidence,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, transcriptMessage]);
      await sendQuery(response.data.text);
    } catch (error) {
      console.error('Transcription error:', error);
      setIsTranscribing(false);
      alert('Transcription failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  const sendQuery = async (text) => {
    if (!text.trim()) return;

    setIsLoading(true);
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      type: 'text',
      content: text,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('role', 'user');
      formData.append('text', text);

      const response = await axios.post(`${API_BASE}/query`, formData, {
        headers: getAuthHeaders()
      });
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        type: 'response',
        content: response.data.summary,
        results: response.data.result_table,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Query error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        type: 'error',
        content: 'Sorry, I encountered an error processing your query: ' + 
                (error.response?.data?.detail || error.message),
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuery(inputText);
  };

  const formatResultsTable = (results) => {
    if (!results || results.length === 0) return null;

    const headers = Object.keys(results[0]);
    
    return (
      <div className="results-table">
        <h4>Query Results ({results.length} rows)</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {headers.map(header => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 10).map((row, index) => (
                <tr key={index}>
                  {headers.map(header => (
                    <td key={header}>{String(row[header] || '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {results.length > 10 && (
            <div className="table-footer">
              Showing first 10 of {results.length} rows
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <form onSubmit={login} className="login-form">
          <h2>Database Chatbot Login</h2>
          <div>
            <label>Username:</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin or user"
              required
            />
          </div>
          <div>
            <label>Password:</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="admin123 or user123"
              required
            />
          </div>
          <button type="submit">Login</button>
          <div className="login-hint">
            <p>Demo credentials:</p>
            <p>Admin: admin / admin123</p>
            <p>User: user / user123</p>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Database Chatbot</h1>
        <p>Ask questions about your data using natural language</p>
        <button onClick={() => {
          setIsAuthenticated(false);
          localStorage.removeItem('token');
        }} className="logout-btn">
          Logout
        </button>
      </header>

      <div className="chat-container">
        <div className="messages-container">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-header">
                <span className="role">{message.role}</span>
                <span className="timestamp">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {message.type === 'audio_transcript' && (
                  <div className="transcript-indicator">
                    🎤 Transcript ({(message.confidence * 100).toFixed(1)}% confidence)
                  </div>
                )}
                {message.content}
                
                {message.results && formatResultsTable(message.results)}
              </div>
            </div>
          ))}
          
          {isTranscribing && (
            <div className="message assistant">
              <div className="message-content transcribing">
                🎤 Transcribing audio...
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-content loading">
                ⏳ Processing your query...
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-container">
          <div className="input-group">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask a question about your data..."
              disabled={isLoading || isTranscribing}
            />
            
            <button
              type="button"
              className={`record-button ${isRecording ? 'recording' : ''}`}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={isLoading || isTranscribing}
            >
              🎤 {isRecording ? 'Recording...' : 'Hold to Record'}
            </button>
            
            <button 
              type="submit" 
              disabled={!inputText.trim() || isLoading || isTranscribing}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;