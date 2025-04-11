import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, message, Select, Row, Col, Spin, Alert, Popconfirm, Pagination, Space, Card, Descriptions, Tag, Checkbox } from 'antd';
import { SearchOutlined, DeleteOutlined, SyncOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import formatNumber from '../utils/formatNumber';
import moment from 'moment';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import logger from '../utils/logger';

const { Option } = Select;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const ManageUsers = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isBroadcastModalVisible, setIsBroadcastModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [form] = Form.useForm();
    const [broadcastForm] = Form.useForm();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({ search: '', status: 'all' });
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0 });
    const [growthData, setGrowthData] = useState([]);
    const [guilds, setGuilds] = useState([]);
    const [useGuildPassword, setUseGuildPassword] = useState(false);
    const token = localStorage.getItem('token');
    const [online, setOnline] = useState(navigator.onLine);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    useEffect(() => {
        fetchGuilds();
    }, []);

    const fetchGuilds = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/guilds`, {
                headers: { 'x-auth-token': token },
            });
            setGuilds(res.data);
        } catch (err) {
            console.error('Fetch guilds error:', err);
            message.error('載入旅團列表失敗');
        }
    };

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
               
                } else {
               
                }
                setDeferredPrompt(null);
            });
        }
    };

    const fetchUsers = useCallback(async () => {
        if (!online) {
            message.warning('目前處於離線模式，使用上次數據');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/users`, {
                headers: { 'x-auth-token': token },
                params: {
                    search: filters.search || undefined,
                    status: filters.status === 'all' ? undefined : filters.status,
                },
            });
            if (Array.isArray(res.data)) {
                setUsers(res.data);
                setFilteredUsers(res.data);
              
            } else {
              
                setUsers([]);
                setFilteredUsers([]);
                message.warning('API 返回數據格式不正確');
            }
        } catch (err) {
            console.error('Fetch users error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
            });
            if (err.response?.status === 401 || err.response?.status === 403) {
                message.error(err.response?.data?.msg || '無權限訪問，請檢查 Token 或權限');
            } else {
                message.error(`載入盟友列表失敗: ${err.response?.data?.msg || err.message}`);
            }
            setUsers([]);
            setFilteredUsers([]);
        } finally {
            setLoading(false);
        }
    }, [token, filters, online]);

    const fetchStats = useCallback(async () => {
        if (!online) return;
        try {
            const res = await axios.get(`${BASE_URL}/api/users/stats`, {
                headers: { 'x-auth-token': token },
            });
            setStats(res.data);
        } catch (err) {
            console.error('Fetch stats error:', err);
            message.error(`獲取統計數據失敗: ${err.response?.data?.msg || err.message}`);
        }
    }, [token, online]);

    const fetchGrowthData = useCallback(async () => {
        if (!online) return;
        try {
            const res = await axios.get(`${BASE_URL}/api/users/growth`, {
                headers: { 'x-auth-token': token },
            });
            setGrowthData(res.data);
        } catch (err) {
            console.error('Fetch growth data error:', err);
            message.error(`獲取增長趨勢失敗: ${err.response?.data?.msg || err.message}`);
        }
    }, [token, online]);

    useEffect(() => {
        fetchUsers();
        fetchStats();
        fetchGrowthData();
        const interval = setInterval(() => {
            fetchUsers();
            fetchStats();
            fetchGrowthData();
        }, 60000);
        return () => clearInterval(interval);
    }, [fetchUsers, fetchStats, fetchGrowthData]);

    const showModal = (user = null) => {
        if (!token) {
            message.error('請先登入以管理盟友！');
            return;
        }
        setEditingUser(user);
        setUseGuildPassword(false);
        form.resetFields();
        form.setFieldsValue({
            world_name: user?.world_name || '',
            character_name: user?.character_name || '',
            discord_id: user?.discord_id || '',
            raid_level: user?.raid_level || 0,
            diamonds: user?.diamonds || 0,
            status: user?.status || 'pending',
            screenshot: user?.screenshot || '',
            role: user?.role || 'user',
            guildId: user?.guildId || null,
            mustChangePassword: user?.mustChangePassword || false,
            password: '',
            confirm_password: '',
            useGuildPassword: false,
        });
        setIsModalVisible(true);
    };

    const showDetailModal = (user) => {
        setSelectedUser(user);
        setIsDetailModalVisible(true);
    };

    const handleOk = async () => {
        try {
            if (!token) {
                message.error('請先登入以管理盟友！');
                return;
            }
            const values = await form.validateFields();
            if (values.password && values.confirm_password && values.password !== values.confirm_password) {
                message.error('兩次輸入的密碼不一致！');
                return;
            }

            const { confirm_password, ...filteredValues } = values;

            if (filteredValues.raid_level !== undefined && filteredValues.raid_level !== null && filteredValues.raid_level !== '') {
                filteredValues.raid_level = parseInt(filteredValues.raid_level, 10);
            } else {
                filteredValues.raid_level = 0;
            }

            if (filteredValues.diamonds) {
                filteredValues.diamonds = parseInt(filteredValues.diamonds, 10);
            }

            if (!editingUser && (!filteredValues.character_name || !filteredValues.guildId)) {
                message.error('請確保角色名稱和旅團已填寫！');
                return;
            }

            const formData = new FormData();
            Object.keys(filteredValues).forEach(key => {
                formData.append(key, filteredValues[key] !== undefined && filteredValues[key] !== null ? filteredValues[key] : '');
            });

            const formDataEntries = {};
            for (let [key, value] of formData.entries()) {
                formDataEntries[key] = value;
            }
      

            const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users/create-member';
            const method = editingUser ? 'put' : 'post';

            setLoading(true);
            const res = await axios[method](`${BASE_URL}${url}`, formData, {
                headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
            });
            message.success(`盟友${editingUser ? '更新' : '創建'}成功`);
            setIsModalVisible(false);
            fetchUsers();
        } catch (err) {
           
            if (err.response) {
                message.error(`盟友${editingUser ? '更新' : '創建'}失敗: ${err.response.data?.msg || err.message}`);
            } else if (err.request) {
                message.error(`網絡請求失敗: 請檢查服務器連線`);
            } else {
                message.error(`請求配置錯誤: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const user = users.find(u => u._id === id);
        if (user && (user.role === 'admin' || user.role === 'guild')) {
            message.error(`無法刪除角色為 ${user.role} 的帳號！`);
            return;
        }

        try {
            if (!token) {
                message.error('請先登入以管理盟友！');
                return;
            }
            setLoading(true);
            const res = await axios.delete(`${BASE_URL}/api/users/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('盟友刪除成功');
            fetchUsers();
        } catch (err) {
            console.error('Delete user error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
                code: err.code,
            });
            message.error('盟友刪除失敗: ' + err.response?.data?.msg || err.message || '網絡錯誤');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        if (!token || selectedRowKeys.length === 0) {
            message.warning('請先登入並選擇至少一個盟友進行刪除');
            return;
        }

        const selectedUsers = users.filter(user => selectedRowKeys.includes(user._id));
        const protectedUsers = selectedUsers.filter(user => user.role === 'admin' || user.role === 'guild');
        if (protectedUsers.length > 0) {
            const protectedRoles = protectedUsers.map(user => user.role).join(', ');
            message.error(`無法刪除角色為 ${protectedRoles} 的帳號！`);
            return;
        }

        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/users/batch-delete`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success('批量刪除成功');
            fetchUsers();
            setSelectedRowKeys([]);
        } catch (err) {
            console.error('Batch delete error:', err);
            message.error(`批量刪除失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (user) => {
        try {
            setLoading(true);
            const newStatus = user.status === 'active' ? 'pending' : 'active';
            await axios.put(`${BASE_URL}/api/users/${user._id}`, {
                ...user,
                status: newStatus,
            }, {
                headers: { 'x-auth-token': token },
            });
            message.success(`盟友狀態已切換為 ${newStatus}`);
            fetchUsers();
        } catch (err) {
            console.error('Toggle status error:', err);
            message.error(`狀態切換失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const validateConfirmPassword = (_, value) => {
        const password = form.getFieldValue('password');
        return new Promise((resolve, reject) => {
            if (!value || !editingUser) {
                resolve();
            } else if (password === value) {
                resolve();
            } else {
                message.error('兩次輸入的密碼不一致！');
                reject(new Error('兩次輸入的密碼不一致！'));
            }
        });
    };

    const handleBroadcast = async () => {
        try {
            const values = await broadcastForm.validateFields();
            if (!values.message.trim()) {
                message.error('請輸入通知內容！');
                return;
            }
            setLoading(true);
            const res = await axios.post(
                `${BASE_URL}/api/notifications/broadcast`,
                { message: values.message, auctionId: values.auctionId || null },
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg);
            setIsBroadcastModalVisible(false);
            broadcastForm.resetFields();
        } catch (err) {
            console.error('Broadcast error:', err.response?.data || err);
            message.error(`發送通知失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleGuildChange = (guildId) => {
        if (useGuildPassword) {
            const selectedGuild = guilds.find(g => g._id === guildId);
            if (selectedGuild && selectedGuild.password) {
                form.setFieldsValue({
                    password: selectedGuild.password,
                    confirm_password: selectedGuild.password,
                    mustChangePassword: true,
                });
            } else {
                form.setFieldsValue({
                    password: '',
                    confirm_password: '',
                    mustChangePassword: false,
                });
            }
        }
    };

    const handleUseGuildPasswordChange = (checked) => {
        setUseGuildPassword(checked);
        if (checked) {
            const guildId = form.getFieldValue('guildId');
            handleGuildChange(guildId);
        } else {
            form.setFieldsValue({
                password: '',
                confirm_password: '',
                mustChangePassword: false,
            });
        }
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
        getCheckboxProps: (record) => ({
            disabled: record.role === 'admin' || record.role === 'guild',
        }),
    };

    const columns = [
        { title: '世界名稱', dataIndex: 'world_name', key: 'world_name', width: 150 },
        { title: '角色名稱', dataIndex: 'character_name', key: 'character_name', width: 150 },
        { title: 'Discord ID', dataIndex: 'discord_id', key: 'discord_id', width: 150 },
        { title: '戰鬥等級', dataIndex: 'raid_level', key: 'raid_level', width: 120 },
        { title: '鑽石數', dataIndex: 'diamonds', key: 'diamonds', render: (text) => formatNumber(text), width: 120 },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status, record) => (
                <Button
                    type="link"
                    onClick={() => handleToggleStatus(record)}
                    disabled={loading}
                >
                    <Tag color={status === 'active' ? 'green' : 'gold'}>{status}</Tag>
                </Button>
            ),
        },
        {
            title: '截圖',
            dataIndex: 'screenshot',
            key: 'screenshot',
            render: (text) => text ? <a href={text} target="_blank" rel="noopener noreferrer">查看</a> : '無',
            width: 100,
        },
        { title: '角色', dataIndex: 'role', key: 'role', width: 120 },
        {
            title: '旅團',
            dataIndex: 'guildId',
            key: 'guildId',
            width: 150,
            render: (guildId) => guilds.find(g => g._id === guildId)?.name || '無',
        },
        {
            title: '是否需更改密碼',
            dataIndex: 'mustChangePassword',
            key: 'mustChangePassword',
            width: 120,
            render: (mustChangePassword) => (mustChangePassword ? '是' : '否'),
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_, record) => (
                <Space size={8}>
                    <Button
                        type="primary"
                        shape="round"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => showModal(record)}
                        disabled={loading}
                        style={{ background: '#1890ff', color: '#fff', borderColor: '#1890ff' }}
                        onMouseEnter={(e) => (e.target.style.background = '#40a9ff')}
                        onMouseLeave={(e) => (e.target.style.background = '#1890ff')}
                    >
                        編輯
                    </Button>
                    <Button
                        type="default"
                        shape="round"
                        size="small"
                        icon={<InfoCircleOutlined />}
                        onClick={() => showDetailModal(record)}
                        disabled={loading}
                        style={{ borderColor: '#d9d9d9', color: '#1890ff' }}
                        onMouseEnter={(e) => (e.target.style.background = '#e6f7ff')}
                        onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                    >
                        詳情
                    </Button>
                    <Popconfirm
                        title="確認刪除此盟友？"
                        onConfirm={() => handleDelete(record._id)}
                        okText="是"
                        cancelText="否"
                        disabled={loading || record.role === 'admin' || record.role === 'guild'}
                    >
                        <Button
                            type="danger"
                            shape="round"
                            size="small"
                            icon={<DeleteOutlined />}
                            disabled={loading || record.role === 'admin' || record.role === 'guild'}
                            style={{ background: '#ff4d4f', color: '#fff', borderColor: '#ff4d4f' }}
                            onMouseEnter={(e) => (e.target.style.background = '#ff7875')}
                            onMouseLeave={(e) => (e.target.style.background = '#ff4d4f')}
                        >
                            刪除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={
                    <Row justify="space-between" align="middle">
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>管理盟友</h2>
                        {deferredPrompt && (
                            <Button type="link" onClick={handleInstallPWA}>
                                安裝應用
                            </Button>
                        )}
                    </Row>
                }
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px', marginBottom: '16px' }}
            >
                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                    <Col xs={24} sm={12} md={8}>
                        <Card title="總盟友數" bordered={false}>
                            <h3>{stats.totalUsers}</h3>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Card title="活躍盟友數" bordered={false}>
                            <h3>{stats.activeUsers}</h3>
                        </Card>
                    </Col>
                </Row>
                <Card title="盟友增長趨勢（過去 30 天）" bordered={false} style={{ marginBottom: '16px' }}>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={growthData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="_id" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="count" stroke="#1890ff" name="新增盟友數" />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            </Card>
            <Card
                title="盟友列表"
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Input.Search
                        placeholder="搜索角色名稱或世界名稱"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        onSearch={fetchUsers}
                        style={{ width: 200 }}
                        enterButton={<SearchOutlined />}
                    />
                    <Select
                        value={filters.status}
                        onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                        style={{ width: 200 }}
                        onSelect={fetchUsers}
                    >
                        <Option value="all">全部狀態</Option>
                        <Option value="pending">待審核</Option>
                        <Option value="active">活躍</Option>
                    </Select>
                    <Button type="primary" onClick={() => showModal()} style={{ marginRight: 16 }} disabled={loading || !token}>
                        添加盟友
                    </Button>
                    <Button type="primary" onClick={() => setIsBroadcastModalVisible(true)} disabled={loading || !token}>
                        發送廣播通知
                    </Button>
                    <Popconfirm
                        title="確認批量刪除選中盟友？"
                        onConfirm={handleBatchDelete}
                        okText="是"
                        cancelText="否"
                        disabled={loading || selectedRowKeys.length === 0 || !token}
                    >
                        <Button type="danger" icon={<DeleteOutlined />} disabled={loading || selectedRowKeys.length === 0 || !token}>
                            批量刪除
                        </Button>
                    </Popconfirm>
                    <Button
                        type="default"
                        icon={<SyncOutlined />}
                        onClick={() => {
                            fetchUsers();
                            fetchStats();
                            fetchGrowthData();
                        }}
                        disabled={loading || !online}
                        style={{ marginLeft: 'auto' }}
                    >
                        刷新
                    </Button>
                </div>
                <Spin spinning={loading} size="large">
                    {filteredUsers.length === 0 && !loading ? (
                        <Alert
                            message="無盟友數據"
                            description="目前沒有符合條件的盟友記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <>
                            <Table
                                rowSelection={rowSelection}
                                dataSource={paginatedUsers}
                                columns={columns}
                                rowKey="_id"
                                bordered
                                pagination={false}
                                scroll={{ x: 'max-content' }}
                            />
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={filteredUsers.length}
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
            <Modal
                title={editingUser ? '編輯盟友' : '添加盟友'}
                visible={isModalVisible}
                onOk={handleOk}
                onCancel={() => setIsModalVisible(false)}
                width={600}
                confirmLoading={loading}
            >
                <Form form={form} layout="vertical" style={{ maxWidth: '100%' }}>
                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="world_name"
                                label="世界名稱"
                                rules={[{ required: true, message: '請輸入世界名稱！' }]}
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name="character_name"
                                label="角色名稱"
                                rules={[{ required: true, message: '請輸入角色名稱！' }]}
                                hasFeedback
                            >
                                <Input disabled={!!editingUser} />
                            </Form.Item>
                            <Form.Item
                                name="discord_id"
                                label="Discord ID"
                                rules={[{ pattern: /^\d{18}$/, message: '請輸入有效的 18 位 Discord ID！' }]}
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name="raid_level"
                                label="戰鬥等級"
                                rules={[
                                    {
                                        validator: (_, value) => {
                                            if (value === undefined || value === null || value === '') {
                                                return Promise.reject(new Error('請輸入戰鬥等級！'));
                                            }
                                            const numValue = parseInt(value, 10);
                                            if (isNaN(numValue) || numValue < 0) {
                                                return Promise.reject(new Error('戰鬥等級必須為非負數！'));
                                            }
                                            return Promise.resolve();
                                        },
                                    },
                                ]}
                            >
                                <Input type="number" min={0} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="diamonds"
                                label="鑽石數💎"
                                rules={[{ type: 'number', min: 0, message: '鑽石數必須為非負數！' }]}
                            >
                                <Input type="number" min={0} disabled={true} />
                            </Form.Item>
                            <Form.Item
                                name="status"
                                label="狀態"
                                rules={[{ required: true, message: '請選擇狀態！' }]}
                            >
                                <Select>
                                    <Option value="pending">待審核</Option>
                                    <Option value="active">活躍</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item
                                name="screenshot"
                                label="截圖"
                                rules={[{ type: 'url', message: '請輸入有效的 URL 地址！' }]}
                            >
                                <Input placeholder="輸入截圖 URL" />
                            </Form.Item>
                            <Form.Item
                                name="role"
                                label="角色"
                                rules={[{ required: true, message: '請選擇角色！' }]}
                            >
                                <Select>
                                    <Option value="user">盟友</Option>
                                    <Option value="moderator">版主</Option>
                                    <Option value="admin">管理員</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item
                                name="guildId"
                                label="旅團"
                                rules={[{ required: true, message: '請選擇旅團！' }]}
                            >
                                <Select
                                    placeholder="選擇旅團"
                                    onChange={handleGuildChange}
                                >
                                    {guilds.map(guild => (
                                        <Option key={guild._id} value={guild._id}>
                                            {guild.name}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            {!editingUser && (
                                <>
                                    <Form.Item
                                        name="useGuildPassword"
                                        label="使用旅團密碼"
                                        valuePropName="checked"
                                    >
                                        <Checkbox onChange={(e) => handleUseGuildPasswordChange(e.target.checked)}>
                                            使用旅團密碼（盟友首次登入需更改）
                                        </Checkbox>
                                    </Form.Item>
                                    <Form.Item
                                        name="password"
                                        label="初始密碼"
                                        rules={[{ required: !useGuildPassword, message: '請輸入初始密碼！' }]}
                                    >
                                        <Input.Password placeholder="輸入初始密碼" disabled={useGuildPassword} />
                                    </Form.Item>
                                    <Form.Item
                                        name="confirm_password"
                                        label="確認密碼"
                                        dependencies={['password']}
                                        rules={[
                                            { required: !useGuildPassword, message: '請確認密碼！' },
                                            { validator: validateConfirmPassword },
                                        ]}
                                        validateTrigger={['onChange', 'onBlur']}
                                    >
                                        <Input.Password placeholder="請再次輸入初始密碼" disabled={useGuildPassword} />
                                    </Form.Item>
                                    <Form.Item
                                        name="mustChangePassword"
                                        label="是否需更改密碼"
                                        valuePropName="checked"
                                        hidden
                                    >
                                        <Checkbox />
                                    </Form.Item>
                                </>
                            )}
                        </Col>
                    </Row>
                </Form>
            </Modal>
            <Modal
                title="盟友詳情"
                visible={isDetailModalVisible}
                onOk={() => setIsDetailModalVisible(false)}
                onCancel={() => setIsDetailModalVisible(false)}
                footer={null}
            >
                {selectedUser && (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="世界名稱">{selectedUser.world_name}</Descriptions.Item>
                        <Descriptions.Item label="角色名稱">{selectedUser.character_name}</Descriptions.Item>
                        <Descriptions.Item label="Discord ID">{selectedUser.discord_id || '無'}</Descriptions.Item>
                        <Descriptions.Item label="戰鬥等級">{selectedUser.raid_level}</Descriptions.Item>
                        <Descriptions.Item label="鑽石數">{formatNumber(selectedUser.diamonds)}💎</Descriptions.Item>
                        <Descriptions.Item label="狀態">{selectedUser.status}</Descriptions.Item>
                        <Descriptions.Item label="截圖">
                            {selectedUser.screenshot ? (
                                <a href={selectedUser.screenshot} target="_blank" rel="noopener noreferrer">查看</a>
                            ) : '無'}
                        </Descriptions.Item>
                        <Descriptions.Item label="角色">{selectedUser.role}</Descriptions.Item>
                        <Descriptions.Item label="旅團">{guilds.find(g => g._id === selectedUser.guildId)?.name || '無'}</Descriptions.Item>
                        <Descriptions.Item label="是否需更改密碼">{selectedUser.mustChangePassword ? '是' : '否'}</Descriptions.Item>
                        <Descriptions.Item label="創建時間">{moment(selectedUser.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                        <Descriptions.Item label="更新時間">{moment(selectedUser.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
            <Modal
                title="發送廣播通知"
                visible={isBroadcastModalVisible}
                onOk={handleBroadcast}
                onCancel={() => setIsBroadcastModalVisible(false)}
                okText="發送"
                cancelText="取消"
                confirmLoading={loading}
            >
                <Form form={broadcastForm} layout="vertical">
                    <Form.Item
                        name="message"
                        label="通知內容"
                        rules={[{ required: true, message: '請輸入通知內容！' }, { max: 500, message: '通知內容不得超過 500 字！' }]}
                    >
                        <Input.TextArea rows={4} placeholder="輸入通知內容" />
                    </Form.Item>
                    <Form.Item name="auctionId" label="拍賣 ID (可選)">
                        <Input placeholder="輸入拍賣 ID (留空則不關聯)" />
                    </Form.Item>
                    <p>注意：通知將發送給所有盟友。</p>
                </Form>
            </Modal>
            {!online && (
                <Alert
                    message="離線模式"
                    description="目前處於離線模式，數據可能不是最新。請檢查網絡後刷新。"
                    type="warning"
                    showIcon
                    style={{ marginTop: '16px' }}
                />
            )}
        </div>
    );
};

export default ManageUsers;