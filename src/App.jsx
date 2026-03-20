import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Tracking from './pages/Tracking';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/acompanhar" element={<Tracking />} />
        <Route path="/painel" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;