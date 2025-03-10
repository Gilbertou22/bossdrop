import React, { useState, useEffect, useCallback } from 'react';
import AuctionList from '../components/AuctionList';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Spin, message, Alert, Select, Button } from 'antd';
import moment from 'moment';

// 定義 status 的中文映射
const statusMap = {
    active: '活躍',
    pending: '待處理',
    completed: '已結算',
    cancelled: '已取消',
};

// 定義 status 選項
const statusOptions = [
    { value: 'active', label: '活躍' },
    { value: 'pending', label: '待處理' },
    { value: 'completed', label: '已結算' },
    { value: 'cancelled', label: '已取消' },
];

const { Option } = Select;

const Auction = () => {
    const [auctions, setAuctions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('createdAt');
    const [filterStatus, setFilterStatus] = useState('active'); // 默認過濾活躍狀態
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const BASE_URL = 'http://localhost:5000';

    // 獲取競標列表
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

    // 初次加載時獲取數據，但不設置間隔刷新
    useEffect(() => {
        fetchAuctions();
    }, [fetchAuctions]);

    // 處理狀態過濾變化
    const handleStatusChange = (value) => {
        setFilterStatus(value);
        // 不自動刷新，等待手動觸發
    };

    // 處理排序變化
    const handleSortChange = (value) => {
        setSortBy(value);
        // 不自動刷新，等待手動觸發
    };

    // 手動刷新
    const handleRefresh = () => {
        fetchAuctions(filterStatus, sortBy);
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>競標頁面</h1>

            {/* 過濾和排序控制面板 */}
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

            {/* 加載、錯誤或數據顯示 */}
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
                <AuctionList auctions={auctions} fetchAuctions={fetchAuctions} />
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