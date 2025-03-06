import React from 'react';
import { Form, Input, Button, message } from 'antd';
import axios from 'axios';

const Login = () => {
    const onFinish = async values => {
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', values);
            localStorage.setItem('token', res.data.token);
            message.success('登錄成功！');
            window.location.href = '/'; // 登錄後跳轉
        } catch (err) {
            const errorMsg = err.response?.data?.msg || err.message || '登錄失敗，請稍後再試';
            message.error(errorMsg);
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: '50px auto' }}>
            <h2>登錄</h2>
            <Form name="login" onFinish={onFinish}>
                <Form.Item
                    name="character_name"
                    rules={[{ required: true, message: '請輸入角色名稱！' }]}
                >
                    <Input placeholder="角色名稱" />
                </Form.Item>
                <Form.Item
                    name="password"
                    rules={[{ required: true, message: '請輸入密碼！' }]}
                >
                    <Input.Password placeholder="密碼" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block>
                        登錄
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default Login;