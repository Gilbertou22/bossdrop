import React, { useState, useEffect } from 'react';
import { Table, message } from 'antd';
import axios from 'axios';
import moment from 'moment';

const BASE_URL = 'http://localhost:5000';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/notifications`, {
                headers: { 'x-auth-token': token },
            });
            setNotifications(res.data);
        } catch (err) {
            console.error('Fetch notifications error:', err);
            message.error('無法獲取通知，請稍後重試！');
        }
    };

    const columns = [
        {
            title: '消息',
            dataIndex: 'message',
            key: 'message',
        },
        {
            title: '時間',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: '狀態',
            dataIndex: 'read',
            key: 'read',
            render: (read) => (read ? '已讀' : '未讀'),
        },
    ];

    return (
        <div style={{ padding: '20px' }}>
            <h2>通知</h2>
            <Table
                dataSource={notifications}
                columns={columns}
                rowKey="_id"
                pagination={{ pageSize: 5 }}
                locale={{ emptyText: '暫無通知' }}
            />
        </div>
    );
};

export default Notifications;