import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import AlertDetails from './pages/AlertDetails';
import AIAnalysis from './pages/AIAnalysis';
import SecurityKnowledge from './pages/SecurityKnowledge';
import Evaluation from './pages/Evaluation';
import Architecture from './pages/Architecture';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Core workflow */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/alerts/:id" element={<AlertDetails />} />
          <Route path="/ai-analysis" element={<AIAnalysis />} />
          <Route path="/analysis" element={<Navigate to="/ai-analysis" replace />} />

          {/* Knowledge & research */}
          <Route path="/knowledge" element={<SecurityKnowledge />} />
          <Route path="/evaluation" element={<Evaluation />} />

          {/* Platform */}
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/project-status" element={<Navigate to="/architecture" replace />} />
          <Route path="/evidence" element={<Navigate to="/knowledge" replace />} />
          <Route path="/security-context" element={<Navigate to="/knowledge" replace />} />
          <Route path="/threat-intelligence" element={<Navigate to="/knowledge" replace />} />

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
