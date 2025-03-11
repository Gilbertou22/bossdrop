import React, { useState, useEffect, useCallback } from 'react';
import AuctionList from '../components/AuctionList';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Spin, message, Alert, Select, Button } from 'antd';
import moment from 'moment';

const { Option } = Select;

const statusMap = {
    active: '活躍',
    pending: '待處理',
    completed: '已結算',
    cancelled: '已取消',
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('createdAt');
    const [filterStatus, setFilterStatus] = useState('active');
    const [userDiamonds, setUserDiamonds] = useState(0);
    const [userRole, setUserRole] = useState(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setUserDiamonds(res.data.diamonds || 0);
            setUserRole(res.data.role || 'user');
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

    useEffect(() => {
        if (!token) {
            message.error('請先登錄！');
            navigate('/login');
            return;
        }
        fetchUserInfo();
        fetchAuctions();
    }, [fetchAuctions, navigate, token]);

    const handleStatusChange = (value) => {
        setFilterStatus(value);
    };

    const handleSortChange = (value) => {
        setSortBy(value);
    };

    const handleRefresh = () => {
        fetchAuctions(filterStatus, sortBy);
    };

    const handleSettleAuction = async (auctionId) => {
        try {
            const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/settle`, {}, {
                headers: { 'x-auth-token': token },
            });
            message.success(res.data.msg);
            fetchAuctions();
        } catch (err) {
            console.error('Settle auction error:', err.response?.data || err);
            message.error(`結算失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>競標頁面</h1>
            <div style={{ marginBottom: '20px' }}>
                <p>您的鑽石餘額：{userDiamonds} 鑽石</p>
                <Button onClick={() => navigate('/notifications')}>查看通知</Button>
            </div>

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
                <Button type="primary" onClick={handleRefresh}>
                    手動刷新
                </Button>
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
                    handleSettleAuction={handleSettleAuction}
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
        </div>
    );
};

export default Auction;