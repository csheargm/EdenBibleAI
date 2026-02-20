
import React, { useState, useEffect, useCallback } from 'react';
import { BibleVerse, Annotation, UserSettings, AppTab, ChatMessage } from './types';
import { INITIAL_VERSES, VIBE_PROMPTS } from './constants';
import { geminiService } from './services/geminiService';
import CanvasOverlay from './components/CanvasOverlay';
import LivePanel from './components/LivePanel';

const App: React.FC = () => {
  const [verses] = useState<BibleVerse[]>(INITIAL_VERSES);
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.READER);
  const [settings, setSettings] = useState<UserSettings>({
    language: 'both',
    fontSize: 18,
    theme: 'light',
    vibeStyles: ''
  });
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // Load from "DB" (LocalStorage)
  useEffect(() => {
    const savedAnn = localStorage.getItem('edenbible_annotations');
    if (savedAnn) setAnnotations(JSON.parse(savedAnn));
    const savedSet = localStorage.getItem('edenbible_settings');
    if (savedSet) setSettings(JSON.parse(savedSet));
  }, []);

  const saveToLocal = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const handleAnnotationSave = (verseId: string, dataUrl: string) => {
    const newAnn = { ...annotations, [verseId]: dataUrl };
    setAnnotations(newAnn);
    saveToLocal('edenbible_annotations', newAnn);
  };

  const handleVibeCoding = async (vibePrompt: string) => {
    setIsGenerating(true);
    try {
      const prompt = `Based on the vibe: "${vibePrompt}", provide a JSON list of Tailwind utility classes for the "main_container", "verse_text", "sidebar", and "header". Output ONLY valid JSON like: {"main_container": "bg-amber-50", "verse_text": "text-slate-800 italic", "header": "bg-amber-100 border-b border-amber-200"}`;
      const response = await geminiService.studyVerse(prompt);
      const styles = JSON.parse(response.text.replace(/```json|```/g, ''));
      setSettings(prev => ({ ...prev, vibeStyles: styles }));
      saveToLocal('edenbible_settings', { ...settings, vibeStyles: styles });
    } catch (err) {
      console.error("Vibe coding failed", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: inputMsg };
    setChatHistory(prev => [...prev, userMsg]);
    setInputMsg('');
    setIsGenerating(true);

    try {
      // Logic routing: if it looks like a generation request, use the media engine
      if (inputMsg.toLowerCase().includes('generate image') || inputMsg.toLowerCase().includes('imagine')) {
        const url = await geminiService.generateSpiritualImage(inputMsg);
        setMediaPreview(url);
        setChatHistory(prev => [...prev, { role: 'model', text: 'I have generated a spiritual visualization for you.' }]);
      } else if (inputMsg.toLowerCase().includes('deeply') || inputMsg.toLowerCase().includes('think about')) {
        const result = await geminiService.deepTheology(inputMsg);
        setChatHistory(prev => [...prev, { role: 'model', text: result, isThinking: true }]);
      } else {
        const result = await geminiService.studyVerse(inputMsg, true);
        setChatHistory(prev => [...prev, { role: 'model', text: result.text, groundingLinks: result.links }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'model', text: "Forgive me, I encountered an error in my reflection." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const playTTS = async (text: string) => {
    try {
      const source = await geminiService.textToSpeech(text);
      source.start();
    } catch (err) {
      console.error("TTS failed", err);
    }
  };

  const getStyle = (key: string) => (settings.vibeStyles as any)?.[key] || '';

  return (
    <div className={`flex h-screen overflow-hidden ${getStyle('main_container') || 'bg-slate-50'}`}>
      {/* Sidebar */}
      <nav className={`w-20 md:w-64 flex flex-col items-center py-8 gap-6 transition-all border-r border-slate-200 ${getStyle('sidebar') || 'bg-white'}`}>
        <div className="flex items-center gap-2 mb-8 px-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">E</div>
          <span className="hidden md:block text-xl font-serif font-bold text-slate-800">EdenBible</span>
        </div>
        
        {[
          { id: AppTab.READER, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253', label: 'Reader' },
          { id: AppTab.STUDY, icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', label: 'AI Study' },
          { id: AppTab.LIVE, icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', label: 'Live' },
          { id: AppTab.MEDIA, icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Media' },
          { id: AppTab.VIBE, icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', label: 'Vibe' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-12 h-12 md:w-56 md:h-12 flex items-center justify-center md:justify-start md:px-4 rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
            <span className="hidden md:block ml-3 font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className={`h-16 flex items-center justify-between px-6 transition-all ${getStyle('header') || 'bg-white border-b border-slate-200'}`}>
          <h1 className="text-lg font-semibold text-slate-800">
            {activeTab === AppTab.READER && 'Daily Scripture'}
            {activeTab === AppTab.STUDY && 'Divine Intelligence'}
            {activeTab === AppTab.LIVE && 'Spiritual Connection'}
            {activeTab === AppTab.MEDIA && 'Media Sanctuary'}
            {activeTab === AppTab.VIBE && 'Vibe Studio'}
          </h1>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${isDrawingMode ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'}`}
             >
                {isDrawingMode ? 'Writing: ON' : 'Pencil Off'}
             </button>
             <div className="flex bg-slate-100 rounded-full p-1">
                <button onClick={() => setSettings(s => ({...s, language: 'en'}))} className={`px-3 py-1 rounded-full text-xs transition-all ${settings.language === 'en' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>EN</button>
                <button onClick={() => setSettings(s => ({...s, language: 'zh'}))} className={`px-3 py-1 rounded-full text-xs transition-all ${settings.language === 'zh' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>CN</button>
                <button onClick={() => setSettings(s => ({...s, language: 'both'}))} className={`px-3 py-1 rounded-full text-xs transition-all ${settings.language === 'both' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Both</button>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12">
          {activeTab === AppTab.READER && (
            <div className="max-w-3xl mx-auto space-y-12 pb-32">
              {verses.map(v => (
                <div key={v.id} className="relative group">
                  <div className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => playTTS(v.textEn)} className="p-1 hover:text-indigo-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg></button>
                  </div>
                  <div className={`p-6 rounded-2xl relative transition-all ${getStyle('verse_text') || 'hover:bg-white hover:shadow-xl hover:shadow-slate-200/50'}`}>
                    <CanvasOverlay 
                        isVisible={isDrawingMode}
                        initialData={annotations[v.id]}
                        onSave={(data) => handleAnnotationSave(v.id, data)}
                    />
                    <div className="text-xs font-bold text-indigo-500 mb-2 uppercase tracking-widest">{v.book} {v.chapter}:{v.verse}</div>
                    {(settings.language === 'en' || settings.language === 'both') && (
                      <p className="text-2xl font-serif text-slate-800 leading-relaxed mb-4">{v.textEn}</p>
                    )}
                    {(settings.language === 'zh' || settings.language === 'both') && (
                      <p className="text-2xl font-sans text-slate-800 leading-relaxed mb-4">{v.textZh}</p>
                    )}
                    {!isDrawingMode && annotations[v.id] && (
                        <img src={annotations[v.id]} className="max-h-32 opacity-80 pointer-events-none" alt="Annotation" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === AppTab.STUDY && (
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              <div className="flex-1 space-y-6 mb-8">
                {chatHistory.length === 0 && (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <h2 className="text-xl font-bold">How can I assist your study today?</h2>
                    <p className="text-slate-500 mt-2">Ask about historical context, original Greek/Hebrew meanings, or thematic cross-references.</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white shadow-sm border border-slate-100'}`}>
                      {msg.isThinking && <div className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold mb-1">Deep Reflection Active</div>}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.groundingLinks && (
                        <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                           {msg.groundingLinks.map((link, j) => (
                             <a key={j} href={link.uri} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hover:underline">{link.title}</a>
                           ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex justify-start">
                    <div className="bg-white shadow-sm border border-slate-100 p-4 rounded-2xl flex gap-1 items-center">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={sendMessage} className="sticky bottom-0 bg-white/80 backdrop-blur border border-slate-200 p-2 rounded-2xl shadow-xl flex gap-2">
                <input
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  placeholder="Ask a question or 'Generate image of...'"
                  className="flex-1 bg-transparent px-4 py-2 outline-none"
                />
                <button type="submit" disabled={isGenerating} className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          )}

          {activeTab === AppTab.LIVE && (
            <div className="max-w-4xl mx-auto h-full flex items-center justify-center">
              <LivePanel />
            </div>
          )}

          {activeTab === AppTab.MEDIA && (
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
               <div className="bg-white p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="text-lg font-bold">Bible Media Studio</h3>
                  <p className="text-slate-500 text-sm">Create visual interpretations of scriptures using Veo Video and Pro Image models.</p>
                  
                  <div className="space-y-4 pt-4">
                    <button onClick={() => setInputMsg('Generate an oil painting style image of the Garden of Eden')} className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 text-sm transition-all">"Genesis: Garden of Eden in oil painting"</button>
                    <button onClick={() => setInputMsg('Create a video of waves calming as Jesus speaks')} className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 text-sm transition-all">"Mark 4: Calming the storm video"</button>
                  </div>

                  <div className="pt-6">
                    <button 
                        onClick={async () => {
                            if (!inputMsg) return;
                            setIsGenerating(true);
                            try {
                                const url = await geminiService.generateBibleVideo(inputMsg);
                                setMediaPreview(url);
                            } catch(e) { console.error(e); }
                            finally { setIsGenerating(false); }
                        }}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
                        disabled={isGenerating}
                    >
                        {isGenerating ? 'Ascending...' : 'Generate Veo Video'}
                    </button>
                  </div>
               </div>

               <div className="bg-slate-200 rounded-2xl flex items-center justify-center overflow-hidden min-h-[300px] relative">
                  {isGenerating ? (
                    <div className="text-center space-y-4 p-8">
                       <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                       <p className="text-sm font-medium animate-pulse">Engaging Divine Intelligence...</p>
                    </div>
                  ) : mediaPreview ? (
                    mediaPreview.startsWith('blob:') ? (
                        <video src={mediaPreview} controls autoPlay className="w-full h-full object-cover" />
                    ) : (
                        <img src={mediaPreview} className="w-full h-full object-cover" alt="Generated" />
                    )
                  ) : (
                    <p className="text-slate-400 font-medium">Media Preview Area</p>
                  )}
                  {mediaPreview && (
                      <button onClick={() => setMediaPreview(null)} className="absolute top-4 right-4 bg-white/50 backdrop-blur rounded-full p-2 hover:bg-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                  )}
               </div>
            </div>
          )}

          {activeTab === AppTab.VIBE && (
            <div className="max-w-2xl mx-auto space-y-8">
               <div className="text-center">
                  <h2 className="text-3xl font-bold">Vibe Customization</h2>
                  <p className="text-slate-500 mt-2">Describe the atmosphere you want for your Bible study, and our AI will style the app.</p>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {VIBE_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => handleVibeCoding(p)}
                      disabled={isGenerating}
                      className="p-6 rounded-2xl bg-white border border-slate-100 text-left hover:border-indigo-600 hover:shadow-lg transition-all group disabled:opacity-50"
                    >
                      <p className="font-medium text-slate-800 group-hover:text-indigo-600">{p}</p>
                    </button>
                  ))}
               </div>

               <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-800 mb-2">Custom Vibe Prompt</h4>
                  <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="e.g. A serene mountain morning..." 
                        className="flex-1 px-4 py-2 rounded-xl border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                        onKeyDown={(e) => { if(e.key === 'Enter') handleVibeCoding((e.target as HTMLInputElement).value) }}
                    />
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* Persistence Floating Status */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2">
        <div className="bg-white/80 backdrop-blur border border-slate-200 px-4 py-2 rounded-full shadow-lg text-xs font-bold text-slate-500 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Cloud Synced (Local)
        </div>
      </div>
    </div>
  );
};

export default App;
