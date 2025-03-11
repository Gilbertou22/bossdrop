import React, { useState, useEffect } from 'react';
import { Table, Button, DatePicker, Input, message, Image, Card, Spin, Alert, Tag, Tooltip, Popconfirm } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { RangePicker } = DatePicker;

const BASE_URL = 'http://localhost:5000';

const KillHistory = () => {
    const [history, setHistory] = useState([]);
    const [filters, setFilters] = useState({ boss_name: '', start_time: null, end_time: null, status: '' });
    const [role, setRole] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false); // 控制快速申請的加載狀態
    const token = localStorage.getItem('token');
    const [userId, setUserId] = useState(null);
    const [userApplications, setUserApplications] = useState([]);
    const [itemApplications, setItemApplications] = useState({});

    useEffect(() => {
        if (!token) {
            message.error('請先登入以查看擊殺歷史！');
            return;
        }
        fetchUserInfo();
    }, [token]);

    useEffect(() => {
        if (currentUser !== null) {
            fetchHistory();
            fetchUserApplications();
        }
    }, [currentUser, filters]);

    const fetchUserInfo = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setRole(res.data.role);
            setCurrentUser(res.data.character_name);
            setUserId(res.data.id);
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
            const activeApplications = res.data.filter(app => {
                if (!app) {
                    console.warn('Invalid application entry:', app);
                    return false;
                }
                if (!app.item_id) {
                    console.warn('Missing item_id in application:', app);
                    return false;
                }
                console.log('Application status:', app.status);
                return app.status === 'pending' || app.status === 'approved';
            });
            console.log('Processed user applications:', activeApplications);
            if (activeApplications.length === 0) {
                console.warn('No active applications after filtering. Raw data:', res.data);
            }
            setUserApplications(activeApplications);
        } catch (err) {
            console.error('Fetch user applications error:', err.response?.data || err.message);
            message.warning('無法載入申請記錄，申請中標示可能不準確');
        }
    };

    const fetchItemApplications = async (kill_id, item_id) => {
        try {
            const res = await axios.get(`${BASE_URL}/api/applications/by-kill-and-item`, {
                headers: { 'x-auth-token': token },
                params: { kill_id, item_id },
            });
            console.log(`Fetched applications for kill_id: ${kill_id}, item_id: ${item_id}:`, res.data);
            return res.data;
        } catch (err) {
            console.error(`Fetch applications error for kill_id: ${kill_id}, item_id: ${item_id}:`, err.response?.data || err.message);
            return [];
        }
    };

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const params = {
                boss_name: filters.boss_name || undefined,
                start_time: filters.start_time ? filters.start_time.format('YYYY-MM-DD') : undefined,
                end_time: filters.end_time ? filters.end_time.format('YYYY-MM-DD') : undefined,
                status: filters.status || undefined,
            };
            const res = await axios.get(`${BASE_URL}/api/boss-kills`, {
                headers: { 'x-auth-token': token },
                params,
            });
            console.log('Fetched kill history raw:', res.data);
            if (!res.data || res.data.length === 0) {
                console.warn('No boss kills data returned from API.');
                setHistory([]);
                setLoading(false);
                return;
            }

            const updatedHistory = res.data.map(record => {
                const applyingItems = record.dropped_items
                    ?.filter(item => {
                        const itemId = item._id || item.id;
                        if (!itemId) {
                            console.warn(`Missing item_id in dropped_items for record ${record._id}:`, item);
                            return false;
                        }
                        return userApplications.some(app => {
                            const appKillId = app.kill_id && app.kill_id._id ? app.kill_id._id.toString() : null;
                            return appKillId === record._id.toString() &&
                                app.item_id && app.item_id.toString() === itemId.toString() &&
                                app.status === 'pending';
                        });
                    })
                    ?.map(item => item.name) || [];
                console.log(`Record ${record._id} applyingItems:`, applyingItems);
                return {
                    ...record,
                    applyingItems,
                };
            });

            // 為管理員視圖獲取每個物品的申請者信息
            if (role === 'admin') {
                const applicationsMap = {};
                for (const record of updatedHistory) {
                    for (const item of record.dropped_items || []) {
                        const itemId = item._id || item.id;
                        if (itemId) {
                            const key = `${record._id}_${itemId}`;
                            const applications = await fetchItemApplications(record._id, itemId);
                            applicationsMap[key] = applications;
                        }
                    }
                }
                setItemApplications(applicationsMap);
            }

            const finalHistory = updatedHistory.map(record => ({
                ...record,
                screenshots: record.screenshots
                    ? record.screenshots.map(src => (src ? `${BASE_URL}/${src.replace('./', '')}` : ''))
                    : [],
            }));
            setHistory(finalHistory);
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

    const getStatusTag = (status) => {
        let color, text;
        switch (status) {
            case 'pending':
                color = 'gold';
                text = '待分配';
                break;
            case 'assigned':
                color = 'green';
                text = '已分配';
                break;
            case 'expired':
                color = 'red';
                text = '已過期';
                break;
            default:
                color = 'default';
                text = status || '未知';
        }
        return (
            <Tag
                color={color}
                style={{
                    borderRadius: '12px',
                    padding: '2px 12px',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
            >
                {text}
            </Tag>
        );
    };

    const getApplicationDetails = (killId, itemId) => {
        console.log(`Looking for application with killId: ${killId}, itemId: ${itemId}`);
        const app = userApplications.find(app => {
            const appKillId = app.kill_id && app.kill_id._id ? app.kill_id._id.toString() : null;
            const match = appKillId === killId.toString() &&
                app.item_id && app.item_id.toString() === itemId.toString() &&
                app.status === 'pending';
            console.log(`Checking application:`, app, `appKillId: ${appKillId}, Match: ${match}`);
            return match;
        });
        return app;
    };

    const handleQuickApply = async (killId, itemId, itemName) => {
        if (applying) return; // 防止重複點擊
        setApplying(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                message.error('請先登錄！');
                return;
            }
            const applicationKey = `${killId}_${itemId}`;
            if (userApplications.some(app => {
                const appKillId = app.kill_id && app.kill_id._id ? app.kill_id._id.toString() : null;
                return appKillId === killId.toString() && app.item_id.toString() === itemId.toString();
            })) {
                message.warning('您已為此物品提交申請！');
                return;
            }
            console.log(`Quick applying for killId: ${killId}, itemId: ${itemId}, itemName: ${itemName}`);
            const res = await axios.post(
                `${BASE_URL}/api/applications`,
                {
                    kill_id: killId,
                    item_id: itemId,
                    item_name: itemName,
                },
                { headers: { 'x-auth-token': token } }
            );
            console.log('Quick apply response:', res.data);
            message.success(res.data.msg || '申請提交成功！');
            await fetchUserApplications(); // 刷新申請記錄
            fetchHistory(); // 刷新頁面數據
        } catch (err) {
            console.error('Quick apply error:', err.response?.data || err);
            message.error(`申請失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setApplying(false);
        }
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
                    const itemId = item._id || item.id;
                    const appDetails = getApplicationDetails(record._id, itemId);
                    const applicationKey = `${record._id}_${itemId}`;
                    const applicants = role === 'admin' ? itemApplications[applicationKey] || [] : [];

                    return (
                        <div key={itemId} style={{ marginBottom: '8px' }}>
                            {`${item.name} (${item.type}, 截止 ${moment(item.apply_deadline).format('YYYY-MM-DD')})`}
                            {role !== 'admin' && appDetails && (
                                <Tag color="blue" style={{ marginLeft: 8 }}>
                                    申請中 (提交於: {moment(appDetails.created_at).format('MM-DD HH:mm')})
                                </Tag>
                            )}
                            {role === 'admin' && applicants.length > 0 && (
                                <Tooltip
                                    title={
                                        <ul style={{ paddingLeft: 15, margin: 0 }}>
                                            {applicants.map(app => (
                                                <li key={app._id}>
                                                    {app.user_id.character_name} ({app.status}) - 提交於: {moment(app.created_at).format('MM-DD HH:mm')}
                                                </li>
                                            ))}
                                        </ul>
                                    }
                                >
                                    <Tag color="blue" style={{ marginLeft: 8, cursor: 'pointer' }}>
                                        申請者: {applicants.length} 人
                                    </Tag>
                                </Tooltip>
                            )}
                            {role !== 'admin' && !appDetails && (
                                <Popconfirm
                                    title="確認申請此物品？"
                                    onConfirm={() => handleQuickApply(record._id, itemId, item.name)}
                                    okText="是"
                                    cancelText="否"
                                >
                                    <Button
                                        type="primary"
                                        size="small"
                                        style={{ marginLeft: 8 }}
                                        loading={applying}
                                        disabled={applying}
                                    >
                                        快速申請
                                    </Button>
                                </Popconfirm>
                            )}
                        </div>
                    );
                });
            },
            width: 300,
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
            render: (status) => getStatusTag(status),
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
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>{role === 'admin' ? '管理員 - 所有擊殺歷史記錄' : '擊殺歷史記錄'}</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                    <Input
                        placeholder="輸入首領名稱"
                        value={filters.boss_name}
                        onChange={(e) => handleFilterChange('boss_name', e.target.value)}
                        style={{ width: 200 }}
                    />
                    <RangePicker
                        value={[filters.start_time, filters.end_time]}
                        onChange={(dates) => {
                            handleFilterChange('start_time', dates ? dates[0] : null);
                            handleFilterChange('end_time', dates ? dates[1] : null);
                        }}
                        style={{ marginRight: 0 }}
                    />
                    <Input
                        placeholder="輸入狀態（待分配/已分配/已過期）"
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        style={{ width: 200 }}
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                        搜索
                    </Button>
                </div>
                <Spin spinning={loading || applying} size="large">
                    {history.length === 0 && !loading ? (
                        <Alert
                            message="無數據"
                            description="目前沒有符合條件的擊殺記錄。請檢查過濾條件或確保有相關數據。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <Table
                            dataSource={history}
                            columns={columns}
                            rowKey="_id"
                            bordered
                            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
                            onChange={(pagination, filters, sorter) => {
                                console.log('Table sorted or paginated:', { pagination, filters, sorter });
                            }}
                            scroll={{ x: 'max-content' }}
                        />
                    )}
                </Spin>
            </Card>
        </div>
    );
};

export default KillHistory;