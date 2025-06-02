import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Play, Pause, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const AudioTranscriptionApp = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [transcriptionData, setTranscriptionData] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false
        } 
      });
      streamRef.current = stream;
      
      // Try to use WAV format if supported, otherwise fall back to webm
      let mimeType = 'audio/wav';
      if (!MediaRecorder.isTypeSupported('audio/wav')) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
          mimeType = 'audio/webm;codecs=pcm';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else {
          mimeType = 'audio/mp4';
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const originalBlob = new Blob(chunks, { type: mimeType });
        
        // Convert to WAV format if not already WAV
        if (mimeType === 'audio/wav') {
          setRecordedBlob(originalBlob);
        } else {
          try {
            const wavBlob = await convertToWav(originalBlob);
            setRecordedBlob(wavBlob);
          } catch (convertError) {
            console.warn('WAV conversion failed, using original format:', convertError);
            setRecordedBlob(originalBlob);
          }
        }
        setTranscriptionData(null);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(intervalRef.current);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const playAudio = () => {
    if (recordedBlob && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Convert uploaded file to WAV if it's not already
      if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
        setRecordedBlob(file);
      } else {
        try {
          const wavBlob = await convertToWav(file);
          setRecordedBlob(wavBlob);
        } catch (convertError) {
          console.warn('WAV conversion failed, using original format:', convertError);
          setRecordedBlob(file);
        }
      }
      setTranscriptionData(null);
      setError('');
    }
  };

  const transcribeAudio = async () => {
    if (!recordedBlob) return;
    
    setIsTranscribing(true);
    setError('');
    
    const formData = new FormData();
    // Ensure the file is sent with .wav extension
    const fileName = recordedBlob.name || 'audio.wav';
    const wavFileName = fileName.toLowerCase().endsWith('.wav') ? fileName : 'audio.wav';
    formData.append('file', recordedBlob, wavFileName);
    
    try {
      const response = await fetch(`${apiUrl}/transcribe`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Transcription response:', data); // Debug log
      setTranscriptionData(data);

    } catch (err) {
      setError(`Transcription failed: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const getFormattedText = () => {
    if (!transcriptionData) return '';
    
    // Handle nested text structure
    if (transcriptionData.formatted_transcription?.text) {
      if (typeof transcriptionData.formatted_transcription.text === 'string') {
        return transcriptionData.formatted_transcription.text;
      } else if (transcriptionData.formatted_transcription.text.text) {
        return transcriptionData.formatted_transcription.text.text;
      } else if (transcriptionData.formatted_transcription.text.raw_text) {
        return transcriptionData.formatted_transcription.text.raw_text;
      }
    }
    return transcriptionData.raw_transcription || '';
  };

  const downloadTranscription = () => {
    if (!transcriptionData) return;
    
    const text = getFormattedText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setRecordedBlob(null);
    setTranscriptionData(null);
    setError('');
    setRecordingTime(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // WAV conversion function using Web Audio API
  const convertToWav = async (audioBlob) => {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Convert to WAV format
          const wavArrayBuffer = audioBufferToWav(audioBuffer);
          const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
          
          resolve(wavBlob);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read audio file'));
      reader.readAsArrayBuffer(audioBlob);
    });
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const numberOfChannels = buffer.numberOfChannels;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // Audio format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  };

  return (
    <div style={styles.container}>
      <style>{cssStyles}</style>
      <div style={styles.maxWidth}>
        <div style={styles.header}>
           <h1 style={styles.title}>Automated Meeting Transcription and Summary Assistant</h1>
          <p style={styles.subtitle}>Record audio or upload files to get AI-powered transcriptions</p>
        </div>

        {/* API URL Configuration */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>API Configuration</h2>
          <div style={styles.apiConfig}>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              style={styles.input}
              placeholder="API URL (e.g., https://your-api.com)"
            />
            <button
              onClick={() => setApiUrl('http://localhost:8000')}
              style={styles.resetButton}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Recording Section */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Record Audio</h2>
          
          <div style={styles.recordingCenter}>
            {isRecording && (
              <div style={styles.timer}>
                {formatTime(recordingTime)}
              </div>
            )}
            
            <div style={styles.buttonGroup}>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  style={styles.recordButton}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                >
                  <Mic size={20} />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  style={styles.stopButton}
                  className="pulse"
                >
                  <Square size={20} />
                  Stop Recording
                </button>
              )}
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Upload Audio File</h2>
          
          <div style={styles.uploadWrapper}>
            <label style={styles.uploadLabel}>
              <div style={styles.uploadContent}>
                <Upload size={32} color="#6b7280" />
                <p style={styles.uploadText}>
                  <span style={styles.uploadBold}>Click to upload</span> audio file
                </p>
                <p style={styles.uploadSmall}>WAV, MP3, M4A, etc.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                style={styles.hiddenInput}
              />
            </label>
          </div>
        </div>

        {/* Audio Player */}
        {recordedBlob && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Audio Preview</h2>
            
            <div style={styles.playerControls}>
              <button
                onClick={playAudio}
                style={styles.playButton}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              
              <button
                onClick={transcribeAudio}
                disabled={isTranscribing}
                style={{
                  ...styles.transcribeButton,
                  ...(isTranscribing ? styles.disabledButton : {})
                }}
                onMouseEnter={(e) => !isTranscribing && (e.target.style.backgroundColor = '#16a34a')}
                onMouseLeave={(e) => !isTranscribing && (e.target.style.backgroundColor = '#22c55e')}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Transcribing...
                  </>
                ) : (
                  'Transcribe Audio'
                )}
              </button>
              
              <button
                onClick={clearAll}
                style={styles.clearButton}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7280'}
              >
                Clear All
              </button>
            </div>
            
            <audio
              ref={audioRef}
              src={recordedBlob ? URL.createObjectURL(recordedBlob) : ''}
              onEnded={() => setIsPlaying(false)}
              style={styles.audioPlayer}
              controls
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={styles.errorCard}>
            <div style={styles.errorHeader}>
              <AlertCircle size={20} />
              <span style={styles.errorTitle}>Error</span>
            </div>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {/* Transcription Results */}
        {transcriptionData && (
          <div style={styles.card}>
            <div style={styles.resultsHeader}>
              <div style={styles.successHeader}>
                <CheckCircle size={20} color="#22c55e" />
                <h2 style={styles.cardTitle}>Transcription Results</h2>
              </div>
              <button
                onClick={downloadTranscription}
                style={styles.downloadButton}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
              >
                <Download size={16} />
                Download
              </button>
            </div>
            
            {/* Show formatted transcription if available */}
            {transcriptionData.formatted_transcription?.text && (
              <div style={styles.transcriptionSection}>
                <h3 style={styles.sectionTitle}>Formatted Transcription:</h3>
                <div style={styles.transcriptionBox}>
                  <p style={styles.transcriptionText}>
                    {getFormattedText()}
                  </p>
                </div>
              </div>
            )}
            
            {/* Always show raw transcription */}
            <div>
              <h3 style={styles.sectionTitle}>Raw Transcription:</h3>
              <div style={styles.transcriptionBox}>
                <p style={styles.rawTranscriptionText}>
                  {transcriptionData.raw_transcription || 'No raw transcription available'}
                </p>
              </div>
            </div>

            {/* Debug section - can be removed in production */}
            <details style={{ marginTop: '16px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '500', color: '#6b7280' }}>
                Debug: Raw API Response
              </summary>
              <pre style={{ 
                backgroundColor: '#f3f4f6', 
                padding: '12px', 
                borderRadius: '4px', 
                fontSize: '12px',
                overflow: 'auto',
                marginTop: '8px'
              }}>
                {JSON.stringify(transcriptionData, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #faf5ff 0%, #eff6ff 100%)',
    padding: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  maxWidth: {
    maxWidth: '896px',
    margin: '0 auto'
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px'
  },
  title: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '8px',
    margin: '0 0 8px 0'
  },
  subtitle: {
    color: '#6b7280',
    margin: 0
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    padding: '24px',
    marginBottom: '24px'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    margin: '0 0 16px 0'
  },
  apiConfig: {
    display: 'flex',
    gap: '8px'
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    fontSize: '14px'
  },
  resetButton: {
    padding: '8px 16px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  recordingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px'
  },
  timer: {
    fontSize: '32px',
    fontFamily: 'monospace',
    color: '#dc2626',
    fontWeight: 'bold'
  },
  buttonGroup: {
    display: 'flex',
    gap: '16px'
  },
  recordButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    transition: 'background-color 0.2s'
  },
  stopButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#4b5563',
    color: 'white',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  },
  uploadWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  uploadLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '128px',
    border: '2px dashed #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: '#f9fafb',
    transition: 'background-color 0.2s'
  },
  uploadContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 24px'
  },
  uploadText: {
    marginBottom: '8px',
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center'
  },
  uploadBold: {
    fontWeight: '600'
  },
  uploadSmall: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0
  },
  hiddenInput: {
    display: 'none'
  },
  playerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  playButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  },
  transcribeButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed'
  },
  clearButton: {
    padding: '8px 16px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  },
  audioPlayer: {
    width: '100%',
    marginTop: '16px'
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px'
  },
  errorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#b91c1c'
  },
  errorTitle: {
    fontWeight: '500'
  },
  errorText: {
    color: '#dc2626',
    marginTop: '4px',
    margin: '4px 0 0 0'
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px'
  },
  successHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  downloadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  },
  transcriptionSection: {
    marginBottom: '16px'
  },
  sectionTitle: {
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px',
    fontSize: '14px',
    margin: '0 0 8px 0'
  },
  transcriptionBox: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '6px',
    border: '1px solid #e5e7eb'
  },
  transcriptionText: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    margin: 0
  },
  rawTranscriptionText: {
    whiteSpace: 'pre-wrap',
    fontSize: '14px',
    color: '#4b5563',
    margin: 0
  }
};

const cssStyles = `
  .pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: .5;
    }
  }
  
  .spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  .uploadLabel:hover {
    background-color: #f3f4f6 !important;
  }
`;

export default AudioTranscriptionApp;