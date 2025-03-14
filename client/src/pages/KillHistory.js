import React, { useState, useEffect } from 'react';
import { Row, Col, Button, DatePicker, Input, message, Image, Card, Spin, Alert, Tag, Tooltip, Popconfirm } from 'antd';
import { SearchOutlined, EditOutlined, PlusOutlined, CheckCircleOutlined, CheckOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import KillDetailModal from './KillDetailModal';
import AddAttendeeModal from './AddAttendeeModal'; // 導入補單模態框

const { RangePicker } = DatePicker;

const BASE_URL = 'http://localhost:5000';

const KillHistory = () => {
    const [history, setHistory] = useState([]);
    const [filters, setFilters] = useState({ boss_name: '', start_time: null, end_time: null, status: '' });
    const [role, setRole] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const token = localStorage.getItem('token');
    const [userId, setUserId] = useState(null);
    const [userApplications, setUserApplications] = useState([]);
    const [itemApplications, setItemApplications] = useState({});
    const [visible, setVisible] = useState(false);
    const [selectedKill, setSelectedKill] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [addVisible, setAddVisible] = useState(false); // 補單模態框可見性
    const [addKillId, setAddKillId] = useState(null); // 補單的 killId

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
            return res.data || [];
        } catch (err) {
            console.error(`Fetch applications error for kill_id: ${kill_id}, item_id: ${item_id}:`, err.response?.data || err.message);
            return [];
        }
    };

    const fetchKillDetail = async (killId) => {
        setModalLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/boss-kills/${killId}`, {
                headers: { 'x-auth-token': token },
            });
            const detail = res.data;
            detail.screenshots = detail.screenshots
                ? detail.screenshots.map(src => (src ? `${BASE_URL}/${src.replace('./', '')}` : ''))
                : [];
            setSelectedKill(detail);
        } catch (err) {
            console.error('Fetch kill detail error:', err);
            message.error(`載入詳情失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setModalLoading(false);
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
        if (applying) return;
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
            await fetchUserApplications();
            fetchHistory();
        } catch (err) {
            console.error('Quick apply error:', err.response?.data || err);
            message.error(`申請失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setApplying(false);
        }
    };

    const handleShowDetail = (killId, editing = false) => {
        fetchKillDetail(killId);
        setIsEditing(editing);
        setVisible(true);
    };

    const handleCloseModal = () => {
        setVisible(false);
        setSelectedKill(null);
        setIsEditing(false);
    };

    const handleUpdate = () => {
        fetchHistory(); // 刷新主頁數據
        handleCloseModal();
    };

    const handleShowAddModal = (killId) => {
        setAddKillId(killId);
        setAddVisible(true);
    };

    const handleCloseAddModal = () => {
        setAddVisible(false);
        setAddKillId(null);
    };

    const handleAddSubmit = () => {
        fetchHistory(); // 刷新主頁數據
        handleCloseAddModal();
    };

    // 渲染網格項
    const renderGridItem = (record) => {
        const firstScreenshot = record.screenshots[0] ; // 默認圖片
        const killTime = moment(record.kill_time).format('MM-DD HH:mm');
        const relativeTime = moment(record.kill_time).fromNow(); // 相對時間，如 "18小時前"
        const itemName = record.dropped_items && record.dropped_items.length > 0 ? record.dropped_items[0].name : '無';
        const bossName = record.boss_name || '未知首領';
        const isAttendee = record.attendees?.includes(currentUser); // 檢查是否已參與
        const canAddAttendee = record.status === 'pending' && !isAttendee; // 補單條件

        return (
            <Col xs={24} sm={12} md={8} lg={4} key={record._id} style={{ marginBottom: '8px', position: 'relative' }}>
                {isAttendee && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: '3px',
                            width: '30px',
                            height: '30px',
                            background: 'red',
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)', // 左上角三角形
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >
                        <CheckOutlined style={{ position: 'absolute', color: 'white', fontSize: '16px', left: '3px', top: '2px', }} />
                    </div>
                )}
                <Card
                    hoverable
                    cover={
                        <div style={{ position: 'relative', width: '100%', paddingTop: '66.67%' }}>
                            <Image
                                src={firstScreenshot}
                                alt="擊殺截圖"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                                onError={(e) => {
                                    console.error(`Image load error for ${firstScreenshot}:`, e);
                                    message.warning('截圖加載失敗，使用占位圖');
                                }}
                            />
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    color: 'rgba(255, 255, 255, 0.97)',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    background: 'rgba(0, 0, 0, 0.5)',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    wordBreak: 'break-all',
                                    lineHeight: '1.5',
                                    width: '80%',
                                    textShadow: '0 0 10px rgba(228, 243, 17, 0.87)',
                                    textAlign: 'center',
                                }}
                            >
                                [{killTime}]<br /> {itemName}
                            </div>
                        </div>
                    }
                    actions={[
                        <Tooltip title="查看詳情">
                            <Button type="link" onClick={() => handleShowDetail(record._id, false)}>詳情</Button>
                        </Tooltip>,
                        role !== 'admin' && record.dropped_items.some(item => {
                            const itemId = item._id || item.id;
                            const appDetails = getApplicationDetails(record._id, itemId);
                            let effectiveStatus = item.status ? item.status.toLowerCase() : 'pending';
                            const isExpired = item.apply_deadline && new Date(item.apply_deadline) < new Date();
                            if (isExpired && effectiveStatus !== 'assigned') effectiveStatus = 'expired';
                            const hasApprovedApplication = itemApplications[`${record._id}_${itemId}`]?.some(app => app.status === 'approved');
                            if (hasApprovedApplication && effectiveStatus !== 'expired') effectiveStatus = 'assigned';
                            return !appDetails && effectiveStatus === 'pending';
                        }) && (
                            <Popconfirm
                                title="確認申請此物品？"
                                onConfirm={() => handleQuickApply(record._id, record.dropped_items[0]._id || record.dropped_items[0].id, record.dropped_items[0].name)}
                                okText="是"
                                cancelText="否"
                            >
                                <Button type="primary" loading={applying} disabled={applying}>申請</Button>
                            </Popconfirm>
                        ),
                        role !== 'admin' && canAddAttendee && (
                            <Tooltip title="補登">
                                <Button type="primary" onClick={() => handleShowAddModal(record._id)}>補登</Button>
                            </Tooltip>
                        ),
                        role === 'admin' && record.status === 'pending' && (
                            <Tooltip title="編輯">
                                <Button type="link" icon={<EditOutlined />} onClick={() => handleShowDetail(record._id, true)}>編輯</Button>
                            </Tooltip>
                        ),
                        role === 'admin' && record.status === 'pending' && (
                            <Popconfirm
                                title="確認刪除此記錄？"
                                onConfirm={() => console.log(`Delete ${record._id}`)}
                                okText="是"
                                cancelText="否"
                            >
                                <Button type="danger">刪除</Button>
                            </Popconfirm>
                        ),
                    ]}
                >
                    <Card.Meta
                        title={
                            <>
                                <span style={{ fontSize: '12px', color: '#888' }}>{relativeTime}</span>
                                <br />
                                <span>{record.boss_name || '未知首領'}</span>
                            </>
                        }
                        description={
                            <>
                                <p>狀態: {getStatusTag(record.status)}</p>
                                <p>掉落物品: {record.dropped_items.map(item => item.name).join(', ') || '無'}</p>
                            </>
                        }
                    />
                </Card>
            </Col>
        );
    };

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
                        <Row gutter={[8, 8]}>
                            {history.map(record => renderGridItem(record))}
                        </Row>
                    )}
                </Spin>
            </Card>

            {/* 詳情模態框 */}
            <KillDetailModal
                visible={visible}
                onCancel={handleCloseModal}
                killData={selectedKill}
                onUpdate={handleUpdate}
                token={token}
                initialEditing={isEditing}
            />

            {/* 補單模態框 */}
            <AddAttendeeModal
                visible={addVisible}
                onCancel={handleCloseAddModal}
                killId={addKillId}
                token={token}
                onSubmit={handleAddSubmit}
            />

            <style jsx global>{`
                .ant-image {
                    position: static !important; /* 覆蓋 Ant Design 的 position: relative */
                }
                .ant-image .ant-image-mask {
                    position: static !important; /* 修復 MASK 遮蓋問題 */
                }
                .ant-descriptions-item-label {
                    background-color: #f5f5f5;
                    padding: 8px 16px;
                }
                .ant-descriptions-item-content {
                    padding: 8px 16px;
                }
            `}</style>
        </div>
    );
};

export default KillHistory;