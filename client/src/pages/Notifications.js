import React, { useEffect, useState } from 'react';
import { Card, Avatar, List, Badge, message, Spin, Button, Select, Pagination, Row, Col, Alert } from 'antd';
import { SearchOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../components/NotificationContext';

const { Option } = Select;

const BASE_URL = 'http://localhost:5000';

const Notifications = () => {
    const { initialNotifications, setNotifications, unreadCount, setUnreadCount } = useNotification(); // 修正為 initialNotifications
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    const [notifications, setLocalNotifications] = useState(initialNotifications || []); // 本地狀態管理通知

    useEffect(() => {
        if (!token) {
            message.error('請先登入！');
            return;
        }
        fetchNotifications();
    }, [token, filter, currentPage, pageSize]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/notifications`, {
                headers: { 'x-auth-token': token },
            });
            let enrichedNotifications = await Promise.all(res.data.notifications.map(async (notification) => {
                let imageUrl = 'https://via.placeholder.com/50';
                if (notification.auctionId) {
                    try {
                        const auctionRes = await axios.get(`${BASE_URL}/api/auctions/${notification.auctionId}`, {
                            headers: { 'x-auth-token': token },
                        });
                        const auction = auctionRes.data;
                        if (auction && auction.itemId) {
                            const bossKillRes = await axios.get(`${BASE_URL}/api/boss-kills/${auction.itemId}`, {
                                headers: { 'x-auth-token': token },
                            });
                            const bossKill = bossKillRes.data;
                            if (bossKill && bossKill.dropped_items?.length) {
                                imageUrl = bossKill.dropped_items[0].imageUrl || 'https://via.placeholder.com/50';
                            }
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch auction or boss kill for notification ${notification._id}:`, err);
                    }
                }
                return { ...notification, imageUrl };
            }));
            // 過濾通知
            if (filter === 'unread') enrichedNotifications = enrichedNotifications.filter(n => !n.read);
            if (filter === 'read') enrichedNotifications = enrichedNotifications.filter(n => n.read);
            setLocalNotifications(enrichedNotifications); // 更新本地狀態
            setNotifications(enrichedNotifications); // 更新上下文狀態
            setUnreadCount(res.data.unreadCount);
            console.log('Notifications: Fetched unreadCount:', res.data.unreadCount);
        } catch (err) {
            console.error('Fetch notifications error:', err);
            message.error('無法獲取通知，請重新登錄');
            navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            console.log('Notifications: Marking as read for notificationId:', id);
            await axios.put(`${BASE_URL}/api/notifications/${id}/read`, {}, {
                headers: { 'x-auth-token': token },
            });
            message.success('通知已標記為已讀');
            setLocalNotifications(notifications.map(n => n._id === id ? { ...n, read: true } : n));
            fetchNotifications(); // 刷新以更新 unreadCount
        } catch (err) {
            console.error('Mark as read error:', err);
            message.error('標記為已讀失敗');
        }
    };

    const markAllAsRead = async () => {
        try {
            setLoading(true);
            const unreadNotifications = notifications.filter(n => !n.read).map(n => n._id);
            if (unreadNotifications.length === 0) {
                message.warning('沒有未讀通知');
                return;
            }
            await Promise.all(unreadNotifications.map(id =>
                axios.put(`${BASE_URL}/api/notifications/${id}/read`, {}, {
                    headers: { 'x-auth-token': token },
                })
            ));
            message.success('所有通知已標記為已讀');
            fetchNotifications(); // 刷新列表和未讀數量
        } catch (err) {
            console.error('Mark all as read error:', err);
            message.error('批量標記為已讀失敗');
        } finally {
            setLoading(false);
        }
    };

    const paginatedNotifications = notifications.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>通知</h2>
                        <Badge count={unreadCount > 9 ? '9+' : unreadCount} />
                    </div>
                }
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                        value={filter}
                        onChange={setFilter}
                        style={{ width: 200 }}
                        placeholder="過濾通知"
                    >
                        <Option value="all">全部</Option>
                        <Option value="unread">未讀</Option>
                        <Option value="read">已讀</Option>
                    </Select>
                    <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={markAllAsRead}
                        disabled={loading || unreadCount === 0}
                        style={{ marginLeft: 'auto' }}
                    >
                        批量標記為已讀
                    </Button>
                </div>
                <Spin spinning={loading} size="large">
                    {notifications.length === 0 && !loading ? (
                        <Alert
                            message="無通知"
                            description="目前沒有任何通知記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <>
                            <List
                                grid={{ gutter: 16, column: 1 }}
                                dataSource={paginatedNotifications}
                                renderItem={(notification) => (
                                    <List.Item>
                                        <Card
                                            hoverable
                                            style={{ width: '100%' }}
                                            onClick={() => {
                                                if (!notification.read) markAsRead(notification._id);
                                                if (notification.auctionId) navigate(`/auction/${notification.auctionId}`);
                                            }}
                                        >
                                            <Card.Meta
                                                avatar={<Avatar src={notification.imageUrl} size={50} />}
                                                title={
                                                    <span style={{ color: notification.read ? '#888' : '#000' }}>
                                                        {notification.message}
                                                    </span>
                                                }
                                                description={
                                                    <span style={{ color: notification.read ? '#888' : '#000' }}>
                                                        時間: {moment(notification.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                                                    </span>
                                                }
                                            />
                                        </Card>
                                    </List.Item>
                                )}
                            />
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={notifications.length}
                                onChange={setCurrentPage}
                                onShowSizeChange={(current, size) => {
                                    setCurrentPage(1);
                                    setPageSize(size);
                                }}
                                style={{ marginTop: '16px', textAlign: 'right' }}
                                showSizeChanger
                                pageSizeOptions={['10', '20', '50']}
                            />
                        </>
                    )}
                </Spin>
            </Card>
        </div>
    );
};

export default Notifications;