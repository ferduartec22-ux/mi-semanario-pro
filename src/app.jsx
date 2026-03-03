import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  Calendar, Plus, Trash2, CheckCircle2, Circle, Clock, AlertCircle, 
  Sun, Moon, Timer, ArrowDownAZ, Layout, ArrowRight, Pencil, X, 
  Save, Sparkles, Wand2, BrainCircuit, Loader2, Settings2, 
  Columns2, Rows2, MousePointer2, Palette, Type
} from 'lucide-react';

// --- CONFIGURACIÓN GLOBAL DE FIREBASE ---
// Estas variables se obtienen del entorno de ejecución de la plataforma
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'planner-pro-app';
const apiKey = ""; // La clave de API de Gemini se maneja internamente

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Definición de Temas Visuales
const THEMES = {
  indigo: { name: 'Índigo', primary: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-600', ring: 'focus:ring-indigo-500', shadow: 'shadow-indigo-500/20' },
  emerald: { name: 'Esmeralda', primary: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600', ring: 'focus:ring-emerald-500', shadow: 'shadow-emerald-500/20' },
  rose: { name: 'Rosa', primary: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-600', ring: 'focus:ring-rose-500', shadow: 'shadow-rose-500/20' },
  amber: { name: 'Ámbar', primary: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-600', ring: 'focus:ring-amber-500', shadow: 'shadow-amber-500/20' }
};

const PRIORITIES = {
  high: { label: 'Alta', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  medium: { label: 'Media', color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  low: { label: 'Baja', color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' }
};

const App = () => {
  // --- ESTADOS DE LA APLICACIÓN ---
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState({ Lunes: [], Martes: [], Miércoles: [], Jueves: [], Viernes: [], Sábado: [], Domingo: [] });
  const [settings, setSettings] = useState({
    title: "MI PLANNER ESTRATÉGICO",
    theme: 'indigo',
    viewMode: 'grid', // Puede ser 'grid', 'stack' o 'focus'
    formPosition: 'top', // Puede ser 'top' o 'bottom'
    focusDay: 'Lunes'
  });

  // --- ESTADOS DE INTERFAZ Y FORMULARIO ---
  const [newTaskText, setNewTaskText] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedDay, setSelectedDay] = useState('Lunes');
  const [selectedPriority, setSelectedPriority] = useState('medium');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isTitleEditing, setIsTitleEditing] = useState(false);

  // --- LÓGICA DE PERSISTENCIA (FIREBASE) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { console.error("Error Autenticación:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'plannerData', 'main');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tasks) setTasks(data.tasks);
        if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
      }
    });

    return () => unsubscribe();
  }, [user]);

  const saveData = async (updatedTasks, updatedSettings) => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'plannerData', 'main');
    try {
      await setDoc(docRef, { 
        tasks: updatedTasks || tasks, 
        settings: updatedSettings || settings,
        lastUpdated: new Date() 
      }, { merge: true });
    } catch (err) { console.error("Error al guardar:", err); }
  };

  // --- LÓGICA DE INTELIGENCIA ARTIFICIAL (GEMINI) ---
  const callGemini = async (prompt, systemPrompt = "", isJson = false) => {
    let delay = 1000;
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: isJson ? { responseMimeType: "application/json" } : {}
          })
        });
        if (!response.ok) throw new Error('API Error');
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (error) {
        if (i === 4) throw error;
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  };

  const generateAiPlan = async () => {
    if (!aiGoal.trim()) return;
    setIsAiLoading(true);
    const systemPrompt = "Eres un experto en productividad. Genera un plan semanal en formato JSON con las llaves Lunes a Domingo. Cada día es un array de tareas: {text, startTime, endTime, priority}.";
    try {
      const text = await callGemini(`Crea un plan para: ${aiGoal}`, systemPrompt, true);
      const generated = JSON.parse(text);
      const newTasks = { ...tasks };
      Object.keys(generated).forEach(day => {
        if (newTasks[day]) {
          const formatted = generated[day].map(t => ({ ...t, id: Math.random() + Date.now(), completed: false, createdAt: 'IA ✨' }));
          newTasks[day] = [...newTasks[day], ...formatted].sort((a, b) => a.startTime.localeCompare(b.startTime));
        }
      });
      setTasks(newTasks);
      saveData(newTasks, null);
      setIsAiModalOpen(false);
    } catch (err) { console.error("AI Error:", err); }
    finally { setIsAiLoading(false); }
  };

  // --- MANEJO DE TAREAS ---
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTasks = { ...tasks };
    if (editingTaskId) {
      newTasks[editingDay] = newTasks[editingDay].filter(t => t.id !== editingTaskId);
      const updated = { id: editingTaskId, text: newTaskText, startTime, endTime, completed: false, priority: selectedPriority };
      newTasks[selectedDay] = [...newTasks[selectedDay], updated].sort((a, b) => a.startTime.localeCompare(b.startTime));
      setEditingTaskId(null);
    } else {
      const newTask = { id: Date.now(), text: newTaskText, startTime, endTime, completed: false, priority: selectedPriority, createdAt: new Date().toISOString() };
      newTasks[selectedDay] = [...newTasks[selectedDay], newTask].sort((a, b) => a.startTime.localeCompare(b.startTime));
      setNewTaskText('');
    }
    setTasks(newTasks);
    saveData(newTasks, null);
  };

  const deleteT = (day, id) => {
    const newTasks = { ...tasks, [day]: tasks[day].filter(t => t.id !== id) };
    setTasks(newTasks);
    saveData(newTasks, null);
  };

  const toggleT = (day, id) => {
    const newTasks = { ...tasks, [day]: tasks[day].map(t => t.id === id ? { ...t, completed: !t.completed } : t) };
    setTasks(newTasks);
    saveData(newTasks, null);
  };

  const currentTheme = THEMES[settings.theme] || THEMES.indigo;

  return (
    <div className={`min-h-screen transition-all duration-700 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Cabecera Principal */}
      <header className={`p-6 border-b sticky top-0 z-50 backdrop-blur-xl ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/80'} shadow-sm`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`${currentTheme.primary} p-4 rounded-2xl shadow-2xl rotate-3`}>
              <Calendar className="text-white w-8 h-8" />
            </div>
            <div>
              {isTitleEditing ? (
                <input autoFocus onBlur={() => setIsTitleEditing(false)} value={settings.title} onChange={(e) => { const s = {...settings, title: e.target.value.toUpperCase()}; setSettings(s); saveData(null, s); }} className="bg-transparent border-b-2 border-indigo-500 outline-none text-3xl font-black uppercase italic w-full" />
              ) : (
                <h1 onClick={() => setIsTitleEditing(true)} className="text-3xl font-black tracking-tighter uppercase italic cursor-pointer hover:opacity-70 transition-opacity">
                  {settings.title} <span className={currentTheme.text}>PRO</span>
                </h1>
              )}
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setIsAiModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl text-sm font-black shadow-lg hover:scale-105 transition-all">
              <Sparkles size={18} /> ✨ IA
            </button>
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`p-4 rounded-2xl transition-all ${isSettingsOpen ? currentTheme.primary + ' text-white' : 'bg-white shadow-md border border-slate-100'}`}>
              <Settings2 size={24} />
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-4 rounded-2xl transition-all ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-white shadow-md'}`}>
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Modal de IA */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className={`w-full max-w-lg p-8 rounded-[2.5rem] border-4 ${isDarkMode ? 'bg-slate-900 border-indigo-500/30' : 'bg-white border-white shadow-2xl'}`}>
            <h3 className="text-xl font-black mb-4">✨ ASISTENTE DE PLANIFICACIÓN</h3>
            <textarea value={aiGoal} onChange={(e) => setAiGoal(e.target.value)} placeholder="Ej: Ayúdame a organizar mi semana de entrenamiento para un maratón..." className={`w-full h-32 p-4 rounded-2xl border-2 mb-6 outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-transparent'}`} />
            <button onClick={generateAiPlan} disabled={isAiLoading} className="w-full bg-indigo-600 py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2">
              {isAiLoading ? <Loader2 className="animate-spin" /> : <Wand2 />} GENERAR PLAN
            </button>
            <button onClick={() => setIsAiModalOpen(false)} className="w-full mt-2 text-xs opacity-50">Cancelar</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        
        {/* Formulario de Entrada */}
        <section className={`p-8 rounded-[2.5rem] shadow-2xl border-4 transition-all mb-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-white'}`}>
          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4">
              <label className="text-[10px] font-black uppercase text-indigo-500 mb-2 block">Actividad</label>
              <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Nueva tarea..." className={`w-full px-6 py-4 rounded-2xl border-2 outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-transparent focus:bg-white'}`} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase text-indigo-500 mb-2 block">Día</label>
              <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="w-full px-4 py-4 rounded-2xl border-2 font-bold bg-transparent">
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] font-black uppercase text-indigo-500 mb-2 block">Horario</label>
              <div className="flex items-center gap-2">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="flex-1 p-2 rounded-xl border-2 text-center bg-transparent" />
                <ArrowRight size={14} />
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="flex-1 p-2 rounded-xl border-2 text-center bg-transparent" />
              </div>
            </div>
            <div className="md:col-span-3 flex items-end">
              <button type="submit" className={`w-full text-white font-black py-4 rounded-2xl transition-all ${currentTheme.primary} shadow-lg`}>
                {editingTaskId ? 'GUARDAR' : 'AÑADIR'}
              </button>
            </div>
          </form>
        </section>

        {/* Tablero Semanal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6">
          {DAYS.map(day => (
            <div key={day} className="flex flex-col gap-4">
              <div className={`p-4 rounded-2xl border-t-4 ${isDarkMode ? 'bg-slate-900 border-indigo-500' : 'bg-white border-indigo-600 shadow-md'}`}>
                <h3 className="font-black text-lg uppercase">{day.substring(0,3)}</h3>
                <div className="h-2 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(tasks[day]?.filter(t => t.completed).length / (tasks[day]?.length || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div className="space-y-3">
                {tasks[day]?.map(task => (
                  <div key={task.id} className={`p-4 rounded-xl border-2 transition-all group ${task.completed ? 'opacity-40 grayscale' : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">{task.startTime} - {task.endTime}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(day, task)} className="p-1 hover:text-amber-500"><Pencil size={14}/></button>
                        <button onClick={() => deleteT(day, task.id)} className="p-1 hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <button onClick={() => toggleT(day, task.id)} className={task.completed ? 'text-green-500' : 'text-slate-300'}>
                        {task.completed ? <CheckCircle2 size={18}/> : <Circle size={18}/>}
                      </button>
                      <p className={`text-xs font-bold leading-tight ${task.completed ? 'line-through' : ''}`}>{task.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="mt-20 p-8 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.5em]">
        Schedule Master ✨ Pro Edition
      </footer>
    </div>
  );
};

export default App;
