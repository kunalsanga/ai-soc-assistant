import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import AlertDetails from './pages/AlertDetails';
import AIAnalysis from './pages/AIAnalysis';
import SecurityKnowledge from './pages/SecurityKnowledge';
import Evaluation from './pages/Evaluation';
import Architecture from './pages/Architecture';
import Settings from './pages/Settings';
import EntityGraphPage from './pages/EntityGraphPage';
import ExecutionTracesPage from './pages/ExecutionTracesPage';

/** Preserves query string (e.g., ?alert=1) when redirecting legacy routes */
function PreserveQueryNavigate({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Operations */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/alerts/:id" element={<AlertDetails />} />
          <Route path="/investigations" element={<AIAnalysis />} />
          <Route path="/investigations/:id" element={<AlertDetails />} />
          <Route path="/ai-analysis" element={<PreserveQueryNavigate to="/investigations" />} />
          <Route path="/analysis" element={<PreserveQueryNavigate to="/investigations" />} />

          {/* Intelligence */}
          <Route path="/graph" element={<EntityGraphPage />} />
          <Route path="/entity-graph" element={<PreserveQueryNavigate to="/graph" />} />
          <Route path="/knowledge" element={<SecurityKnowledge />} />
          <Route path="/threat-knowledge" element={<Navigate to="/knowledge" replace />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/execution" element={<ExecutionTracesPage />} />
          <Route path="/execution-traces" element={<PreserveQueryNavigate to="/execution" />} />
          <Route path="/project-status" element={<Navigate to="/architecture" replace />} />
          <Route path="/evidence" element={<Navigate to="/knowledge" replace />} />
          <Route path="/security-context" element={<Navigate to="/knowledge" replace />} />
          <Route path="/threat-intelligence" element={<Navigate to="/knowledge" replace />} />

          {/* Research and System */}
          <Route path="/evaluation" element={<Evaluation />} />
          <Route path="/rag-evaluation" element={<Navigate to="/evaluation" replace />} />
          <Route path="/settings" element={<Settings />} />

          {/* Fallback to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
