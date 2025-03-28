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
import ManageItemLevels from './pages/ManageItemLevels';
import RoleRoute from './components/RoleRoute';
import Navbar from './components/Navbar';
import KillHistory from './pages/KillHistory';
import KillDetail from './pages/KillDetail';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications';
import Guilds from './pages/GuildSettings';
import ApproveAttendRequest from './pages/ManageSupplementRequests';
import React, { useState } from 'react';
import { NotificationProvider } from './components/NotificationContext';
import { Layout, Spin, Typography } from 'antd';
import ChangePassword from './components/ChangePassword';
import LogViewer from './pages/LogViewer';
import Wallet from './pages/Wallet';
import DKPSettings from './pages/DKPSettings';
import DKPHistory from './pages/DKPHistory';

const { Content, Footer } = Layout;
const { Text } = Typography;

function App() {
    const [profileVisible, setProfileVisible] = useState(false);

    return (
        <NotificationProvider>
            <Router>
                <Layout style={{ minHeight: '100vh' }}>
                    <Navbar />
                    <Layout style={{ marginTop: '64px' }}>
                        <Content
                            style={{
                                padding: '20px',
                                minHeight: 'calc(100vh - 64px - 64px)', // 減去 Navbar 和 Footer 高度
                                overflowX: 'hidden',
                                overflowY: 'auto',
                                background: '#fff',
                                flex: '1 0 auto', // 確保 Content 佔據剩餘空間
                            }}
                        >
                            <Spin spinning={false} size="large">
                                <Routes>
                                    <Route path="/" element={<Home />} />
                                    <Route path="/register" element={<Register />} />
                                    <Route path="/login" element={<Login />} />
                                    <Route
                                        path="/change-password"
                                        element={
                                            <RoleRoute mustChangePasswordRedirect allowedRoles={['user', 'moderator', 'admin']}>
                                                <ChangePassword />
                                            </RoleRoute>
                                        }
                                    />
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
                                        path="/logs"
                                        element={
                                            <RoleRoute allowedRoles={['admin']}>
                                                <LogViewer />
                                            </RoleRoute>
                                        }
                                    />
                                    <Route
                                        path="/dkp/settings"
                                        element={
                                            <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                <DKPSettings />
                                            </RoleRoute>
                                        }
                                    />
                                    <Route
                                        path="/dkp/history"
                                        element={
                                            <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                <DKPHistory />
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
                                        path="/wallet"
                                        element={
                                            <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                <Wallet />
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
                                        path="/manage-items-level"
                                        element={
                                            <RoleRoute allowedRoles={['admin']}>
                                                <ManageItemLevels />
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
                                        path="/kill-detail/:id"
                                        element={
                                            <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                <KillDetail />
                                            </RoleRoute>
                                        }
                                    />
                                    <Route
                                        path="/guilds"
                                        element={
                                            <RoleRoute allowedRoles={['admin']}>
                                                <Guilds />
                                            </RoleRoute>
                                        }
                                    />
                                    <Route
                                        path="/approve-attend-request"
                                        element={
                                            <RoleRoute allowedRoles={['moderator', 'admin']}>
                                                <ApproveAttendRequest />
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
                                    <Route path="*" element={<h1 style={{ textAlign: 'center', padding: '20px' }}>404 - 頁面未找到</h1>} />
                                </Routes>
                            </Spin>
                        </Content>
                        {/* 添加 Footer */}
                        <Footer style={{ textAlign: 'center', padding: '4px 0', flexShrink: 0 }}>
                            <Text type="secondary">
                                Copyright 邊緣香菇 © 2025 Ver.2025.1.0.0
                            </Text>
                        </Footer>
                    </Layout>
                    <UserProfile visible={profileVisible} onCancel={() => setProfileVisible(false)} />
                </Layout>
            </Router>
        </NotificationProvider>
    );
}

export default App;