import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, Loader2, Database } from 'lucide-react';

const API_BASE = '/api';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await handleAudioSubmit(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputText, type: 'text' };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/query-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputText }),
      });

      const data = await response.json();
      
      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        sqlQuery: data.sql_query,
        data: data.data,
        type: 'text'
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request.',
        type: 'text',
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioSubmit = async (audioBlob) => {
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(`${API_BASE}/query-audio`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        sqlQuery: data.sql_query,
        data: data.data,
        type: 'audio'
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your audio.',
        type: 'audio',
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDataAsTable = (data) => {
    if (!data || data.length === 0) return null;

    const columns = Object.keys(data[0]);

    return (
      <div className="overflow-x-auto mt-2">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              {columns.map(column => (
                <th key={column} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {columns.map(column => (
                  <td key={column} className="px-4 py-2 text-sm text-gray-900 border-b">
                    {String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SQL Chatbot</h1>
                <p className="text-sm text-gray-600">Ask questions about your database</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Available tables: users, products, orders, order_items, product_sales
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <Database className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Start a conversation with your database</p>
              <p className="text-sm mt-2">Try asking: "Show me the top 5 products by revenue"</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : message.isError
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  {message.type === 'audio' && (
                    <span className="text-xs opacity-75 bg-black bg-opacity-20 px-2 py-1 rounded">
                      🎤 Voice
                    </span>
                  )}
                </div>
                
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {message.sqlQuery && (
                  <div className="mt-3 pt-3 border-t border-gray-200 border-opacity-30">
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium opacity-75 hover:opacity-100">
                        View SQL Query
                      </summary>
                      <pre className="mt-2 p-3 bg-black bg-opacity-20 rounded text-xs overflow-x-auto">
                        {message.sqlQuery}
                      </pre>
                    </details>
                  </div>
                )}
                
                {message.data && formatDataAsTable(message.data)}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none px-4 py-3 max-w-3xl">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing your query...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleTextSubmit} className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask a question about your data..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading || isRecording}
              />
            </div>
            
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading || isRecording}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>

            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={`px-6 py-3 rounded-lg flex items-center space-x-2 ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  <span>Voice</span>
                </>
              )}
            </button>
          </form>
          
          {isRecording && (
            <div className="text-center mt-2">
              <div className="inline-flex items-center space-x-2 text-red-600">
                <div className="h-2 w-2 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-sm">Recording...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;