import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { 
  Camera, 
  UserPlus, 
  Users, 
  RefreshCw, 
  Activity, 
  Cpu, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  UserCheck,
  Calendar,
  LayoutDashboard,
  ArrowRight,
  TrendingUp,
  Award
} from 'lucide-react';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_BASE_URL = `http://${window.location.hostname}:8000`;

// Helper to get formatted YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App() {
  // Navigation: 'dashboard' | 'scanner' | 'sheets'
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // App States
  const [status, setStatus] = useState({
    camera_active: false,
    capture_mode: false,
    register_id: "",
    captured_count: 0,
    target_capture_count: 20,
    is_training: false,
    training_progress: "Idle",
    training_logs: []
  });
  
  const [students, setStudents] = useState([]);
  const [availableDates, setAvailableDates] = useState([getTodayString()]);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [sheetRecords, setSheetRecords] = useState([]);
  
  // KPI / Chart States
  const [analytics, setAnalytics] = useState({
    kpis: {
      total_students: 0,
      today_present: 0,
      today_rate: 0.0,
      today_away: 0,
      weekly_average_rate: 0.0
    },
    charts: {
      weekly: { labels: [], data: [] },
      hourly: { labels: [], data: [] }
    }
  });

  // Face Registration Form States
  const [registerName, setRegisterName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  
  // Student CRUD and filter states
  const [newStudentName, setNewStudentName] = useState("");
  const [crudError, setCrudError] = useState("");
  const [crudSuccess, setCrudSuccess] = useState("");
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editingStudentName, setEditingStudentName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Search and overrides loading
  const [sheetSearch, setSheetSearch] = useState("");
  const [togglingStudents, setTogglingStudents] = useState({});
  
  // Poll server camera & retraining status
  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/status`);
      setStatus(response.data);
    } catch (error) {
      console.error("Error fetching status:", error);
    }
  };

  // Fetch student directory
  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/students`);
      setStudents(response.data);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  // Fetch logged dates
  const fetchDates = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attendance/dates`);
      setAvailableDates(response.data);
    } catch (error) {
      console.error("Error fetching dates:", error);
    }
  };

  // Fetch attendance sheet for selected date
  const fetchSheetRecords = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attendance`, {
        params: { date: selectedDate }
      });
      setSheetRecords(response.data);
    } catch (error) {
      console.error("Error fetching sheet records:", error);
    }
  };

  // Fetch analytics summary
  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attendance/summary`);
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  // Initial and reactive updates
  useEffect(() => {
    fetchStatus();
    fetchStudents();
    fetchDates();
    fetchAnalytics();
  }, []);

  // Polling logic depending on tab or background retraining
  useEffect(() => {
    const statusInterval = setInterval(() => {
      fetchStatus();
    }, status.capture_mode || status.is_training ? 400 : 2000);

    return () => clearInterval(statusInterval);
  }, [status.capture_mode, status.is_training]);

  // Poll sheet records for selected date
  useEffect(() => {
    fetchSheetRecords();
    
    const sheetInterval = setInterval(() => {
      fetchSheetRecords();
    }, selectedDate === getTodayString() ? 1500 : 5000); // Poll fast if looking at today's check-ins

    return () => clearInterval(sheetInterval);
  }, [selectedDate]);

  // Poll analytics less frequently
  useEffect(() => {
    const analyticsInterval = setInterval(() => {
      fetchAnalytics();
    }, 5000);

    return () => clearInterval(analyticsInterval);
  }, []);

  // Save Face registration handler (Webcam Capture flow)
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerName.trim()) {
      setRegisterError("Please enter a valid name.");
      return;
    }
    
    setIsRegistering(true);
    setRegisterError("");
    setRegisterSuccess("");

    try {
      const response = await axios.post(`${API_BASE_URL}/api/register`, {
        name: registerName
      });
      if (response.data.success) {
        setRegisterSuccess(response.data.message);
        setRegisterName("");
        fetchStatus();
        fetchStudents();
      }
    } catch (error) {
      const errMsg = error.response?.data?.detail || "Registration failed. Try again.";
      setRegisterError(errMsg);
    } finally {
      setIsRegistering(false);
    }
  };

  // CRUD Create student manually
  const handleCrudCreate = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) {
      setCrudError("Name cannot be empty.");
      return;
    }
    setCrudError("");
    setCrudSuccess("");
    try {
      const response = await axios.post(`${API_BASE_URL}/api/students`, {
        name: newStudentName
      });
      if (response.data.success) {
        setCrudSuccess(`Created entry for ${newStudentName}.`);
        setNewStudentName("");
        await fetchStudents();
        await fetchSheetRecords();
        await fetchAnalytics();
        // Clear message after 3 seconds
        setTimeout(() => setCrudSuccess(""), 3000);
      }
    } catch (error) {
      setCrudError(error.response?.data?.detail || "Failed to create student.");
    }
  };

  // CRUD Update student name
  const handleCrudUpdate = async (studentId) => {
    if (!editingStudentName.trim()) return;
    try {
      const response = await axios.put(`${API_BASE_URL}/api/students/${studentId}`, {
        name: editingStudentName
      });
      if (response.data.success) {
        setEditingStudentId(null);
        await fetchStudents();
        await fetchSheetRecords();
        await fetchAnalytics();
      }
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to update student.");
    }
  };

  // CRUD Delete student
  const handleCrudDelete = async (studentId, studentName) => {
    if (window.confirm(`Are you sure you want to remove ${studentName} from the class directory? This will remove their check-in logs and face templates.`)) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/api/students/${studentId}`);
        if (response.data.success) {
          await fetchStudents();
          await fetchSheetRecords();
          await fetchAnalytics();
          await fetchStatus();
          alert("Student removed from directory.");
        }
      } catch (error) {
        alert(error.response?.data?.detail || "Failed to delete student.");
      }
    }
  };

  // Toggle manual attendance overrides (Present <-> Absent)
  const toggleAttendanceStatus = async (studentId, currentStatus) => {
    setTogglingStudents(prev => ({ ...prev, [studentId]: true }));
    const newStatus = (currentStatus === 'Absent') ? 'Present' : 'Absent';
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/attendance/mark`, {
        student_id: studentId,
        date: selectedDate,
        status: newStatus
      });
      if (response.data.success) {
        await fetchSheetRecords();
        await fetchAnalytics();
        fetchDates();
      }
    } catch (error) {
      console.error("Error setting attendance override:", error);
    } finally {
      setTogglingStudents(prev => ({ ...prev, [studentId]: false }));
    }
  };

  // Reset Session handler for today's logs
  const handleResetSession = async () => {
    if (window.confirm("Are you sure you want to reset today's attendance sheet? This will clear all check-ins for today.")) {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/session/reset`);
        if (response.data.success) {
          fetchSheetRecords();
          fetchAnalytics();
        }
      } catch (error) {
        console.error("Error resetting session:", error);
      }
    }
  };

  // Filter sheet records based on search and status filter chips
  const filteredSheet = sheetRecords.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(sheetSearch.toLowerCase()) || 
                          r.id.toLowerCase().includes(sheetSearch.toLowerCase());
    if (!matchesSearch) return false;
    
    if (statusFilter === 'present') {
      return r.status === 'Active' || r.status === 'Present' || r.status === 'Away';
    } else if (statusFilter === 'absent') {
      return r.status === 'Absent';
    }
    return true;
  });

  // Find the most recently detected student for scanner view
  const lastDetected = sheetRecords.length > 0 && selectedDate === getTodayString()
    ? [...sheetRecords]
        .filter(r => r.status !== 'Absent' && r.last_seen_epoch)
        .sort((a, b) => b.last_seen_epoch - a.last_seen_epoch)[0]
    : null;

  // Chart configs (Cyan glows and Purple bars)
  const lineChartData = {
    labels: analytics.charts.weekly.labels,
    datasets: [{
      label: 'Students Present',
      data: analytics.charts.weekly.data,
      borderColor: '#06b6d4', // Cyan line
      backgroundColor: 'rgba(6, 182, 212, 0.08)', // Glowing transparent cyan fill
      borderWidth: 2,
      pointBackgroundColor: '#22d3ee',
      pointBorderColor: '#0b0c10',
      pointHoverRadius: 6,
      pointHoverBackgroundColor: '#FFFFFF',
      pointRadius: 4,
      fill: true,
      tension: 0.38,
    }]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(20, 21, 26, 0.95)',
        borderColor: 'rgba(6, 182, 212, 0.25)',
        borderWidth: 1,
        titleColor: '#FFFFFF',
        bodyColor: '#E4E4E7',
        padding: 10,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#71717A', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#71717A', font: { size: 10 }, stepSize: 1 }
      }
    }
  };

  const barChartData = {
    labels: analytics.charts.hourly.labels.slice(7, 20), // Show school hours 7:00 to 19:00
    datasets: [{
      label: 'Check-in Count',
      data: analytics.charts.hourly.data.slice(7, 20),
      backgroundColor: 'rgba(139, 92, 246, 0.35)', // Translucent purple bars
      hoverBackgroundColor: '#8b5cf6', // Electric purple on hover
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.6)'
    }]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(20, 21, 26, 0.95)',
        borderColor: 'rgba(139, 92, 246, 0.25)',
        borderWidth: 1,
        titleColor: '#FFFFFF',
        bodyColor: '#E4E4E7',
        padding: 10,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#71717A', font: { size: 9 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#71717A', font: { size: 10 }, stepSize: 1 }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#f4f4f5] px-6 py-8 md:px-16 flex flex-col justify-between selection:bg-zinc-850 selection:text-white relative z-0">
      
      {/* Floating blur orbs background */}
      <div className="orb-layer">
        <div className="bg-orb-cyan animate-float"></div>
        <div className="bg-orb-purple animate-float-reverse"></div>
        <div className="bg-orb-emerald"></div>
      </div>
      
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-end md:justify-between border-b border-zinc-900 pb-6">
        <div className="text-left">
          <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight text-gradient-apple">
            Aura Class Hub
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage your classroom roster, verify attendance, and view daily check-in histories.
          </p>
        </div>

        {/* Global tab control navigation */}
        <div className="bg-[#14151a]/70 backdrop-blur-md p-1.5 rounded-xl flex items-center border border-zinc-800 mt-6 md:mt-0 max-w-sm shadow-inner shadow-black/60">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ${
              activeTab === 'dashboard' 
                ? 'bg-gradient-to-br from-cyan-600/20 to-cyan-700/10 border border-cyan-500/20 text-cyan-200 shadow-md shadow-black/40 scale-105 font-medium' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.01]'
            }`}
          >
            <LayoutDashboard strokeWidth={1.5} className="h-3.5 w-3.5 text-cyan-500" />
            Dashboard
          </button>
          
          <button 
            onClick={() => {
              setActiveTab('scanner');
              setSelectedDate(getTodayString()); // Sync to today
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ${
              activeTab === 'scanner' 
                ? 'bg-gradient-to-br from-cyan-600/20 to-cyan-700/10 border border-cyan-500/20 text-cyan-200 shadow-md shadow-black/40 scale-105 font-medium' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.01]'
            }`}
          >
            <Camera strokeWidth={1.5} className="h-3.5 w-3.5 text-cyan-500" />
            Attendance Scanner
          </button>

          <button 
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ${
              activeTab === 'sheets' 
                ? 'bg-gradient-to-br from-cyan-600/20 to-cyan-700/10 border border-cyan-500/20 text-cyan-200 shadow-md shadow-black/40 scale-105 font-medium' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.01]'
            }`}
          >
            <Calendar strokeWidth={1.5} className="h-3.5 w-3.5 text-cyan-500" />
            Class Sheets
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="w-full max-w-6xl mx-auto flex-1 mb-8">
        
        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-8 text-left">
            
            {/* Humanist Hero Section */}
            <div className="apple-panel rounded-2xl p-6 md:p-8 relative overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.75 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/5 border border-cyan-500/10 text-cyan-400 mb-3">
                    <CheckCircle className="h-3 w-3" /> Class Registry Directory Active
                  </span>
                  
                  <h2 className="text-2xl md:text-3xl font-display font-medium tracking-tight text-white">
                    Welcome to Aura Class Hub
                  </h2>
                  
                  <p className="text-xs md:text-sm text-zinc-400 mt-2.5 leading-relaxed">
                    A quiet, reliable space to manage your classroom and connect with your students. 
                    Built to make attendance effortless, Aura recognizes face shapes locally on your hardware to securely log check-in times. 
                    Your student directory and photo records remain completely private and on-device.
                  </p>
                </div>

                {/* Human Metric Stats Grid */}
                <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0 bg-black/30 border border-zinc-900 rounded-xl p-4 text-[10px]">
                  <div className="border-r border-zinc-900/60 pr-4">
                    <span className="text-zinc-500 uppercase block tracking-wider text-[8px]">Class Community</span>
                    <span className="text-zinc-200 font-bold text-xs mt-1 block">{analytics.kpis.total_students} Students</span>
                  </div>
                  <div className="pl-2">
                    <span className="text-zinc-500 uppercase block tracking-wider text-[8px]">Present Today</span>
                    <span className="text-zinc-200 font-bold text-xs mt-1 block">{analytics.kpis.today_present} Checked-in</span>
                  </div>
                  <div className="border-t border-r border-zinc-900/60 pt-2.5 pr-4 mt-1">
                    <span className="text-zinc-500 uppercase block tracking-wider text-[8px]">Attendance Rate</span>
                    <span className="text-zinc-200 font-bold text-xs mt-1 block">{analytics.kpis.today_rate}%</span>
                  </div>
                  <div className="border-t border-zinc-900/60 pt-2.5 pl-2 mt-1">
                    <span className="text-zinc-500 uppercase block tracking-wider text-[8px]">Active Streak</span>
                    <span className="text-zinc-200 font-bold text-xs mt-1 block">{availableDates.length} Days logged</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* KPIs Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Student Registry */}
              <div className="apple-panel interactive-hover-cyan rounded-xl p-5 flex flex-col justify-between min-h-[110px] relative overflow-hidden group border border-zinc-900/60">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:scale-125 transition-all duration-300"></div>
                <div className="flex items-center justify-between text-zinc-400 text-xs font-medium z-10">
                  <span className="font-display">Student Registry</span>
                  <Users strokeWidth={1.5} className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-all duration-300" />
                </div>
                <div className="mt-4 z-10">
                  <span className="text-3xl font-semibold tracking-tight text-gradient-cyan font-display">
                    {analytics.kpis.total_students}
                  </span>
                  <span className="text-[9px] text-zinc-500 block mt-1 uppercase tracking-wider">
                    Total profiles registered
                  </span>
                </div>
              </div>

              {/* Card 2: Today's Attendance */}
              <div className="apple-panel interactive-hover-emerald rounded-xl p-5 flex flex-col justify-between min-h-[110px] relative overflow-hidden group border border-zinc-900/60">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-125 transition-all duration-300"></div>
                <div className="flex items-center justify-between text-zinc-400 text-xs font-medium z-10">
                  <span className="font-display">Today's Attendance</span>
                  <UserCheck strokeWidth={1.5} className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-all duration-300" />
                </div>
                <div className="mt-4 z-10">
                  <span className="text-3xl font-semibold tracking-tight text-gradient-jade font-display">
                    {analytics.kpis.today_rate}%
                  </span>
                  <span className="text-[9px] text-zinc-500 block mt-1 uppercase tracking-wider">
                    {analytics.kpis.today_present} present in session
                  </span>
                </div>
              </div>

              {/* Card 3: Weekly Average */}
              <div className="apple-panel interactive-hover-purple rounded-xl p-5 flex flex-col justify-between min-h-[110px] relative overflow-hidden group border border-zinc-900/60">
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:scale-125 transition-all duration-300"></div>
                <div className="flex items-center justify-between text-zinc-400 text-xs font-medium z-10">
                  <span className="font-display">Weekly Average</span>
                  <TrendingUp strokeWidth={1.5} className="h-4 w-4 text-violet-400 group-hover:scale-110 transition-all duration-300" />
                </div>
                <div className="mt-4 z-10">
                  <span className="text-3xl font-semibold tracking-tight text-gradient-purple font-display">
                    {analytics.kpis.weekly_average_rate}%
                  </span>
                  <span className="text-[9px] text-zinc-500 block mt-1 uppercase tracking-wider">
                    Historical average presence
                  </span>
                </div>
              </div>

              {/* Card 4: System Status */}
              {(() => {
                const isTraining = status.is_training;
                const isCapturing = status.capture_mode;
                
                let statusLabel = "Scanner Standby";
                if (isTraining) {
                  statusLabel = "Updating Records";
                } else if (isCapturing) {
                  statusLabel = "Saving Portraits";
                }
                
                return (
                  <div className="apple-panel interactive-hover-cyan rounded-xl p-5 flex flex-col justify-between min-h-[110px] relative overflow-hidden group border border-zinc-900/60">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:scale-125 transition-all duration-300"></div>
                    <div className="flex items-center justify-between text-zinc-400 text-xs font-medium z-10">
                      <span>Scanner Status</span>
                      <Activity strokeWidth={1.5} className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-all duration-300" />
                    </div>
                    <div className="mt-4 z-10">
                      <span className="text-lg font-semibold tracking-tight text-gradient-cyan block truncate">
                        {statusLabel}
                      </span>
                      <span className="text-[9px] text-zinc-500 block mt-1 uppercase tracking-wider">
                        {status.camera_active ? 'webcam connected' : 'simulated stream active'}
                      </span>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Weekly Attendance Trend Curve */}
              <div className="apple-panel rounded-2xl p-6 flex flex-col relative overflow-hidden">
                <div className="mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400/80">Attendance Trend</span>
                  <h3 className="text-base font-semibold text-zinc-200 mt-1 font-display">Weekly Presence Rates</h3>
                </div>
                <div className="h-[250px] relative w-full">
                  {analytics.charts.weekly.data.length > 0 ? (
                    <Line data={lineChartData} options={lineChartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-zinc-600">
                      Calculating attendance datasets...
                    </div>
                  )}
                </div>
              </div>

              {/* Hourly Distribution Bar Chart */}
              <div className="apple-panel rounded-2xl p-6 flex flex-col">
                <div className="mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">Time distribution</span>
                  <h3 className="text-base font-semibold text-zinc-200 mt-1 font-display">Hourly Attendance Pattern</h3>
                </div>
                <div className="h-[250px] relative w-full">
                  {analytics.charts.hourly.data.some(c => c > 0) ? (
                    <Bar data={barChartData} options={barChartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-zinc-600">
                      No check-in distribution timestamps recorded yet.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Live Scanner & Take Attendance */}
        {activeTab === 'scanner' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Live Feed Photo Frame */}
            <section className="lg:col-span-7 flex flex-col gap-8 w-full">
              
              {/* Webcam Stream - Portrait Frame */}
              <div className="apple-panel rounded-2xl p-5 flex flex-col relative overflow-hidden text-left group">
                <div className="flex items-center justify-between mb-3.5 z-10">
                  <div className="flex items-center gap-2">
                    <Camera strokeWidth={1.5} className="h-4.5 w-4.5 text-cyan-400/85" />
                    <span className="text-xs font-medium text-zinc-400 font-display">Scanner Portrait View</span>
                  </div>
                  
                  {status.is_training ? (
                    <span className="bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Updating records...
                    </span>
                  ) : status.capture_mode ? (
                    <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      Saving photos ({status.captured_count}/{status.target_capture_count})
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Scanner Online
                    </div>
                  )}
                </div>

                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800 shadow-2xl z-10">
                  <img 
                    src={`${API_BASE_URL}/api/video_feed`} 
                    alt="Live Scanner Stream" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  
                  {status.capture_mode && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col justify-end p-5 z-20">
                      <div className="w-full bg-[#121216] rounded-xl p-4 border border-zinc-900">
                        <div className="flex items-center justify-between text-xs font-medium mb-2">
                          <span className="text-cyan-400 flex items-center gap-1.5 text-[10px] uppercase font-semibold">
                            Saving student portrait frames
                          </span>
                          <span className="text-zinc-400 text-xs">
                            {status.captured_count} / {status.target_capture_count}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-cyan-500 transition-all duration-300"
                            style={{ width: `${(status.captured_count / status.target_capture_count) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {status.is_training && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 z-20 text-center">
                      <div className="w-10 h-10 rounded-full border border-zinc-800 border-t-cyan-500 animate-spin mb-3"></div>
                      <h3 className="text-sm font-semibold text-zinc-200 mb-1">Refitting Class Registry</h3>
                      <p className="text-xs text-zinc-500 max-w-xs mb-4">
                        Re-building directory indexes. Camera stream paused momentarily.
                      </p>
                      <div className="px-3 py-1 bg-zinc-900 border border-zinc-850 rounded-lg text-[11px] text-zinc-400">
                        {status.training_progress}
                      </div>
                    </div>
                  )}
                </div>

                {!status.camera_active && !status.is_training && (
                  <div className="mt-3 flex items-center gap-2 text-left bg-zinc-900/40 border border-zinc-900/60 px-4 py-2.5 rounded-xl text-xs text-zinc-400">
                    <AlertCircle strokeWidth={1.5} className="h-4.5 w-4.5 text-zinc-500 shrink-0" />
                    <div>
                      <span className="font-medium text-zinc-300 block">Virtual Simulation Mode</span>
                      Webcam offline. The platform is running in virtual simulation mode with demo check-ins.
                    </div>
                  </div>
                )}

              </div>

            </section>

            {/* Right Column: Focus Widget, Save Form & Help Instructions */}
            <section className="lg:col-span-5 flex flex-col gap-6 w-full text-left">

              {/* Active Scanner Focus Widget */}
              <div className="apple-panel rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity strokeWidth={1.5} className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Scanner Focus</span>
                  </div>
                  {lastDetected && lastDetected.status === 'Active' && (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-radial-pulse">
                      Detected
                    </span>
                  )}
                </div>
                
                {lastDetected ? (
                  <div className="flex items-center justify-between bg-black/40 border border-zinc-900 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-sm uppercase">
                        {lastDetected.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold text-sm block text-white">
                          {lastDetected.name}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Last seen: {lastDetected.last_seen.split(' ')[1]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-zinc-300 block">
                        {lastDetected.duration_str}
                      </span>
                      <span className="text-[9px] uppercase font-semibold text-zinc-600 tracking-wider">
                        Session time
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-zinc-900 rounded-xl text-xs text-zinc-650">
                    No student currently in viewport.
                  </div>
                )}
              </div>

              {/* Save Student Face Form */}
              <div className="apple-panel rounded-2xl p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus strokeWidth={1.5} className="h-4.5 w-4.5 text-zinc-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Register Face Portrait</span>
                </div>
                
                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block mb-1.5">
                      Student's Full Name
                    </label>
                    <input 
                      type="text" 
                      disabled={status.capture_mode || status.is_training || isRegistering}
                      placeholder="e.g. Satyam Rana" 
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full apple-glass-input disabled:opacity-30 disabled:cursor-not-allowed rounded-xl px-4 py-2.5 text-sm placeholder:text-zinc-600 text-white"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={status.capture_mode || status.is_training || isRegistering || !registerName.trim()}
                    className="w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-600 hover:from-cyan-600 hover:via-indigo-600 hover:to-violet-700 disabled:from-zinc-800 disabled:to-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs uppercase tracking-wider rounded-xl py-3 px-4 shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-[1px] transition-all active:translate-y-0 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isRegistering ? (
                      <>
                        <RefreshCw strokeWidth={1.5} className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        Start Camera Portrait Capture
                      </>
                    )}
                  </button>
                </form>

                {registerError && (
                  <div className="mt-3 flex items-start gap-2 bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A] p-3 rounded-xl text-xs">
                    <AlertCircle strokeWidth={1.5} className="h-4 w-4 text-[#FF453A] shrink-0 mt-0.5" />
                    <span>{registerError}</span>
                  </div>
                )}

                {registerSuccess && (
                  <div className="mt-3 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs">
                    <CheckCircle strokeWidth={1.5} className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{registerSuccess}</span>
                  </div>
                )}
              </div>

              {/* Friendly Telemetry Instructions */}
              <div className="apple-panel rounded-2xl p-5 flex flex-col gap-3 text-xs text-zinc-400 border border-zinc-900">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">How verification works</span>
                <div className="flex flex-col gap-2.5">
                  <div className="flex gap-2">
                    <span className="text-cyan-400 font-bold">01.</span>
                    <span>Create a student record manually in the sheets directory or type their name in the form above.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-cyan-400 font-bold">02.</span>
                    <span>Align the student face in the webcam viewport. The camera will save 20 portrait sample frames.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-cyan-400 font-bold">03.</span>
                    <span>A secure background local index updates. When students stand in front of the scanner, check-in logging triggers automatically.</span>
                  </div>
                </div>
              </div>

            </section>

          </div>
        )}

        {/* Tab 3: Attendance Sheets */}
        {activeTab === 'sheets' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Attendance records list */}
            <div className="lg:col-span-8 apple-panel rounded-2xl p-6 text-left flex flex-col gap-6">
              
              {/* Quick Sheet Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/30 border border-zinc-900 rounded-xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase block">Class Size</span>
                  <span className="text-xl font-bold text-zinc-200 mt-1 block">{students.length} Profiles</span>
                </div>
                <div className="bg-black/30 border border-zinc-900 rounded-xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase block">Present Today</span>
                  <span className="text-xl font-bold text-emerald-400 mt-1 block">
                    {sheetRecords.filter(r => r.status === 'Active' || r.status === 'Present' || r.status === 'Away').length} Present
                  </span>
                </div>
                <div className="bg-black/30 border border-zinc-900 rounded-xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase block">Absent Today</span>
                  <span className="text-xl font-bold text-red-400 mt-1 block">
                    {sheetRecords.filter(r => r.status === 'Absent').length} Absent
                  </span>
                </div>
                <div className="bg-black/30 border border-zinc-900 rounded-xl p-4">
                  <span className="text-[10px] text-zinc-500 uppercase block">Session Presence</span>
                  <span className="text-xl font-bold text-cyan-400 mt-1 block">
                    {students.length > 0 
                      ? `${Math.round(sheetRecords.filter(r => r.status === 'Active' || r.status === 'Present' || r.status === 'Away').length / students.length * 100)}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              {/* Sheet Control Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-900 pb-5">
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Calendar strokeWidth={1.5} className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-500 pointer-events-none" />
                    
                    {/* Select Date dropdown */}
                    <select 
                      value={selectedDate} 
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="apple-glass-input rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-white appearance-none cursor-pointer"
                    >
                      {availableDates.map(date => (
                        <option key={date} value={date}>
                          {date === getTodayString() ? `${date} (Today)` : date}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Calendar Input to create a custom sheet date */}
                  <input 
                    type="date"
                    max={getTodayString()}
                    value={selectedDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setSelectedDate(val);
                        if (!availableDates.includes(val)) {
                          setAvailableDates(prev => sortedDates([val, ...prev]));
                        }
                      }
                    }}
                    className="apple-glass-input rounded-xl px-3 py-2 text-xs font-semibold text-white cursor-pointer"
                  />
                </div>

                {/* Status Filter Chips */}
                <div className="flex gap-1 bg-black/40 p-1 border border-zinc-900 rounded-xl">
                  {['all', 'present', 'absent'].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={`px-3 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wide transition-all duration-300 ${
                        statusFilter === filter
                          ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-semibold'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {/* Text Search + Reset for today's logs */}
                <div className="flex items-center gap-3 md:justify-end">
                  <input 
                    type="text" 
                    placeholder="Search roster..." 
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    className="apple-glass-input rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-650 w-full max-w-[130px]"
                  />

                  {selectedDate === getTodayString() && sheetRecords.some(r => r.status !== 'Absent') && (
                    <button 
                      onClick={handleResetSession}
                      className="text-[10px] uppercase font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Trash2 strokeWidth={1.5} className="h-3.5 w-3.5 text-zinc-500" />
                      Clear Session
                    </button>
                  )}
                </div>

              </div>

              {/* Attendance Sheet Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-500 text-[10px] font-semibold tracking-wider uppercase text-left">
                      <th className="pb-3 pl-4">Student</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Check-In</th>
                      <th className="pb-3">Duration</th>
                      <th className="pb-3 pr-4 text-right">Attendance Override</th>
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-zinc-900/60 text-xs">
                    {filteredSheet.length > 0 ? (
                      filteredSheet.map((record) => {
                        const isToggling = !!togglingStudents[record.id];
                        
                        return (
                          <tr key={record.id} className="hover:bg-white/[0.01] transition-all">
                            {/* Student Details */}
                            <td className="py-3.5 pl-4">
                              <div className="flex items-center gap-3">
                                <div className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center font-bold text-[10px] uppercase">
                                  {record.name.charAt(0)}
                                </div>
                                <div>
                                  <span className="font-semibold text-zinc-200 block">
                                    {record.name}
                                  </span>
                                  <span className="text-[9px] text-zinc-650 block mt-0.5">
                                    {record.id}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Status Badge */}
                            <td className="py-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.75 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                record.status === 'Active' || record.status === 'Present'
                                  ? 'status-pill-present'
                                  : record.status === 'Away'
                                  ? 'status-pill-away'
                                  : 'status-pill-absent'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  record.status === 'Active' || record.status === 'Present'
                                    ? 'bg-emerald-400'
                                    : record.status === 'Away'
                                    ? 'bg-cyan-400'
                                    : 'bg-red-400'
                                }`}></span>
                                {record.status}
                              </span>
                            </td>

                            {/* Check-In Timestamp */}
                            <td className="py-3.5 text-zinc-400">
                              {record.check_in.includes(":") ? record.check_in.split(" ")[1] : record.check_in}
                            </td>

                            {/* Cumulative Duration */}
                            <td className="py-3.5 text-zinc-300">
                              {record.duration_str}
                            </td>

                            {/* Toggle overrides checkbox */}
                            <td className="py-3.5 pr-4 text-right">
                              <button
                                disabled={isToggling}
                                onClick={() => toggleAttendanceStatus(record.id, record.status)}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 border ${
                                  record.status === 'Absent'
                                    ? 'bg-transparent border-zinc-800/80 hover:border-zinc-650 hover:text-zinc-200 text-zinc-500 hover:bg-white/[0.02]'
                                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:shadow-md hover:shadow-cyan-500/5'
                                } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95`}
                              >
                                {isToggling ? (
                                  <RefreshCw className="h-3 w-3 animate-spin text-zinc-500" />
                                ) : record.status === 'Absent' ? (
                                  'Mark Present'
                                ) : (
                                  'Mark Absent'
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-zinc-600 select-none">
                          No roster logs found matching selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Right Column: Student Directory Manager Side-panel */}
            <div className="lg:col-span-4 apple-panel rounded-2xl p-5 flex flex-col justify-between text-left">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-cyan-400" />
                  Roster Directory
                </h3>

                {/* Quick Manual Add Form */}
                <form onSubmit={handleCrudCreate} className="mb-6 pb-6 border-b border-zinc-900 flex flex-col gap-3">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block mb-1">
                      Add Student manually
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Student's name..." 
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        className="flex-1 apple-glass-input rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600"
                      />
                      <button 
                        type="submit"
                        className="bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold uppercase px-3.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {crudError && <span className="text-[10px] text-red-400">{crudError}</span>}
                  {crudSuccess && <span className="text-[10px] text-emerald-400">{crudSuccess}</span>}
                </form>

                {/* Student list with edit/delete */}
                <div className="max-h-[380px] overflow-y-auto pr-1 flex flex-col gap-2">
                  {students.length > 0 ? (
                    students.map(student => (
                      <div key={student.id} className="bg-black/40 border border-zinc-900/60 rounded-xl p-3 flex flex-col justify-between hover:border-zinc-800 transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="h-6 w-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center font-bold text-[9px] uppercase">
                              {student.name.charAt(0)}
                            </div>
                            {editingStudentId === student.id ? (
                              <input 
                                type="text"
                                value={editingStudentName}
                                onChange={(e) => setEditingStudentName(e.target.value)}
                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                                autoFocus
                              />
                            ) : (
                              <div className="truncate">
                                <span className="font-medium text-xs text-zinc-200 block truncate">
                                  {student.name}
                                </span>
                                <span className="text-[9px] text-zinc-650 block">
                                  {student.id}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Status indicator of face samples */}
                          <span className={`text-[9px] px-2 py-0.5 rounded-full shrink-0 font-bold ${
                            student.face_count >= 20 
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                              : student.face_count > 0 
                              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                              : 'bg-red-500/10 border border-red-500/20 text-red-400'
                          }`}>
                            {student.face_count} photos
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="mt-2.5 pt-2 border-t border-zinc-900/40 flex items-center justify-between">
                          {editingStudentId === student.id ? (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleCrudUpdate(student.id)}
                                className="text-[9px] uppercase font-bold text-emerald-400 hover:text-emerald-300"
                              >
                                Save
                              </button>
                              <button 
                                onClick={() => setEditingStudentId(null)}
                                className="text-[9px] uppercase font-bold text-zinc-500 hover:text-zinc-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-3">
                              <button 
                                onClick={() => {
                                  setEditingStudentId(student.id);
                                  setEditingStudentName(student.name);
                                }}
                                className="text-[9px] uppercase font-bold text-zinc-400 hover:text-cyan-400 transition-colors animate-fade-in"
                              >
                                Edit Name
                              </button>
                              {student.face_count === 0 && (
                                <button 
                                  onClick={() => {
                                    setRegisterName(student.name);
                                    setActiveTab('scanner');
                                  }}
                                  className="text-[9px] uppercase font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                                >
                                  Register Face
                                </button>
                              )}
                            </div>
                          )}
                          
                          <button 
                            onClick={() => handleCrudDelete(student.id, student.name)}
                            className="text-[9px] uppercase font-bold text-zinc-500 hover:text-red-400 transition-colors animate-fade-in"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-650 py-4 text-center">No students registered yet.</span>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

    </div>
  );
}

// Simple date sort helper
const sortedDates = (arr) => {
  return [...new Set(arr)].sort((a, b) => new Date(b) - new Date(a));
};

export default App;
