import React, { useEffect, useState } from 'react';
import { Menu, Layout, Dropdown, Avatar, Badge, Button, Popover, Drawer } from 'antd';
import {
    LoginOutlined,
    UserAddOutlined,
    FileDoneOutlined,
    ShoppingOutlined,
    BarChartOutlined,
    LogoutOutlined,
    DollarOutlined,
    HomeOutlined,
    TeamOutlined,
    GiftOutlined,
    CheckCircleOutlined,
    UserOutlined,
    BellOutlined,
    SketchOutlined,
    AuditOutlined,
    CloudUploadOutlined,
    MenuOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import message from 'antd/es/message';
import moment from 'moment';
import UserProfile from '../pages/UserProfile';
import { useNotification } from './NotificationContext';
import logger from '../utils/logger'; // 引入前端日誌工具

const { Header } = Layout;

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const token = localStorage.getItem('token');
    const { unreadCount, setUnreadCount, notifications, setNotifications } = useNotification();
    const [user, setUser] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        if (token) {
            fetchUserInfo();
            fetchNotifications();
            fetchPendingCount();
        }

        return () => window.removeEventListener('resize', handleResize);
    }, [token]);

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/users/profile', {
                headers: { 'x-auth-token': token },
            });
            setUser(res.data);
        } catch (err) {
            console.error('Fetch user info error:', err.response?.data || err.message);
            if (err.response?.status === 401 || err.response?.status === 403) {
                message.error('請求失敗，請重新登入');
                navigate('/login');
            }
        }
    };

    const fetchPendingCount = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/auctions/pending-count', {
                headers: { 'x-auth-token': token },
            });
            setPendingCount(res.data.count);
        } catch (err) {
            console.error('Fetch pending count error:', err);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/notifications', {
                headers: { 'x-auth-token': token },
            });
            const enrichedNotifications = await Promise.all(res.data.notifications.slice(0, 5).map(async (notification) => {
                let imageUrl = 'https://via.placeholder.com/50';
                if (notification.auctionId) {
                    const auctionRes = await axios.get(`http://localhost:5000/api/auctions/${notification.auctionId}`, {
                        headers: { 'x-auth-token': token },
                    });
                    const auction = auctionRes.data;
                    if (auction && auction.itemId) {
                        // 修復：確保 auction.itemId 是一個字符串
                        const itemId = typeof auction.itemId === 'object' && auction.itemId._id
                            ? auction.itemId._id
                            : auction.itemId;
                        if (typeof itemId !== 'string') {
                            logger.warn('Invalid itemId in auction', { auctionId: notification.auctionId, itemId });
                            return { ...notification, imageUrl };
                        }
                        const bossKillRes = await axios.get(`http://localhost:5000/api/boss-kills/${itemId}`, {
                            headers: { 'x-auth-token': token },
                        });
                        const bossKill = bossKillRes.data;
                        if (bossKill && bossKill.dropped_items?.length) {
                            imageUrl = bossKill.dropped_items[0].imageUrl || 'https://via.placeholder.com/50';
                        }
                    }
                }
                return { ...notification, imageUrl };
            }));
            setNotifications(enrichedNotifications);
            setUnreadCount(res.data.unreadCount);
            console.log('Navbar: Fetched unreadCount:', res.data.unreadCount);
        } catch (err) {
            console.error('Fetch notifications error:', err);
            message.error('無法獲取通知，請重新登錄');
            navigate('/login');
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            console.log('Navbar: Marking as read for notificationId:', notificationId);
            await axios.put(
                `http://localhost:5000/api/notifications/${notificationId}/read`,
                {},
                { headers: { 'x-auth-token': token } }
            );
            message.success('通知已標記為已讀');
            setNotifications(notifications.map(n => n._id === notificationId ? { ...n, read: true } : n));
            await fetchNotifications();
        } catch (err) {
            console.error('Navbar: Mark as read error:', err);
            message.error('標記為已讀失敗');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/login');
    };

    const userMenu = (
        <Menu>
            <Menu.Item key="profile" icon={<UserOutlined />} onClick={() => setProfileVisible(true)}>
                修改資料
            </Menu.Item>
            <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
                登出
            </Menu.Item>
        </Menu>
    );

    const getItemsByRole = (role) => {
        const baseItems = [
            { key: '/', label: '首頁', icon: <HomeOutlined /> },
            { key: '/wallet', label: '個人錢包', icon: <SketchOutlined /> },
            { key: '/apply-item', label: '申請物品', icon: <FileDoneOutlined /> },
            {
                key: '/auction',
                label: (
                    <span>
                        競標 <Badge count={pendingCount} style={{ backgroundColor: '#52c41a' }} />
                    </span>
                ),
                icon: <ShoppingOutlined />,
            },
            { key: '/kill-history', label: '擊殺歷史記錄', icon: <FileDoneOutlined /> },
        ];

        if (role === 'moderator' || role === 'admin') {
            baseItems.push(
                { key: '/approve-applications', label: '批准申請', icon: <CheckCircleOutlined /> },
                { key: '/create-auction', label: '發起競標', icon: <DollarOutlined /> },
            );
        }

        if (role === 'admin') {
            baseItems.push(
                {
                    key: 'management',
                    label: '管理',
                    icon: <TeamOutlined />,
                    children: [
                        { key: '/boss-kill', label: '記錄擊殺', icon: <FileDoneOutlined /> },
                        { key: '/manage-bosses', label: '管理首領', icon: <TeamOutlined /> },
                        { key: '/manage-items', label: '管理物品', icon: <GiftOutlined /> },
                        { key: '/manage-users', label: '管理盟友', icon: <UserOutlined /> },
                        { key: '/manage-items-level', label: '管理物品等級', icon: <GiftOutlined /> },
                        { key: '/stats', label: '統計報表', icon: <BarChartOutlined /> },
                        { key: '/approve-attend-request', label: '管理補登申請', icon: <CloudUploadOutlined /> },
                    ],
                }
            );
        }

        return token ? baseItems : [{ key: '/', label: '首頁', icon: <HomeOutlined /> }];
    };

    const items = getItemsByRole(user?.role);

    const notificationContent = (
        <div style={{ maxHeight: '300px', overflowY: 'auto', width: '300px' }}>
            {notifications.length > 0 ? (
                notifications.map((notification) => (
                    <div
                        key={notification._id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0',
                        }}
                        onClick={() => {
                            markAsRead(notification._id);
                            if (notification.auctionId) navigate(`/auction/${notification.auctionId}`);
                        }}
                    >
                        <Avatar src={notification.imageUrl} size={40} style={{ marginRight: '10px' }} />
                        <div>
                            <p style={{ margin: 0 }}>{notification.message}</p>
                            <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>
                                {moment(notification.createdAt).fromNow()}
                            </p>
                        </div>
                    </div>
                ))
            ) : (
                <p style={{ padding: '8px', textAlign: 'center' }}>暫無通知</p>
            )}
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <a onClick={() => navigate('/notifications')}>查看所有通知</a>
            </div>
        </div>
    );

    return (
        <Header
            style={{
                background: '#001529',
                padding: '0 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '64px',
                position: 'fixed', // 確保固定
                top: 0, // 固定在頂部
                width: '100%',
                zIndex: 1000, // 確保層級最高
            }}
        >
            {isMobile ? (
                <>
                    <Button
                        type="link"
                        icon={<MenuOutlined />}
                        onClick={() => setDrawerVisible(true)}
                        style={{ color: '#fff', fontSize: '20px', marginRight: '10px' }}
                    />
                    <Drawer
                        title="導航"
                        placement="left"
                        onClose={() => setDrawerVisible(false)}
                        open={drawerVisible}
                        bodyStyle={{ padding: 0 }}
                        width={250}
                    >
                        <Menu
                            theme="light"
                            mode="inline"
                            selectedKeys={[location.pathname]}
                            items={items}
                            onClick={({ key }) => {
                                if (key === 'profile') setProfileVisible(true);
                                else {
                                    navigate(key);
                                    setDrawerVisible(false);
                                }
                            }}
                        />
                    </Drawer>
                </>
            ) : (
                <Menu
                    theme="dark"
                    mode="horizontal"
                    selectedKeys={[location.pathname]}
                    items={items}
                    onClick={({ key }) => {
                        if (key === 'profile') setProfileVisible(true);
                        else navigate(key);
                    }}
                    style={{ flex: 1, lineHeight: '64px', borderBottom: 'none', background: 'transparent' }}
                />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '20px' }}>
                {deferredPrompt && (
                    <Button type="link" onClick={handleInstallPWA} style={{ color: '#fff', padding: '0 10px' }}>
                        安裝應用
                    </Button>
                )}
                {token && user && (
                    <>
                        <Popover content={notificationContent} trigger="click" placement="bottomRight">
                            <Badge
                                count={unreadCount > 9 ? '9+' : unreadCount}
                                offset={[-10, 0]}
                                style={{ backgroundColor: '#ff4d4f', boxShadow: '0 0 5px rgba(0, 0, 0, 0.3)' }}
                            >
                                <BellOutlined style={{ fontSize: '20px', color: '#fff', cursor: 'pointer' }} />
                            </Badge>
                        </Popover>
                        <Dropdown overlay={userMenu} trigger={['click']} placement="bottomRight">
                            <Avatar
                                size={32}
                                src={user?.screenshot || `https://via.placeholder.com/32?text=${encodeURIComponent(user?.character_name || 'User')}`}
                                style={{ cursor: 'pointer', backgroundColor: '#87d068' }}
                            />
                        </Dropdown>
                        {!isMobile && (
                            <span style={{ color: '#fff', verticalAlign: 'middle', fontSize: '16px' }}>
                                {user?.character_name || '載入中...'}
                            </span>
                        )}
                    </>
                )}
                {!token && (
                    <>
                        <Button
                            type="link"
                            icon={<LoginOutlined />}
                            onClick={() => navigate('/login')}
                            style={{ color: '#fff', padding: '0 10px', fontSize: '16px' }}
                        >
                            登錄
                        </Button>
                        <Button
                            type="link"
                            icon={<UserAddOutlined />}
                            onClick={() => navigate('/register')}
                            style={{ color: '#fff', padding: '0 10px', fontSize: '16px' }}
                        >
                            註冊
                        </Button>
                    </>
                )}
            </div>
            <UserProfile visible={profileVisible} onCancel={() => setProfileVisible(false)} />
            <style jsx>{`
                @media (max-width: 768px) {
                    .ant-btn {
                        padding: 4px 8px !important;
                    }
                    .ant-avatar {
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .ant-badge {
                        margin-right: 0 !important;
                    }
                }
            `}</style>
        </Header>
    );
};

export default Navbar;