import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Menu, Layout, Dropdown, Avatar, Badge, Button, Popover, Drawer, Spin, message, Divider, Space, Typography } from 'antd';
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
    EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment';
import UserProfile from '../pages/UserProfile';
import { useNotification } from './NotificationContext';
import logger from '../utils/logger';
import { getIconMapping } from '../components/IconMapping';
import { AuthContext } from '../AuthProvider';

const { Header } = Layout;
const { SubMenu } = Menu;
const { Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);
    const { unreadCount, setUnreadCount, notifications, setNotifications } = useNotification();
    const [token, setToken] = useState(localStorage.getItem('token')); // 本地監聽 token 變化
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

        // 監聽 localStorage 的 token 變化
        const handleStorageChange = () => {
            const newToken = localStorage.getItem('token');
            setToken(newToken);
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // 監聽 token 和 user 變化，重新加載菜單數據
    useEffect(() => {
        console.log('Token:', token);
        console.log('User:', user);
        if (!token) {
            setMenuItems([{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
            setNotifications([]);
            setUnreadCount(0);
        } else if (user) {
            fetchNotifications();
            fetchMenuItems();
        }
    }, [token, user]);

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
            const res = await axios.get(`${BASE_URL}/api/session/menu`, {
                headers: { 'x-auth-token': token },                
                withCredentials: true,
            });

            console.log('Session menu response:', res.data); // 檢查 session 數據

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
                    if (!item._id) {
                        console.warn('Item with undefined _id:', item);
                        return false;
                    }
                    return !allChildIds.has(item._id.toString());
                })
                .map(item => ({
                    key: item.key,
                    label: item.label.includes('競標') && (user?.role === 'admin' || user?.role === 'moderator')
                        ? `${item.label} (${pendingCount})`
                        : item.label,
                    icon: item.customIcon ? <Avatar src={item.customIcon} size={20} /> : (getIconMapping()[item.icon] || null),
                    children: item.children
                        ? item.children.map(child => ({
                            key: child.key,
                            label: child.label,
                            icon: child.customIcon ? <Avatar src={child.customIcon} size={20} /> : (getIconMapping()[child.icon] || null),
                        }))
                        : undefined,
                }));

            console.log('Fetched menuItems:', menuItems); // 檢查過濾後的菜單項

            // 如果 menuItems 為空，設置默認菜單項
            if (menuItems.length === 0) {
                setMenuItems([{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
            } else {
                setMenuItems(menuItems);
            }
            logger.info('Fetched menu items from session', { menuItems });
        } catch (err) {
            logger.error('Fetch session menu items error', { error: err.response?.data || err.message });
            message.error('無法獲取菜單項');
            setMenuItems([{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
        }
    }, [token, user, pendingCount]);

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
        logout(); // 使用 AuthContext 的 logout 函數
        setNotifications([]);
        setUnreadCount(0);
        setMenuItems([{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
        message.success('已登出');
    };

    // 提取用戶名稱的第一個字節，處理多字節字符
    const getFirstCharacter = (name) => {
        if (!name) return 'U'; // 如果名稱不存在，顯示默認字符 "U"
        // 使用正則表達式提取第一個字符（支持多字節字符）
        const firstChar = name.match(/./u)?.[0];
        return firstChar || 'U'; // 如果提取失敗，返回默認字符 "U"
    };

    // 定義 handleMenuClick 函數
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

    // 定義 onOpenChange 函數
    const onOpenChange = (keys) => {
        logger.info('Menu open keys changed', { keys });
        setOpenKeys(keys);
    };

    // 定義 renderMenuItems 函數
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

    // 優化彈出選單的內容
    const userMenu = (
        <div style={{ width: '200px', padding: '8px' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <Avatar
                    size={48}
                    style={{
                        backgroundColor: '#87d068',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '8px',
                    }}
                >
                    {getFirstCharacter(user?.character_name)}
                </Avatar>
                <Text strong>{user?.character_name || '未知用戶'}</Text>
                <br />
                <Text type="secondary">{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '未知角色'}</Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <Menu onClick={handleMenuClick} selectable={false}>
                <Menu.Item key="profile" icon={<EditOutlined />}>
                    修改資料
                </Menu.Item>
                <Menu.Item key="logout" icon={<LogoutOutlined />}>
                    登出
                </Menu.Item>
            </Menu>
        </div>
    );

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
                            <Dropdown overlay={userMenu} trigger={['click']} placement="bottomRight">
                                <Avatar
                                    size={32}
                                    style={{
                                        cursor: 'pointer',
                                        backgroundColor: '#87d068',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.3s ease',
                                    }}
                                    className="user-avatar"
                                >
                                    {getFirstCharacter(user?.character_name)}
                                </Avatar>
                            </Dropdown>
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
                .user-avatar:hover {
                    transform: scale(1.1);
                    background-color: #5cb85c !important;
                }
                .ant-dropdown-menu {
                    padding: 0 !important;
                }
                .ant-dropdown-menu-item {
                    padding: 8px 16px !important;
                    transition: background-color 0.3s ease !important;
                }
                .ant-dropdown-menu-item:hover {
                    background-color: #f0f0f0 !important;
                }
            `}</style>
        </Header>
    );
};

export default Navbar;