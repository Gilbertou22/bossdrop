import React, { useState, useEffect, useCallback } from 'react';
import AuctionList from '../components/AuctionList';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Spin, message, Alert, Select, Button } from 'antd';
import moment from 'moment';

const { Option } = Select;

const Auction = () => {
    const [auctions, setAuctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('createdAt'); // 默認按創建時間排序
    const [filterStatus, setFilterStatus] = useState('active'); // 默認篩選活躍競標
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    // 獲取競標數據
    const fetchAuctions = useCallback(async (status = filterStatus, sort = sortBy) => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`http://localhost:5000/api/auctions?status=${status}`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched auctions response:', res.data);
            if (Array.isArray(res.data)) {
                // 按指定字段排序
                const sortedAuctions = [...res.data].sort((a, b) => {
                    if (sort === 'currentPrice') return b.currentPrice - a.currentPrice;
                    if (sort === 'endTime') return moment(b.endTime).diff(moment(a.endTime));
                    return moment(b.createdAt).diff(moment(a.createdAt)); // 默認按創建時間
                });
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

    // 實時更新（每 30 秒刷新）
    useEffect(() => {
        fetchAuctions();
        const interval = setInterval(() => {
            fetchAuctions();
        }, 30000); // 每 30 秒刷新一次
        return () => clearInterval(interval); // 組件卸載時清除
    }, [fetchAuctions]);

    // 處理篩選變化
    const handleStatusChange = (value) => {
        setFilterStatus(value);
        fetchAuctions(value, sortBy);
    };

    // 處理排序變化
    const handleSortChange = (value) => {
        setSortBy(value);
        fetchAuctions(filterStatus, value);
    };

    // 手動刷新
    const handleRefresh = () => {
        fetchAuctions(filterStatus, sortBy);
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>競標頁面</h1>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <Select value={filterStatus} onChange={handleStatusChange} style={{ width: 120 }}>
                    <Option value="active">活躍</Option>
                    <Option value="pending">待處理</Option>
                    <Option value="settled">已結算</Option>
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
                <Spin tip="加載中..." />
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
                />
            ) : auctions.length > 0 ? (
                <AuctionList auctions={auctions} fetchAuctions={fetchAuctions} />
            ) : (
                <p>目前沒有符合條件的競標。</p>
            )}
        </div>
    );
};

export default Auction;