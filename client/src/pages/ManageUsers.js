import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Select, Row, Col } from 'antd';
import axios from 'axios';

const { Option } = Select;

const ManageUsers = () => {
    const [users, setUsers] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form] = Form.useForm();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            message.error('請先登入以管理用戶！');
            console.warn('No token found in localStorage');
            return;
        }
        console.log('Fetching users with token:', token);
        fetchUsers();
    }, [token]);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/users', {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched users response:', res);
            if (Array.isArray(res.data)) {
                setUsers(res.data);
                console.log('Fetched users data:', res.data);
            } else {
                console.warn('API response is not an array:', res.data);
                setUsers([]);
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
                message.error(`載入用戶列表失敗: ${err.response?.data?.msg || err.message}`);
            }
            setUsers([]);
        }
    };

    const showModal = (user = null) => {
        if (!token) {
            message.error('請先登入以管理用戶！');
            return;
        }
        setEditingUser(user);
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
            password: '',
            confirm_password: '',
        });
        setIsModalVisible(true);
    };

    const handleOk = async () => {
        try {
            if (!token) {
                message.error('請先登入以管理用戶！');
                return;
            }
            const values = await form.validateFields();
            console.log('Form values before validation:', values);
            if (values.password && values.confirm_password && values.password !== values.confirm_password) {
                message.error('兩次輸入的密碼不一致！');
                return;
            }
            const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users';
            const method = editingUser ? 'put' : 'post';
            const formData = new FormData();
            Object.keys(values).forEach(key => {
                if (values[key] !== undefined) formData.append(key, values[key]);
            });
            if (editingUser && values.screenshot instanceof File) {
                formData.append('screenshot', values.screenshot);
            } else if (!editingUser && values.screenshot) {
                formData.append('screenshot', values.screenshot);
            }
            console.log('Sending formData:', Object.fromEntries(formData));

            const res = await axios[method](`http://localhost:5000${url}`, formData, {
                headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
            });
            console.log('API response for save:', res);
            message.success(`用戶${editingUser ? '更新' : '創建'}成功`);
            setIsModalVisible(false);
            fetchUsers();
        } catch (err) {
            console.error(`Handle ${editingUser ? 'update' : 'create'} error:`, {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
                code: err.code,
            });
            if (err.response) {
                message.error(`用戶${editingUser ? '更新' : '創建'}失敗: ${err.response.data?.msg || err.message}`);
            } else if (err.request) {
                message.error(`網絡請求失敗: 請檢查服務器連線`);
            } else {
                message.error(`請求配置錯誤: ${err.message}`);
            }
        }
    };

    const handleDelete = async (id) => {
        try {
            if (!token) {
                message.error('請先登入以管理用戶！');
                return;
            }
            const res = await axios.delete(`http://localhost:5000/api/users/${id}`, {
                headers: { 'x-auth-token': token },
            });
            console.log('API response for delete:', res);
            message.success('用戶刪除成功');
            fetchUsers();
        } catch (err) {
            console.error('Delete user error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
                code: err.code,
            });
            message.error('用戶刪除失敗: ' + err.response?.data?.msg || err.message || '網絡錯誤');
        }
    };

    const validateConfirmPassword = (_, value) => {
        const password = form.getFieldValue('password');
        console.log('Validating confirm_password:', value, 'against password:', password); // 調試
        return new Promise((resolve, reject) => {
            if (!value || !editingUser) { // 編輯時允許留空
                resolve();
            } else if (password === value) {
                resolve();
            } else {
                message.error('兩次輸入的密碼不一致！'); // 顯示錯誤
                reject(new Error('兩次輸入的密碼不一致！'));
            }
        });
    };

    const columns = [
        { title: '世界名稱', dataIndex: 'world_name', key: 'world_name' },
        { title: '角色名稱', dataIndex: 'character_name', key: 'character_name' },
        { title: 'Discord ID', dataIndex: 'discord_id', key: 'discord_id' },
        { title: '戰鬥等級', dataIndex: 'raid_level', key: 'raid_level' },
        { title: '鑽石數', dataIndex: 'diamonds', key: 'diamonds' },
        { title: '狀態', dataIndex: 'status', key: 'status' },
        { title: '截圖', dataIndex: 'screenshot', key: 'screenshot', render: (text) => text ? <a href={text} target="_blank" rel="noopener noreferrer">查看</a> : '無' },
        { title: '角色', dataIndex: 'role', key: 'role' },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <>
                    <Button type="link" onClick={() => showModal(record)}>
                        編輯
                    </Button>
                    <Button type="link" danger onClick={() => handleDelete(record._id)}>
                        刪除
                    </Button>
                </>
            ),
        },
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '50px auto' }}>
            <h2>管理用戶</h2>
            <Button type="primary" onClick={() => showModal()} style={{ marginBottom: 16 }} disabled={!token}>
                添加用戶
            </Button>
            {users.length === 0 ? (
                <p style={{ color: '#888' }}>暫無用戶數據，請添加用戶或檢查權限。</p>
            ) : (
                <Table dataSource={users} columns={columns} rowKey="_id" bordered />
            )}
            <Modal
                title={editingUser ? '編輯用戶' : '添加用戶'}
                visible={isModalVisible}
                onOk={handleOk}
                onCancel={() => setIsModalVisible(false)}
                width={600}
            >
                <Form form={form} layout="vertical" style={{ maxWidth: '100%' }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="world_name"
                                label="世界名稱"
                                rules={[{ required: true, message: '請輸入世界名稱！' }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name="character_name"
                                label="角色名稱"
                                rules={[{ required: true, message: '請輸入角色名稱！' }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Input disabled={!!editingUser} />
                            </Form.Item>
                            <Form.Item
                                name="discord_id"
                                label="Discord ID"
                                style={{ marginBottom: 16 }}
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name="raid_level"
                                label="戰鬥等級"
                                style={{ marginBottom: 16 }}
                            >
                                <Input type="number" min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="diamonds"
                                label="鑽石數"
                                style={{ marginBottom: 16 }}
                            >
                                <Input type="number" min={0} />
                            </Form.Item>
                            <Form.Item
                                name="status"
                                label="狀態"
                                rules={[{ required: true, message: '請選擇狀態！' }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Select>
                                    <Option value="pending">待審核</Option>
                                    <Option value="active">活躍</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item
                                name="screenshot"
                                label="截圖"
                                style={{ marginBottom: 16 }}
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name="role"
                                label="角色"
                                rules={[{ required: true, message: '請選擇角色！' }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Select>
                                    <Option value="user">用戶</Option>
                                    <Option value="moderator">版主</Option> {/* 新增 moderator */}
                                    <Option value="admin">管理員</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item
                                name="password"
                                label="密碼"
                                rules={[{ required: !editingUser, message: '請輸入密碼！' }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Input
                                    type="password"
                                    placeholder={editingUser ? '留空以保留原密碼' : '請輸入密碼'}
                                    onChange={(e) => {
                                        form.setFieldsValue({ confirm_password: '' }); // 重置確認密碼
                                        console.log('Password changed to:', e.target.value); // 調試
                                    }}
                                />
                            </Form.Item>
                            <Form.Item
                                name="confirm_password"
                                label="確認密碼"
                                dependencies={['password']}
                                rules={[
                                    { required: !editingUser, message: '請確認密碼！' },
                                    { validator: validateConfirmPassword },
                                ]}
                                validateTrigger={['onChange', 'onBlur']} // 確保觸發
                                style={{ marginBottom: 16 }}
                            >
                                <Input
                                    type="password"
                                    placeholder={editingUser ? '留空' : '請再次輸入密碼'}
                                    onChange={() => console.log('Confirm password changed')} // 調試
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageUsers;