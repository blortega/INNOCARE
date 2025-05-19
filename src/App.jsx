import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import ManageUser from "./pages/ManageUser";
import Record from "./pages/Record";
import Report from "./pages/Reports";
import RequestMedicine from "./pages/RequestMedicine";
import ForgotPassword from "./pages/ForgotPassword";
import ThirdPartyRecord from "./pages/ThirdPartyRecord";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgotpassword" element={<ForgotPassword />} />
        <Route path="sidebar" element={<Sidebar />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="manage-user" element={<ManageUser />} />
        <Route path="records" element={<Record />} />
        <Route path="thirdpartyrecord" element={<ThirdPartyRecord />} />
        <Route path="requestmedicine" element={<RequestMedicine />} />
        <Route path="reports" element={<Report />} />
        ``
      </Routes>
    </Router>
  );
}

export default App;
