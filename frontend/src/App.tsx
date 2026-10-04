import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import AlertDetails from './pages/AlertDetails';
import Investigation from './pages/Investigation';
import SecurityContext from './pages/SecurityContext';
import ThreatIntelligence from './pages/ThreatIntelligence';
import Evidence from './pages/Evidence';
import AIAnalysis from './pages/AIAnalysis';
import Architecture from './pages/Architecture';
import Evaluation from './pages/Evaluation';
import ProjectStatus from './pages/ProjectStatus';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Main Dashboards & Alert Triage */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/alerts/:id" element={<AlertDetails />} />

          {/* Investigation Workspaces */}
          <Route path="/investigation" element={<Investigation />} />
          <Route path="/investigations" element={<Investigation />} />
          <Route path="/investigations/:id" element={<Investigation />} />

          {/* Intelligence & Evidence */}
          <Route path="/security-context" element={<SecurityContext />} />
          <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/ai-analysis" element={<AIAnalysis />} />
          <Route path="/analysis" element={<AIAnalysis />} />

          {/* Platform & Status */}
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/evaluation" element={<Evaluation />} />
          <Route path="/project-status" element={<ProjectStatus />} />

          {/* System */}
          <Route path="/settings" element={<Settings />} />

          {/* Fallback to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
