import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import BossKillForm from './pages/BossKillForm';
import Login from './pages/Login';
import ApplyItem from './pages/ApplyItem';
import Auction from './pages/Auction';
import Stats from './pages/Stats';
import CreateAuction from './pages/CreateAuction';
import Home from './pages/Home';
import ManageBosses from './pages/ManageBosses';
import ManageItems from './pages/ManageItems';
import ApproveApplications from './pages/ApproveApplications';
import ManageUsers from './pages/ManageUsers';
import RoleRoute from './components/RoleRoute';
import Navbar from './components/Navbar';
import KillHistory from './pages/KillHistory';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications'; // 導入 Notifications 組件
import React, { useState } from 'react';
import { NotificationProvider } from './components/NotificationContext';

function App() {
  const [profileVisible, setProfileVisible] = useState(false);

  // 調試信息
  console.log('App rendered, checking routes');

  return (
    <NotificationProvider>
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/apply-item"
            element={
              <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                <ApplyItem />
              </RoleRoute>
            }
          />
          <Route
            path="/auction"
            element={
              <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                <Auction />
              </RoleRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <RoleRoute allowedRoles={['admin']}>
                <Stats />
              </RoleRoute>
            }
          />
          <Route
            path="/create-auction"
            element={
              <RoleRoute allowedRoles={['moderator', 'admin']}>
                <CreateAuction />
              </RoleRoute>
            }
          />
          <Route
            path="/boss-kill"
            element={
              <RoleRoute allowedRoles={['moderator', 'admin']}>
                <BossKillForm />
              </RoleRoute>
            }
          />
          <Route
            path="/manage-bosses"
            element={
              <RoleRoute allowedRoles={['admin']}>
                <ManageBosses />
              </RoleRoute>
            }
          />
          <Route
            path="/manage-items"
            element={
              <RoleRoute allowedRoles={['admin']}>
                <ManageItems />
              </RoleRoute>
            }
          />
          <Route
            path="/approve-applications"
            element={
              <RoleRoute allowedRoles={['moderator', 'admin']}>
                <ApproveApplications />
              </RoleRoute>
            }
          />
          <Route
            path="/manage-users"
            element={
              <RoleRoute allowedRoles={['admin']}>
                <ManageUsers />
              </RoleRoute>
            }
          />
          <Route
            path="/kill-history"
            element={
              <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                <KillHistory />
              </RoleRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                <Notifications />
              </RoleRoute>
            }
          />
          {/* 處理未匹配的路由 */}
          <Route path="*" element={<h1>404 - 頁面未找到</h1>} />
        </Routes>
        <UserProfile visible={profileVisible} onCancel={() => setProfileVisible(false)} />
      </div>
      </Router>
    </NotificationProvider>
  );
}

export default App;