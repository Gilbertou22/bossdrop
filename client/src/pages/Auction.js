import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Spin, message, Alert, Select, Button, Card } from 'antd';
import AuctionList from '../components/AuctionList';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment';
import formatNumber from '../utils/formatNumber';

const { Option } = Select;

const statusMap = {
    active: '活躍',
    pending: '待處理',
    completed: '已結算',
    cancelled: '已取消',
    settled: '已結算',
};

const statusOptions = [
    { value: 'active', label: '活躍' },
    { value: 'pending', label: '待處理' },
    { value: 'completed', label: '已結算' },
    { value: 'cancelled', label: '已取消' },
];

const BASE_URL = 'http://localhost:5000';

const Auction = () => {
    const [auctions, setAuctions] = useState([]);
    const [wonAuctions, setWonAuctions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [wonLoading, setWonLoading] = useState(false);
    const [error, setError] = useState(null);
    const [wonError, setWonError] = useState(null);
    const [sortBy, setSortBy] = useState('createdAt');
    const [filterStatus, setFilterStatus] = useState('active');
    const [userDiamonds, setUserDiamonds] = useState(0);
    const [userRole, setUserRole] = useState(null);
    const [userId, setUserId] = useState(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setUserDiamonds(res.data.diamonds || 0);
            setUserRole(res.data.role || 'user');
            setUserId(res.data.id);
        } catch (err) {
            console.error('Fetch user info error:', err);
            message.error('無法獲取用戶信息，請重新登錄');
            navigate('/login');
        }
    };

    const fetchAuctions = useCallback(async (status = filterStatus, sort = sortBy) => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${BASE_URL}/api/auctions?status=${status}`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched auctions response with status filter:', { status, data: res.data });
            if (Array.isArray(res.data)) {
                const filteredAuctions = res.data.filter(auction => auction.status === status);
                console.log('Filtered auctions by status:', filteredAuctions);
                const sortedAuctions = [...filteredAuctions].sort((a, b) => {
                    if (sort === 'currentPrice') return b.currentPrice - a.currentPrice;
                    if (sort === 'endTime') return moment(b.endTime).diff(moment(a.endTime));
                    return moment(b.createdAt).diff(moment(a.createdAt));
                });
                console.log('Sorted auctions:', sortedAuctions);
                setAuctions(sortedAuctions);
            } else {
                throw new Error('後端返回數據格式錯誤，應為陣列');
            }
        } catch (err) {
            console.error('Fetch auctions error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
                stack: err.stack,
            });
            const status = err.response?.status;
            if (status === 401 || status === 403) {
                message.error('認證失敗，請重新登錄');
                navigate('/login');
            } else if (status === 500) {
                setError('服務器錯誤，請稍後重試');
            } else {
                setError(`獲取競標列表失敗: ${err.response?.data?.msg || err.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [filterStatus, sortBy, token, navigate]);

    const fetchWonAuctions = useCallback(async () => {
        console.log('Starting fetchWonAuctions...');
        setWonLoading(true);
        setWonError(null);
        try {
            console.log('Sending request to:', `${BASE_URL}/api/auctions/won`);
            console.log('Using token:', token);
            const res = await axios.get(`${BASE_URL}/api/auctions/won`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched won auctions response:', res.data);
            if (Array.isArray(res.data)) {
                setWonAuctions(res.data);
            } else {
                throw new Error('後端返回數據格式錯誤，應為陣列');
            }
        } catch (err) {
            console.error('Fetch won auctions error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
                stack: err.stack,
            });
            const status = err.response?.status;
            if (status === 401 || status === 403) {
                console.log('Authentication failed, redirecting to login...');
                message.error('認證失敗，請重新登錄');
                navigate('/login');
            } else if (status === 500) {
                setWonError('服務器錯誤，請稍後重試');
            } else {
                setWonError(`獲取得標列表失敗: ${err.response?.data?.msg || err.message}`);
            }
        } finally {
            setWonLoading(false);
        }
    }, [token, navigate]);

    useEffect(() => {
        console.log('useEffect triggered with token:', token);
        if (!token) {
            console.log('No token found, redirecting to login...');
            message.error('請先登錄！');
            navigate('/login');
            return;
        }
        fetchUserInfo();
        fetchAuctions();
        fetchWonAuctions();
    }, [fetchAuctions, fetchWonAuctions, navigate, token]);

    const handleStatusChange = (value) => {
        setFilterStatus(value);
    };

    const handleSortChange = (value) => {
        setSortBy(value);
    };

    const handleRefresh = () => {
        console.log('handleRefresh triggered');
        fetchAuctions(filterStatus, sortBy);
        fetchWonAuctions();
    };

    const handleSettleAuction = async (auctionId) => {
        try {
            const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/settle`, {}, {
                headers: { 'x-auth-token': token },
            });
            message.success(res.data.msg);
            fetchAuctions();
            fetchWonAuctions();
        } catch (err) {
            console.error('Settle auction error:', err.response?.data || err);
            message.error(`結算失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    const tabItems = [
        {
            key: '1',
            label: '拍賣列表',
            children: (
                <>
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <Select value={filterStatus} onChange={handleStatusChange} style={{ width: 120 }}>
                            {statusOptions.map(option => (
                                <Option key={option.value} value={option.value}>
                                    {option.label}
                                </Option>
                            ))}
                        </Select>
                        <Select value={sortBy} onChange={handleSortChange} style={{ width: 150 }}>
                            <Option value="createdAt">創建時間</Option>
                            <Option value="currentPrice">當前價格</Option>
                            <Option value="endTime">截止時間</Option>
                        </Select>
                    </div>
                    {loading ? (
                        <Spin tip="加載中..." style={{ display: 'block', textAlign: 'center' }} />
                    ) : error ? (
                        <Alert
                            message="錯誤"
                            description={error}
                            type="error"
                            showIcon
                            closable
                            onClose={() => setError(null)}
                            action={
                                <Button size="small" onClick={handleRefresh}>
                                    重新加載
                                </Button>
                            }
                            style={{ marginBottom: '20px' }}
                        />
                    ) : auctions.length > 0 ? (
                        <AuctionList
                            auctions={auctions}
                            fetchAuctions={fetchAuctions}
                            userRole={userRole}
                            userId={userId}
                            handleSettleAuction={handleSettleAuction}
                            isWonTab={false}
                        />
                    ) : (
                        <Alert
                            message="無數據"
                            description="目前沒有符合條件的競標。請檢查過濾條件或創建新競標。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '20px' }}
                        />
                    )}
                </>
            ),
        },
        {
            key: '2',
            label: '得標',
            children: (
                <>
                    {wonLoading ? (
                        <Spin tip="加載中..." style={{ display: 'block', textAlign: 'center' }} />
                    ) : wonError ? (
                        <Alert
                            message="錯誤"
                            description={wonError}
                            type="error"
                            showIcon
                            closable
                            onClose={() => setWonError(null)}
                            action={
                                <Button size="small" onClick={handleRefresh}>
                                    重新加載
                                </Button>
                            }
                            style={{ marginBottom: '20px' }}
                        />
                    ) : wonAuctions.length > 0 ? (
                        <AuctionList
                            auctions={wonAuctions}
                            fetchAuctions={fetchWonAuctions}
                            userRole={userRole}
                            userId={userId}
                            handleSettleAuction={handleSettleAuction}
                            isWonTab={true}
                        />
                    ) : (
                        <Alert
                            message="無數據"
                            description="您目前沒有得標的拍賣。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '20px' }}
                        />
                    )}
                </>
            ),
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h1 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>競標頁面</h1>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px', marginBottom: '20px' }}
            >
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>您的鑽石餘額：</span>
                        <span style={{ fontSize: '16px', color: '#1890ff' }}>{formatNumber(userDiamonds)} 💎</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <Button type="primary" onClick={(e) => {
                            e.stopPropagation();
                            console.log('Refresh button clicked');
                            handleRefresh();
                        }}>
                            手動刷新
                        </Button>
                    </div>
                </div>

                <Tabs defaultActiveKey="1" items={tabItems} />
            </Card>
        </div>
    );
};

export default Auction;