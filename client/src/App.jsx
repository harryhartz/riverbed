import { Routes, Route, NavLink } from 'react-router-dom';
import Capture from './components/Capture.jsx';
import Timeline from './components/Timeline.jsx';
import Reflections from './components/Reflections.jsx';
import Ask from './components/Ask.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">Riverbed</span>
        <nav>
          <NavLink to="/" end className={navClass}>
            Write
          </NavLink>
          <NavLink to="/entries" className={navClass}>
            Entries
          </NavLink>
          <NavLink to="/reflections" className={navClass}>
            Reflections
          </NavLink>
          <NavLink to="/ask" className={navClass}>
            Ask
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            Settings
          </NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Capture />} />
          <Route path="/entries" element={<Timeline />} />
          <Route path="/reflections" element={<Reflections />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

function navClass({ isActive }) {
  return isActive ? 'nav-link active' : 'nav-link';
}
