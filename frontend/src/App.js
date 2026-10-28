import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { I18nProvider } from "./i18n";
import Header from "./components/Header";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Sandbox from "./pages/Sandbox";
import Lobby from "./pages/Lobby";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import Room from "./pages/Room";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center font-mono-rs text-muted-foreground">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Protected><Home /></Protected>} />
        <Route path="/sandbox" element={<Protected><Sandbox /></Protected>} />
        <Route path="/lobby" element={<Protected><Lobby /></Protected>} />
        <Route path="/room/:code" element={<Protected><Room /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <div className="App">
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <Shell />
            <Toaster theme="dark" position="top-right" />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </div>
  );
}

export default App;
