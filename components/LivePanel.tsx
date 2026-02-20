
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

const LivePanel: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  const startLive = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    // Audio Contexts
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputCtx;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setIsActive(true);
          // Microphone streaming
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            const data = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(data.length);
            for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
            
            const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
            sessionPromise.then(s => s.sendRealtimeInput({
              media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
            }));
          };
          source.connect(processor);
          processor.connect(inputCtx.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          if (msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            const base64 = msg.serverContent.modelTurn.parts[0].inlineData.data;
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            
            // Raw PCM decoding
            const dataInt16 = new Int16Array(bytes.buffer);
            const buffer = outputCtx.createBuffer(1, dataInt16.length, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

            const source = outputCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(outputCtx.destination);
            
            const now = outputCtx.currentTime;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
          }
          if (msg.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onerror: (e) => console.error(e),
        onclose: () => setIsActive(false),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: "You are a spiritual guide and Bible scholar. Respond warmly and helpfully to questions about faith and scripture.",
        outputAudioTranscription: {},
      }
    });

    sessionRef.current = await sessionPromise;
  };

  const stopLive = () => {
    sessionRef.current?.close();
    setIsActive(false);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white/50 rounded-2xl border border-white/20 backdrop-blur-xl h-full min-h-[400px]">
      <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 transition-all duration-1000 ${isActive ? 'bg-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.5)] animate-pulse' : 'bg-slate-200'}`}>
        <svg className={`w-12 h-12 ${isActive ? 'text-white' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold mb-2">{isActive ? 'Listening...' : 'Ready for discussion'}</h2>
      <p className="text-slate-500 mb-8 text-center max-w-md">Talk to EdenBible AI about your faith, biblical history, or specific verses in real-time.</p>

      {!isActive ? (
        <button onClick={startLive} className="px-8 py-3 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
          Start Conversation
        </button>
      ) : (
        <button onClick={stopLive} className="px-8 py-3 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors">
          End Session
        </button>
      )}
    </div>
  );
};

export default LivePanel;
