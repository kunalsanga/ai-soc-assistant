import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import AlertDetails from './pages/AlertDetails';
import Analysis from './pages/Analysis';
import Investigation from './pages/Investigation';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/alerts/:id" element={<AlertDetails />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/investigation" element={<Investigation />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
