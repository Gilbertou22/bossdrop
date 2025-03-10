import React, { useState, useEffect } from 'react';
import { Menu, Layout, Dropdown, Avatar, Badge, Button } from 'antd';
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
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import message from 'antd/es/message';
import UserProfile from '../pages/UserProfile';

const { Header } = Layout;

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const token = localStorage.getItem('token');
    const [user, setUser] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (token) {
            fetchUserInfo();            
        }
    }, [token]);

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/users/profile', {
                headers: { 'x-auth-token': token },
            });
            setUser(res.data);
            console.log('Fetched user info:', res.data);
        } catch (err) {
            console.error('Fetch user info error:', err.response?.data || err.message);
            if (err.response?.status === 404) {
                message.error('用戶信息路徑未找到，請檢查後端配置');
            } else if (err.response?.status === 401 || err.response?.status === 403 || err.response?.status === 500) {
                message.error('請求失敗，請重新登入:', err.response?.data?.msg);
                navigate('/login');
            } else {
                message.error('載入用戶信息失敗:', err.response?.data?.msg || err.message);
            }
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
                        { key: '/manage-users', label: '管理用戶', icon: <UserOutlined /> },
                        { key: '/stats', label: '統計報表', icon: <BarChartOutlined /> },
                    ],
                }
            );
        }

        return token ? baseItems : [{ key: '/', label: '首頁', icon: <HomeOutlined /> }];
    };

    const items = getItemsByRole(user?.role);

    return (
        <Header style={{ background: '#001529', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
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
            {token && user && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Dropdown overlay={userMenu} trigger={['click']} placement="bottomRight">
                        <Avatar
                            size={40}
                            src={user?.screenshot || `https://via.placeholder.com/40?text=${encodeURIComponent(user?.character_name || 'User')}`}
                            style={{ cursor: 'pointer', marginRight: '8px', backgroundColor: '#87d068' }}
                        />
                    </Dropdown>
                    <span style={{ color: '#fff', marginRight: '20px', verticalAlign: 'middle' }}>
                        {user?.character_name || '載入中...'}
                    </span>
                </div>
            )}
            {!token && (
                <div style={{ display: 'flex', alignItems: 'center', height: '64px' }}>
                    <Button
                        type="link"
                        icon={<LoginOutlined />}
                        onClick={() => navigate('/login')}
                        style={{ color: '#fff', marginRight: '15px', padding: '0 10px' }}
                    >
                        登錄
                    </Button>
                    <Button
                        type="link"
                        icon={<UserAddOutlined />}
                        onClick={() => navigate('/register')}
                        style={{ color: '#fff', padding: '0 10px' }}
                    >
                        註冊
                    </Button>
                </div>
            )}
            <UserProfile visible={profileVisible} onCancel={() => setProfileVisible(false)} />
        </Header>
    );
};

export default Navbar;