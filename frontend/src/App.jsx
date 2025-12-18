import { useEffect, useState, useCallback } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import toast, { Toaster } from "react-hot-toast";
import { 
  FiCopy, FiCheck, FiUsers, FiCode, FiDownload, 
  FiMaximize, FiMinimize, FiSun, FiMoon, FiLogOut,
  FiRefreshCw
} from "react-icons/fi";

const socket = io("https://real-time-code-editor-vwzm.onrender.com", {
  transports: ["websocket"],
})
const generateColor = (name) => {
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Get user initials
const getInitials = (name) => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Generate random room ID
const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding together!");
  const [copySuccess, setCopySuccess] = useState(false);
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [theme, setTheme] = useState("dark");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState({ lines: 0, chars: 0 });

  // Update stats when code changes
  useEffect(() => {
    const lines = code.split('\n').length;
    const chars = code.length;
    setStats({ lines, chars });
  }, [code]);

  // Theme toggle
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    socket.on("userJoined", (users) => {
      setUsers(users);
    });

    socket.on("codeUpdate", (newCode) => {
      setCode(newCode);
    });

    socket.on("userTyping", (user) => {
      setTyping(user);
      setTimeout(() => setTyping(""), 2000);
    });

    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
      toast.success(`Language changed to ${newLanguage}`);
    });

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit("leaveRoom");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const joinRoom = () => {
    if (roomId && userName) {
      socket.emit("join", { roomId, userName });
      setJoined(true);
      toast.success(`Welcome to room ${roomId}!`, {
        icon: '🎉',
        duration: 3000,
      });
    } else {
      toast.error("Please enter both Room ID and Name");
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// Start coding together!");
    setLanguage("javascript");
    toast.success("Left the room");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess(true);
    toast.success("Room ID copied!");
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, userName });
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit("languageChange", { roomId, language: newLanguage });
  };

  const downloadCode = () => {
    const element = document.createElement("a");
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    
    const extensions = {
      javascript: 'js',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      typescript: 'ts',
      html: 'html',
      css: 'css',
    };
    
    element.download = `code.${extensions[language] || 'txt'}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Code downloaded!");
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleGenerateRoomId = () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    toast.success("Random Room ID generated!");
  };

  // Join Screen
  if (!joined) {
    return (
      <>
        <Toaster position="top-center" />
        <div className="join-container">
          <div className="join-form fade-in">
            <h1>Code Together</h1>
            <p className="subtitle">Real-time collaborative coding</p>
            
            <div className="generate-room-id">
              <input
                type="text"
                placeholder="Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              />
              <button 
                onClick={handleGenerateRoomId}
                title="Generate Random Room ID"
              >
                <FiRefreshCw size={18} />
              </button>
            </div>
            
            <input
              type="text"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
            />
            
            <button onClick={joinRoom}>
              Join Room
            </button>
          </div>
        </div>
      </>
    );
  }

  // Editor Screen
  return (
    <>
      <Toaster position="top-right" />
      <div className="editor-container">
        {/* Sidebar */}
        {!isFullscreen && (
          <div className="sidebar">
            {/* Room Info */}
            <div className="room-info">
              <h2>Room</h2>
              <div className="room-id-display">
                <code>{roomId}</code>
              </div>
              <button 
                onClick={copyRoomId} 
                className={`copy-button ${copySuccess ? 'copied' : ''}`}
              >
                {copySuccess ? (
                  <>
                    <FiCheck size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <FiCopy size={16} />
                    Copy Room ID
                  </>
                )}
              </button>
            </div>

            {/* Users Section */}
            <div className="users-section">
              <h3>
                <FiUsers size={16} />
                Participants
                <span className="users-count">{users.length}</span>
              </h3>
              <ul className="users-list">
                {users.map((user, index) => (
                  <li key={index} className="user-item slide-in">
                    <div 
                      className="user-avatar" 
                      style={{ background: generateColor(user) }}
                    >
                      {getInitials(user)}
                    </div>
                    <span className="user-name">{user}</span>
                    <div className="user-status"></div>
                  </li>
                ))}
              </ul>
              
              {/* Typing Indicator */}
              {typing && (
                <div className="typing-indicator active fade-in">
                  <span>{typing.slice(0, 15)}... is typing</span>
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="controls-section">
              <select
                className="language-selector"
                value={language}
                onChange={handleLanguageChange}
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
              </select>

              <div 
                className={`theme-toggle ${theme === 'light' ? 'active' : ''}`}
                onClick={toggleTheme}
              >
                <span className="theme-toggle-label">
                  {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
                  {theme === 'dark' ? 'Dark' : 'Light'} Mode
                </span>
                <div className="theme-toggle-switch"></div>
              </div>

              <button className="leave-button" onClick={leaveRoom}>
                <FiLogOut size={16} />
                Leave Room
              </button>
            </div>
          </div>
        )}

        {/* Editor Wrapper */}
        <div className="editor-wrapper">
          {/* Toolbar */}
          <div className="editor-toolbar">
            <div className="toolbar-group">
              <button className="toolbar-button" onClick={downloadCode}>
                <FiDownload size={16} />
                Download
              </button>
              <button className="toolbar-button" onClick={toggleFullscreen}>
                {isFullscreen ? <FiMinimize size={16} /> : <FiMaximize size={16} />}
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </button>
            </div>

            <div className="toolbar-stats">
              <div className="stat-item">
                <FiCode size={16} />
                <span className="stat-value">{stats.lines}</span> lines
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.chars}</span> characters
              </div>
              <div className="stat-item">
                <FiUsers size={16} />
                <span className="stat-value">{users.length}</span> online
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="editor-content">
            <Editor
              height="100%"
              defaultLanguage={language}
              language={language}
              value={code}
              onChange={handleCodeChange}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{
                minimap: { enabled: !isFullscreen },
                fontSize: 14,
                fontFamily: "'Fira Code', monospace",
                fontLigatures: true,
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: true,
                smoothScrolling: true,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
