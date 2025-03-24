import React, { useState } from 'react';
import { Form, Input, Button, message, Card } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger';

const BASE_URL = 'http://localhost:5000';

const Login = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            const trimmedValues = {
                character_name: values.character_name.trim(),
                password: values.password.trim(),
            };

            const res = await axios.post(`${BASE_URL}/api/auth/login`, trimmedValues);
            message.success(res.data.msg);
            localStorage.setItem('token', res.data.token);
            navigate('/');
        } catch (err) {
            logger.error('Login error:', err.response?.data);
            message.error(err.response?.data?.msg || '登入失敗');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <Card
                title={<h2 style={{ textAlign: 'center', color: '#1890ff' }}>登入</h2>}
                className="login-card"
            >
                <Form form={form} onFinish={handleSubmit} layout="vertical">
                    <Form.Item
                        name="character_name"
                        label="角色名稱"
                        rules={[{ required: true, message: '請輸入角色名稱！' }]}
                    >
                        <Input placeholder="請輸入角色名稱" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label="密碼"
                        rules={[{ required: true, message: '請輸入密碼！' }]}
                    >
                        <Input.Password placeholder="請輸入密碼" />
                    </Form.Item>
                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            className="login-button"
                        >
                            登入
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <style jsx global>{`
                .login-container {
                    display: flex;
                    justify-content: center;
                    align-items: flex-start; /* 改為 flex-start，使登入框靠上 */                                        
                    padding: 1px;
                    margin-top: 50px; /* 上移登入框 */
                }
                .login-card {
                    width: 100%;
                    max-width: 400px;
                    border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    animation: fadeIn 0.5s ease-in-out; /* 淡入動畫 */
                }
                .ant-form-item {
                    margin-bottom: 16px; /* 減少表單項間距 */
                }
                .ant-form-item-label > label {
                    color: #595959; /* 標籤顏色 */
                    font-weight: 500;
                }
                .ant-input, .ant-input-password {
                    border-radius: 6px;
                    transition: all 0.3s;
                }
                .ant-input:focus, .ant-input-password:focus {
                    border-color: #40c4ff;
                    box-shadow: 0 0 0 2px rgba(64, 196, 255, 0.2);
                }
                .login-button {
                    border-radius: 6px;
                    height: 40px;
                    font-size: 16px;
                    transition: all 0.3s;
                }
                .login-button:hover {
                    transform: scale(1.05); /* 懸停時放大 */
                    background-color: #40c4ff;
                    border-color: #40c4ff;
                }
                @keyframes fadeIn {
                    0% {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @media (max-width: 576px) {
                    .login-container {
                        margin-top: 20px; /* 小屏幕上減少上邊距 */
                    }
                    .login-card {
                        max-width: 100%;
                        margin: 0 10px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Login;