import logo from './logo.svg';
import './App.css';
import AgoraMultiMedia from './AgoraMultiMedia';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/:username" element={<AgoraMultiMedia />} />
      </Routes>
    </Router>
  );
}

export default App;
