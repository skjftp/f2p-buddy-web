import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import { store } from './store/store';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSetup from './pages/admin/AdminSetup';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import ProtectedRoute from './components/common/ProtectedRoute';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import 'react-phone-input-2/lib/style.css';

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <ThemeProvider>
          <Router>
            <div className="App">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/login" replace />} />
                
                <Route 
                  path="/admin/setup" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminSetup />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/admin/dashboard" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/employee/dashboard" 
                  element={
                    <ProtectedRoute requiredRole="employee">
                      <EmployeeDashboard />
                    </ProtectedRoute>
                  } 
                />
              </Routes>
              <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
              />
            </div>
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </Provider>
  );
}

export default App;