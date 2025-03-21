import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import axios from 'axios';
import logger from '../utils/logger'; // 引入前端日誌工具
import { useNavigate } from 'react-router-dom';

const BASE_URL = 'http://localhost:5000';

const ChangePassword = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            const res = await axios.post(
                `${BASE_URL}/api/users/change-password`,
                {
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword,
                },
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg || '密碼更改成功！');
            setTimeout(() => {
                navigate('/manage-users'); // 更改後跳轉到管理頁面
            }, 1000);
        } catch (err) {
            console.error('Change password error:', err);
            message.error('更改密碼失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: '50px auto' }}>
            <h2>更改密碼</h2>
            <Form form={form} name="change-password" onFinish={handleSubmit}>
                <Form.Item
                    name="currentPassword"
                    label="當前密碼"
                    rules={[{ required: true, message: '請輸入當前密碼！' }]}
                >
                    <Input.Password placeholder="輸入當前密碼" />
                </Form.Item>
                <Form.Item
                    name="newPassword"
                    label="新密碼"
                    rules={[{ required: true, message: '請輸入新密碼！' }]}
                >
                    <Input.Password placeholder="輸入新密碼" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                        提交
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default ChangePassword;