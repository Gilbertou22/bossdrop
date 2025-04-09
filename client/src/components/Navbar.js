import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Layout, Dropdown, Avatar, Badge, Button, Popover, Drawer, Spin, message } from 'antd';
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
import moment from 'moment';
import UserProfile from '../pages/UserProfile';
import { useNotification } from './NotificationContext';
import logger from '../utils/logger';

const { Header } = Layout;
const { SubMenu } = Menu;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const iconMapping = {
    HomeOutlined: <HomeOutlined />,
    SketchOutlined: <SketchOutlined />,
    FileDoneOutlined: <FileDoneOutlined />,
    ShoppingOutlined: <ShoppingOutlined />,
    BarChartOutlined: <BarChartOutlined />,
    DollarOutlined: <DollarOutlined />,
    TeamOutlined: <TeamOutlined />,
    GiftOutlined: <GiftOutlined />,
    CheckCircleOutlined: <CheckCircleOutlined />,
    UserOutlined: <UserOutlined />,
    CloudUploadOutlined: <CloudUploadOutlined />,
    AuditOutlined: <AuditOutlined />,
};

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const token = localStorage.getItem('token');
    const { unreadCount, setUnreadCount, notifications, setNotifications } = useNotification();
    const [user, setUser] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [openKeys, setOpenKeys] = useState([]);

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
            fetchMenuItems();
        }

        return () => window.removeEventListener('resize', handleResize);
    }, [token]);

    useEffect(() => {
        if (user && (user.role === 'admin' || user.role === 'moderator')) {
            fetchPendingCount();
        }
    }, [user]);

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    logger.info('User accepted the install prompt');
                } else {
                    logger.info('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    const fetchUserInfo = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/users/profile`, {
                headers: { 'x-auth-token': token },
            });
            setUser(res.data);
            logger.info('Fetched user info', { userId: res.data.id, role: res.data.role });
        } catch (err) {
            logger.error('Fetch user info error', { error: err.response?.data || err.message });
            if (err.response?.status === 401 || err.response?.status === 403) {
                message.error('請求失敗，請重新登入');
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    }, [token, navigate]);

    const fetchPendingCount = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/auctions/pending-count`, {
                headers: { 'x-auth-token': token },
            });
            setPendingCount(res.data.count);
            logger.info('Fetched pending auctions count', { count: res.data.count });
        } catch (err) {
            logger.error('Fetch pending count error', { error: err.response?.data || err.message });
            message.warning('無法獲取待處理拍賣數量');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/notifications`, {
                headers: { 'x-auth-token': token },
            });
            const enrichedNotifications = await Promise.all(res.data.notifications.slice(0, 5).map(async (notification) => {
                let imageUrl = 'https://via.placeholder.com/50';
                let isValidAuction = true;
                if (notification.auctionId) {
                    try {
                        const auctionRes = await axios.get(`${BASE_URL}/api/auctions/${notification.auctionId}`, {
                            headers: { 'x-auth-token': token },
                        });
                        const auction = auctionRes.data;
                        if (auction && auction.itemId) {
                            const itemId = typeof auction.itemId === 'object' && auction.itemId._id
                                ? auction.itemId._id
                                : auction.itemId;
                            if (typeof itemId !== 'string') {
                                logger.warn('Invalid itemId in auction', { auctionId: notification.auctionId, itemId });
                                return { ...notification, imageUrl, isValidAuction };
                            }
                            const bossKillRes = await axios.get(`${BASE_URL}/api/boss-kills/${itemId}`, {
                                headers: { 'x-auth-token': token },
                            });
                            const bossKill = bossKillRes.data;
                            if (bossKill && bossKill.screenshots?.length > 0) {
                                imageUrl = bossKill.screenshots[0].startsWith('http')
                                    ? bossKill.screenshots[0]
                                    : `${BASE_URL}/${bossKill.screenshots[0].replace(/\\/g, '/')}`;
                            }
                        }
                    } catch (err) {
                        if (err.response?.status === 404) {
                            logger.warn('Auction not found for notification', {
                                notificationId: notification._id,
                                auctionId: notification.auctionId,
                                error: err.response?.data || err.message,
                            });
                            isValidAuction = false;
                        } else {
                            logger.warn('Error fetching auction or boss kill for notification', {
                                notificationId: notification._id,
                                error: err.response?.data || err.message,
                            });
                        }
                    }
                }
                return { ...notification, imageUrl, isValidAuction };
            }));
            const validNotifications = enrichedNotifications.filter(notification => {
                if (notification.auctionId) {
                    return notification.isValidAuction;
                }
                return true;
            });
            setNotifications(validNotifications);
            setUnreadCount(res.data.unreadCount);
            logger.info('Fetched notifications', { unreadCount: res.data.unreadCount, notificationCount: validNotifications.length });
        } catch (err) {
            logger.error('Fetch notifications error', { error: err.response?.data || err.message });
            message.error('無法獲取通知，請重新登錄');
            navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [token, navigate, setNotifications, setUnreadCount]);

    const fetchMenuItems = useCallback(async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/menu`, {
                headers: { 'x-auth-token': token },
            });

            // 獲取所有子菜單項的 ID
            const allChildIds = new Set();
            res.data.forEach(item => {
                if (item.children && Array.isArray(item.children)) {
                    item.children.forEach(child => {
                        if (child && child._id) {
                            allChildIds.add(child._id.toString());
                        }
                    });
                }
            });

            // 過濾出第一層級菜單項（不包含已經作為子菜單的項）
            const menuItems = res.data
                .filter(item => {
                    // 處理異常的 roles 格式
                    let roles;
                    try {
                        roles = Array.isArray(item.roles) ? item.roles : JSON.parse(item.roles || '[]');
                        while (typeof roles === 'string') {
                            roles = JSON.parse(roles);
                        }
                    } catch (err) {
                        logger.warn('Failed to parse roles', { roles: item.roles, error: err.message });
                        roles = [];
                    }
                    // 過濾條件：必須符合角色，且不是任何其他項的子菜單
                    return roles.includes(user?.role || 'user') && !allChildIds.has(item._id.toString());
                })
                .map(item => ({
                    key: item.key,
                    label: item.label.includes('競標') && (user?.role === 'admin' || user?.role === 'moderator')
                        ? `${item.label} (${pendingCount})`
                        : item.label,
                    icon: item.customIcon ? <Avatar src={item.customIcon} size={20} /> : (iconMapping[item.icon] || null),
                    children: item.children
                        ? item.children
                            .filter(child => {
                                let childRoles;
                                try {
                                    childRoles = Array.isArray(child.roles) ? child.roles : JSON.parse(child.roles || '[]');
                                    while (typeof childRoles === 'string') {
                                        childRoles = JSON.parse(childRoles);
                                    }
                                } catch (err) {
                                    logger.warn('Failed to parse child roles', { roles: child.roles, error: err.message });
                                    childRoles = [];
                                }
                                return childRoles.includes(user?.role || 'user');
                            })
                            .map(child => ({
                                key: child.key,
                                label: child.label,
                                icon: child.customIcon ? <Avatar src={child.customIcon} size={20} /> : (iconMapping[child.icon] || null),
                            }))
                        : undefined,
                }));
            setMenuItems(token ? menuItems : [{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
            logger.info('Fetched menu items', { menuItems });
        } catch (err) {
            logger.error('Fetch menu items error', { error: err.response?.data || err.message });
            message.error('無法獲取菜單項');
        }
    }, [token, user, pendingCount]);

    useEffect(() => {
        if (user) {
            fetchMenuItems();
        }
    }, [user, pendingCount, fetchMenuItems]);

    const markAsRead = async (notificationId) => {
        try {
            setLoading(true);
            await axios.put(
                `${BASE_URL}/api/notifications/${notificationId}/read`,
                {},
                { headers: { 'x-auth-token': token } }
            );
            message.success('通知已標記為已讀');
            setNotifications(notifications.map(n => n._id === notificationId ? { ...n, read: true } : n));
            await fetchNotifications();
        } catch (err) {
            logger.error('Mark as read error', { notificationId, error: err.response?.data || err.message });
            message.error('標記為已讀失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setNotifications([]);
        setUnreadCount(0);
        navigate('/login');
        message.success('已登出');
    };

    const userMenuItems = [
        { key: 'profile', label: '修改資料', icon: <UserOutlined /> },
        { key: 'logout', label: '登出', icon: <LogoutOutlined /> },
    ];

    const handleMenuClick = ({ key }) => {
        logger.info('Menu item clicked', { key });
        const menuItem = menuItems.find(item => item.key === key) ||
            menuItems.flatMap(item => item.children || []).find(child => child.key === key);
        const hasChildren = menuItem && menuItem.children && menuItem.children.length > 0;

        if (key === 'profile') {
            setProfileVisible(true);
        } else if (key === 'logout') {
            handleLogout();
        } else if (key && typeof key === 'string' && key.startsWith('/')) {
            if (!hasChildren) {
                logger.info('Navigating to', { key });
                navigate(key);
                if (isMobile) {
                    setDrawerVisible(false);
                }
            }
        } else {
            logger.warn('Invalid menu item key', { key });
            message.warning('無效的路徑');
        }
    };

    const onOpenChange = (keys) => {
        logger.info('Menu open keys changed', { keys });
        setOpenKeys(keys);
    };

    const renderMenuItems = (items) => {
        return items.map(item => {
            if (item.children && item.children.length > 0) {
                return (
                    <SubMenu
                        key={item.key}
                        title={item.label}
                        icon={item.icon}
                    >
                        {renderMenuItems(item.children)}
                    </SubMenu>
                );
            }
            return (
                <Menu.Item key={item.key} icon={item.icon}>
                    {item.label}
                </Menu.Item>
            );
        });
    };

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
                            backgroundColor: notification.read ? '#fff' : '#f5f5f5',
                        }}
                        onClick={() => {
                            markAsRead(notification._id);
                            if (notification.auctionId && notification.isValidAuction) {
                                navigate(`/auction/${notification.auctionId}`);
                            } else if (notification.auctionId) {
                                message.warning('該拍賣已不存在');
                            }
                        }}
                    >
                        <Avatar
                            src={notification.imageUrl}
                            size={40}
                            style={{ marginRight: '10px' }}
                            onError={() => {
                                logger.warn('Failed to load notification image', { notificationId: notification._id, imageUrl: notification.imageUrl });
                                return true;
                            }}
                        />
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
                position: 'fixed',
                top: 0,
                width: '100%',
                zIndex: 1000,
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
                            openKeys={openKeys}
                            onOpenChange={onOpenChange}
                            onClick={handleMenuClick}
                        >
                            {renderMenuItems(menuItems)}
                        </Menu>
                    </Drawer>
                </>
            ) : (
                <Menu
                    theme="dark"
                    mode="horizontal"
                    selectedKeys={[location.pathname]}
                    openKeys={openKeys}
                    onOpenChange={onOpenChange}
                    onClick={handleMenuClick}
                    style={{ flex: 1, lineHeight: '64px', borderBottom: 'none', background: 'transparent' }}
                >
                    {renderMenuItems(menuItems)}
                </Menu>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '20px' }}>
                {deferredPrompt && (
                    <Button type="link" onClick={handleInstallPWA} style={{ color: '#fff', padding: '0 10px' }}>
                        安裝應用
                    </Button>
                )}
                {token && user && (
                    <Spin spinning={loading}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '20px' }}>
                            <Popover content={notificationContent} trigger="click" placement="bottomRight">
                                <Badge
                                    count={unreadCount > 9 ? '9+' : unreadCount}
                                    offset={[-10, 0]}
                                    style={{ backgroundColor: '#ff4d4f', boxShadow: '0 0 5px rgba(0, 0, 0, 0.3)' }}
                                >
                                    <BellOutlined style={{ fontSize: '20px', color: '#fff', cursor: 'pointer' }} />
                                </Badge>
                            </Popover>
                            <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} trigger={['click']} placement="bottomRight">
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
                        </div>
                    </Spin>
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
            <style jsx="true">{`
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