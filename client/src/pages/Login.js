import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // 引入 useNavigate

const BASE_URL = 'http://localhost:5000';

const Login = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate(); // 使用 useNavigate 鉤子

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            // 去除密碼首尾空格
            const trimmedValues = {
                character_name: values.character_name.trim(),
                password: values.password.trim(),
            };
            console.log('Submitting login data:', trimmedValues);
            const res = await axios.post(`${BASE_URL}/api/auth/login`, trimmedValues);
            message.success(res.data.msg);
            localStorage.setItem('token', res.data.token);
            console.log('Login successful, navigating to /dashboard'); // 調試日誌
            navigate('/'); // 使用 navigate 進行跳轉
        } catch (err) {
            console.error('Login error:', err.response?.data);
            message.error(err.response?.data?.msg || '登入失敗');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
            <h2>登入</h2>
            <Form form={form} onFinish={handleSubmit} layout="vertical">
                <Form.Item
                    name="character_name"
                    label="角色名稱"
                    rules={[{ required: true, message: '請輸入角色名稱！' }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    name="password"
                    label="密碼"
                    rules={[{ required: true, message: '請輸入密碼！' }]}
                >
                    <Input.Password />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block>
                        登入
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default Login;