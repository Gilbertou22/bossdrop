import React, { useState, useEffect } from 'react';
import { Table, Button, DatePicker, Input, message, Image, Card, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { RangePicker } = DatePicker;

// 假設後端服務地址
const BASE_URL = 'http://localhost:5000';

const KillHistory = () => {
    const [history, setHistory] = useState([]);
    const [filters, setFilters] = useState({ boss_name: '', start_time: null, end_time: null });
    const [role, setRole] = useState(null); // 儲存用戶角色
    const [currentUser, setCurrentUser] = useState(null); // 儲存當前用戶名稱
    const [loading, setLoading] = useState(false); // 加載狀態
    const token = localStorage.getItem('token');


    useEffect(() => {
        if (!token) {
            message.error('請先登入以查看擊殺歷史！');
            return;
        }
        fetchUserInfo();
    }, [token]);

    // 當 role 和 currentUser 準備好時加載歷史記錄
    useEffect(() => {
        if (role !== null && currentUser !== null) {
            fetchHistory();
            fetchUserApplications(); // 獲取當前用戶的申請記錄
        }
    }, [role, currentUser, filters]);

    const [userApplications, setUserApplications] = useState([]); // 儲存用戶申請記錄

    const [userId, setUserId] = useState(null); // 確保定義 userId 狀態

    const fetchUserInfo = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setRole(res.data.role);
            setCurrentUser(res.data.character_name);
            setUserId(res.data.id); // 使用 res.data.id 替代 res.data._id
            console.log('Fetched user info - role:', res.data.role, 'user:', res.data.character_name, 'id:', res.data.id);
        } catch (err) {
            console.error('Fetch user info error:', err);
            message.error('載入用戶信息失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchUserApplications = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/applications/user`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched user applications raw:', res.data);
            const activeApplications = res.data
                .filter(app => app && (app.status === 'pending' || app.status === 'approved'))
                .map(app => {
                    if (!app.item_id) {
                        console.warn('Missing item_id in application:', app);
                        return null;
                    }
                    return `${userId}_${app.item_id}`;
                })
                .filter(app => app !== null);
            console.log('Processed user applications:', activeApplications);
            if (activeApplications.length === 0) {
                console.warn('No active applications found for user:', userId, 'Raw data:', res.data);
            }
            setUserApplications(activeApplications);
        } catch (err) {
            console.error('Fetch user applications error:', err);
            message.warning('無法載入申請記錄，申請中標示可能不準確');
        }
    };

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const params = {
                boss_name: filters.boss_name || undefined,
                start_time: filters.start_time ? filters.start_time.format('YYYY-MM-DD') : undefined,
                end_time: filters.end_time ? filters.end_time.format('YYYY-MM-DD') : undefined,
            };
            const res = await axios.get(`${BASE_URL}/api/boss-kills`, {
                headers: { 'x-auth-token': token },
                params,
            });
            console.log('Fetched kill history raw:', res.data);
            let filteredHistory = [...res.data];

            // 僅根據 currentUser 過濾出席記錄
            if (currentUser) {
                filteredHistory = filteredHistory.filter(kill =>
                    kill.attendees &&
                    Array.isArray(kill.attendees) &&
                    kill.attendees.includes(currentUser)
                );
                console.log('Filtered history by attendees:', filteredHistory);
            }

            // 假設 dropped_items 中每個 item 應有 item_id
            filteredHistory = filteredHistory.map(record => {
                const applyingItems = record.dropped_items
                    ?.filter(item => {
                        const itemId = item._id || item.id; // 假設 dropped_items 包含 item_id
                        const itemKey = `${userId}_${itemId}`;
                        console.log(`Checking itemKey: ${itemKey}, in userApplications:`, userApplications.includes(itemKey));
                        return userApplications.includes(itemKey);
                    })
                    ?.map(item => item.name) || [];
                console.log(`Record ${record._id} applyingItems:`, applyingItems);
                return {
                    ...record,
                    applyingItems,
                };
            });
            console.log('Filtered and enriched history with applyingItems:', filteredHistory);

            const updatedHistory = filteredHistory.map(record => ({
                ...record,
                screenshots: record.screenshots
                    ? record.screenshots.map(src => (src ? `${BASE_URL}/${src.replace('./', '')}` : ''))
                    : [],
            }));
            setHistory(updatedHistory);
        } catch (err) {
            console.error('Fetch kill history error:', err);
            message.error(`載入擊殺歷史失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };
 
    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = () => {
        fetchHistory();
    };
 
    const columns = [
        {
            title: '擊殺時間',
            dataIndex: 'kill_time',
            key: 'kill_time',
            sorter: (a, b) => moment(a.kill_time).unix() - moment(b.kill_time).unix(),
            render: text => moment(text).format('YYYY-MM-DD HH:mm'),
            width: 150,
        },
        {
            title: '首領名稱',
            dataIndex: 'boss_name',
            key: 'boss_name',
            sorter: (a, b) => a.boss_name.localeCompare(b.boss_name),
            width: 150,
        },
        {
            title: '參與者',
            dataIndex: 'attendees',
            key: 'attendees',
            sorter: (a, b) => (a.attendees ? a.attendees.join() : '').localeCompare(b.attendees ? b.attendees.join() : ''),
            render: attendees => attendees && Array.isArray(attendees) ? attendees.join(', ') : '無',
            width: 200,
        },
        {
            title: '掉落物品',
            dataIndex: 'dropped_items',
            key: 'dropped_items',
            sorter: (a, b) => (a.dropped_items ? a.dropped_items[0]?.name : '').localeCompare(b.dropped_items ? b.dropped_items[0]?.name : ''),
            render: (items, record) => {
                if (!items || !Array.isArray(items)) return '無';
                return items.map(item => {
                    const itemId = item._id || item.id; // 假設 dropped_items 包含 item_id
                    const itemKey = `${userId}_${itemId}`;
                    return (
                        <div key={itemKey}>
                            {`${item.name} (${item.type}, 截止 ${moment(item.apply_deadline).format('YYYY-MM-DD')})`}
                            {record.applyingItems.includes(item.name) && (
                                <span style={{ color: 'red', marginLeft: '8px' }}>（申請中）</span>
                            )}
                        </div>
                    );
                }).reduce((prev, curr) => [prev, ', ', curr]);
            },
            width: 250,
        },
        {
            title: '最終獲得者',
            dataIndex: 'final_recipient',
            key: 'final_recipient',
            width: 150,
        },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            sorter: (a, b) => a.status.localeCompare(b.status),
            width: 120,
        },
        {
            title: '創建時間',
            dataIndex: 'created_at',
            key: 'created_at',
            sorter: (a, b) => moment(a.created_at).unix() - moment(b.created_at).unix(),
            render: text => moment(text).format('YYYY-MM-DD HH:mm'),
            width: 150,
        },
        {
            title: '截圖',
            dataIndex: 'screenshots',
            key: 'screenshots',
            render: screenshots => (
                <Image.PreviewGroup>
                    {screenshots && screenshots.length > 0 ? (
                        screenshots.map((src, index) => (
                            <Image
                                key={index}
                                src={src}
                                alt={`截圖 ${index + 1}`}
                                style={{ width: '50px', height: '50px', objectFit: 'cover', marginRight: '8px' }}
                                preview={{ mask: '點擊預覽' }}
                                onError={(e) => console.log(`Image load error for ${src}:`, e)}
                            />
                        ))
                    ) : (
                        '無'
                    )}
                </Image.PreviewGroup>
            ),
            width: 150,
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>擊殺歷史記錄</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                    <Input
                        placeholder="輸入首領名稱"
                        value={filters.boss_name}
                        onChange={(e) => handleFilterChange('boss_name', e.target.value)}
                        style={{ width: 200, marginRight: 0 }}
                    />
                    <RangePicker
                        value={[filters.start_time, filters.end_time]}
                        onChange={(dates) => handleFilterChange('start_time', dates ? dates[0] : null) || handleFilterChange('end_time', dates ? dates[1] : null)}
                        style={{ marginRight: 0 }}
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ marginLeft: 'auto' }}>
                        搜索
                    </Button>
                </div>
                <Spin spinning={loading} size="large">
                    <Table
                        dataSource={history}
                        columns={columns}
                        rowKey="_id"
                        bordered
                        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
                        onChange={(pagination, filters, sorter) => {
                            console.log('Table sorted or paginated:', { pagination, filters, sorter }); // 調試
                        }}
                        scroll={{ x: 'max-content' }} // 確保表格在小屏幕上可水平滾動
                    />
                </Spin>
            </Card>
        </div>
    );
};

export default KillHistory;