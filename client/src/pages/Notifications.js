import React, { useState, useEffect } from 'react';
import { Card, Avatar, List, Badge, message, Spin } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../components/NotificationContext';

const BASE_URL = 'http://localhost:5000';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const { unreadCount, setUnreadCount } = useNotification();
    const [loading, setLoading] = useState(false);
    //const [unreadCount, setUnreadCount] = useState(0);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    useEffect(() => {
        fetchNotifications();
    }, [token]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/notifications`, {
                headers: { 'x-auth-token': token },
            });
            const enrichedNotifications = await Promise.all(res.data.notifications.map(async (notification) => {
                let imageUrl = 'https://via.placeholder.com/50';
                if (notification.auctionId) {
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
                }
                return { ...notification, imageUrl };
            }));
            setNotifications(enrichedNotifications);
            setUnreadCount(res.data.unreadCount);
            console.log('Notifications fetched, unreadCount:', res.data.unreadCount); // 調試
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
            console.log('Marking as read for notificationId:', id); // 調試
            await axios.put(`${BASE_URL}/api/notifications/${id}/read`, {}, {
                headers: { 'x-auth-token': token },
            });
            message.success('通知已標記為已讀');
            // 立即更新本地狀態
            setNotifications(notifications.map(n => n._id === id ? { ...n, read: true } : n));
            // 等待 fetchNotifications 完成後更新 unreadCount
            await fetchNotifications();
        } catch (err) {
            console.error('Mark as read error:', err);
            message.error('標記為已讀失敗');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>
                通知 <Badge count={unreadCount > 9 ? '9+' : unreadCount} />
            </h2>
            {loading ? (
                <Spin tip="加載中..." />
            ) : (
                <List
                    grid={{ gutter: 16, column: 1 }}
                    dataSource={notifications}
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
            )}
        </div>
    );
};

export default Notifications;