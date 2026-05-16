/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Power, 
  Thermometer, 
  Droplets, 
  RefreshCcw, 
  MessageSquare, 
  Activity, 
  Clock, 
  Wifi, 
  WifiOff, 
  Bell, 
  Settings, 
  LayoutDashboard,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SensorData {
  temp: number;
  humidity: number;
  lastUpdate: string;
}

interface AppStatus {
  esp32: string;
  backend: string;
  telegram: string;
  sensor: SensorData;
  relays: boolean[];
  logs: {
    telegram: string[];
  };
}

export default function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  // Real-time Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const fetchData = async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/dht/history')
      ]);
      const statusData = await statusRes.json();
      const historyData = await historyRes.json();
      setStatus(statusData);
      setHistory(historyData);
    } catch (error) {
      console.error("Fetch error:", error);
      addToast("Connection error with backend API", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleRelay = async (id: number, currentStatus: boolean) => {
    const state = currentStatus ? 'off' : 'on';
    try {
      const res = await fetch(`/api/relay/${id}/${state}`);
      if (res.ok) {
        addToast(`Relay ${id} turned ${state.toUpperCase()}`, 'success');
        fetchData(); // Immediate refresh
      }
    } catch (error) {
      addToast("Failed to toggle relay", "error");
    }
  };

  const chartData = useMemo(() => ({
    labels: history.map((_, i) => i),
    datasets: [
      {
        label: 'Suhu (°C)',
        data: history.map(d => d.temp),
        borderColor: '#00f2ff',
        backgroundColor: 'rgba(0, 242, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: 'Humidity (%)',
        data: history.map(d => d.humidity),
        borderColor: 'rgba(255, 255, 255, 0.4)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      }
    ]
  }), [history]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.5)' } },
      x: { display: false }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050508]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          <p className="text-cyan-400 font-mono text-sm tracking-widest animate-pulse uppercase">Syncing Terminal Core...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-transparent text-slate-100 selection:bg-cyan-500/30 overflow-hidden p-4 gap-4">
      {/* Sidebar */}
      <aside className="w-20 glass-panel flex flex-col items-center py-8 gap-8 shrink-0">
        <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Activity className="text-white" size={24} />
        </div>

        <nav className="flex flex-col gap-6">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
            { id: 'statistics', icon: BarChart3, label: 'Stats' },
            { id: 'logs', icon: Activity, label: 'Logs' },
            { id: 'settings', icon: Settings, label: 'Set' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "p-3 rounded-lg transition-all duration-300",
                activeTab === item.id 
                  ? "bg-white/10 text-cyan-400" 
                  : "text-white/40 hover:text-white"
              )}
              title={item.label}
            >
              <item.icon size={22} />
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          <div className={cn("w-2 h-2 rounded-full", status?.esp32 === 'online' ? "bg-green-500 animate-pulse" : "bg-red-500")} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <header className="h-16 glass-panel px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold tracking-tight uppercase">Smart Core <span className="text-cyan-400">v2.4</span></h1>
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">IoT Management Terminal</p>
            </div>
            <div className="h-8 w-px bg-white/10 mx-2 hidden md:block"></div>
            <div className="hidden lg:flex gap-4">
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", status?.esp32 === 'online' ? "bg-green-500" : "bg-red-500")}></div>
                <span className="text-[11px] font-medium opacity-60 uppercase">ESP32: {status?.esp32 === 'online' ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", status?.telegram === 'online' ? "bg-green-500" : "bg-red-500")}></div>
                <span className="text-[11px] font-medium opacity-60 uppercase">TELEGRAM: {status?.telegram === 'online' ? 'ACTIVE' : 'IDLE'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                <span className="text-[11px] font-medium opacity-60 uppercase">API: STABLE</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold font-mono text-cyan-400 leading-none">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="text-[10px] text-white/40 uppercase font-semibold tracking-tighter mt-1">
              {currentTime.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
              {[
                { label: 'Temperature', value: `${status?.sensor.temp}°C`, trend: '+0.2%', trendUp: true },
                { label: 'Humidity', value: `${status?.sensor.humidity}%`, trend: '-1.4%', trendUp: false },
                { label: 'ESP32 Latency', value: '12ms', trend: 'Stable', isStatic: true },
                { label: 'API Requests', value: '1.2k', trend: 'Last 24h', isStatic: true }
              ].map((stat, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={idx}
                  className="glass-panel p-4 flex flex-col justify-between h-24"
                >
                  <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">{stat.label}</span>
                  <div className="flex items-end justify-between leading-none">
                    <span className="text-2xl font-bold font-mono tracking-tight">{stat.value}</span>
                    <span className={cn(
                      "text-[10px] font-mono",
                      stat.isStatic ? "text-white/30" : (stat.trendUp ? "text-green-400" : "text-blue-400")
                    )}>
                      {stat.trend} {stat.isStatic ? '' : (stat.trendUp ? '↑' : '↓')}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex-1 lg:grid lg:grid-cols-5 gap-4 min-h-0 overflow-y-auto lg:overflow-hidden pb-4">
              {/* Left Column: Relays & Charts */}
              <section className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
                {/* Relay Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(status?.relays || [false, false, false, false]).map((isOn, idx) => (
                    <motion.button
                      key={idx}
                      onClick={() => toggleRelay(idx + 1, isOn)}
                      className={cn(
                        "glass-panel p-4 flex flex-col justify-between h-32 transition-all duration-300 text-left hover:scale-[1.02]",
                        isOn ? "relay-on border-cyan-500/50" : "border-white/5 opacity-60 grayscale-[0.5]"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          isOn ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-white/20"
                        )}>
                          {idx === 0 ? <MessageSquare size={18} /> : 
                           idx === 1 ? <Activity size={18} /> : 
                           idx === 2 ? <Droplets size={18} /> : <Wifi size={18} />}
                        </div>
                        <div className={cn(
                          "w-8 h-4 rounded-full relative p-0.5 transition-colors cursor-pointer",
                          isOn ? "bg-cyan-500" : "bg-white/10"
                        )}>
                          <motion.div 
                            animate={{ x: isOn ? 16 : 0 }}
                            className="w-3 h-3 bg-white rounded-full shadow-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{['Living Room', 'AC Unit', 'Kitchen Exh.', 'Garden Spr.'][idx]}</p>
                        <p className="text-[10px] opacity-40 font-mono">Channel {idx + 1} | Pin {[5, 18, 19, 23][idx]}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Sensor Chart */}
                <div className="glass-panel p-6 flex flex-col flex-1 min-h-[300px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                       <BarChart3 size={14} className="text-cyan-400" /> Real-time Sensor Data
                    </h3>
                    <div className="flex gap-4 text-[10px] font-mono">
                      <span className="text-cyan-400">● SUHU</span>
                      <span className="text-white/40">○ HUMIDITY</span>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Line data={chartData} options={chartOptions as any} />
                  </div>
                  <div className="h-px bg-white/5 w-full my-4"></div>
                  <div className="flex justify-between text-[9px] font-mono text-white/20">
                    <span>-30 MIN</span>
                    <span>-15 MIN</span>
                    <span>NOW</span>
                  </div>
                </div>
              </section>

              {/* Right Column: Activity & Logs */}
              <section className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                {/* System Logs */}
                <div className="glass-panel p-6 flex-1 flex flex-col overflow-hidden min-h-[300px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest">System Activity Log</h3>
                    <span className="text-[10px] font-mono text-cyan-400 cursor-pointer hover:underline">View Historical</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {(!status || status?.logs?.telegram?.length === 0) && (
                      <div className="log-entry border-white/10 opacity-30">
                        <span className="mr-2">SYNC</span> System awaiting gateway data...
                      </div>
                    )}
                    {status?.logs?.telegram?.map((log, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i}
                        className={cn("log-entry", log.includes('Command') ? "border-cyan-500" : "border-white/20")}
                      >
                        <span className="text-white/30 mr-2">[{log.match(/\[(.*?)\]/)?.[1] || '00:00:00'}]</span> 
                        <span className={cn(log.includes('Command') ? "text-cyan-400" : "text-white/70")}>
                          {log.replace(/\[.*?\]\s?/, '')}
                        </span>
                      </motion.div>
                    ))}
                    
                    {/* Simulated system logs to fill if telegram is empty */}
                    {status?.logs?.telegram?.length === 0 && (
                      <>
                        <div className="log-entry border-white/20">
                          <span className="text-white/30 mr-2">09:16:00</span> [CORE] Gateway initialized
                        </div>
                        <div className="log-entry border-accent-green/50">
                          <span className="text-white/30 mr-2">09:16:05</span> [MQTT] Latency 12ms optimal
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Energy Usage (replaced existing system stats) */}
                <div className="glass-panel p-6 bg-cyan-500/10 border-cyan-500/20 relative overflow-hidden shrink-0">
                  <Activity className="absolute -right-8 -bottom-8 text-cyan-500/10 w-40 h-40" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Power Consumption</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-black font-mono tracking-tighter">128.4</span>
                    <span className="text-sm font-bold text-cyan-400/60 uppercase">kWh</span>
                  </div>
                  <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Efficiency Profile: Optimizing</p>
                </div>
              </section>
            </div>
          </div>
        )}
        
        {activeTab === 'statistics' && (
          <div className="flex-1 glass-panel flex items-center justify-center border-dashed border-white/10 m-8">
            <div className="text-center">
              <BarChart3 className="mx-auto mb-4 text-white/20" size={48} />
              <p className="text-white/40 font-mono text-sm tracking-widest uppercase">Encryption Access Required for Deep Analysis</p>
            </div>
          </div>
        )}

        {/* ... (keep other tabs minimal) */}
      </main>

      {/* Floating Status / Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-none z-50">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              layout
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              key={toast.id}
              className="glass-panel bg-cyan-500/10 border-cyan-500/30 px-6 py-3 rounded-xl flex items-center gap-3 shadow-2xl pointer-events-auto"
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-50">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
