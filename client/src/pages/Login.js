import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Spin, Typography } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger';

const { Text } = Typography;

const BASE_URL = 'http://localhost:5000';

const Login = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [clientIp, setClientIp] = useState('正在獲取...'); // 用於存儲客戶端 IP
    const navigate = useNavigate();

    // 獲取客戶端 IP 地址
    useEffect(() => {
        const fetchClientIp = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/auth/client-ip`);
                setClientIp(res.data.ip);
            } catch (err) {
                logger.error('Fetch client IP error:', {
                    message: err.message,
                    response: err.response?.data,
                });
                setClientIp('無法獲取 IP');
            }
        };

        fetchClientIp();
    }, []);

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            const trimmedValues = {
                character_name: values.character_name.trim(),
                password: values.password,
            };

            const res = await axios.post(`${BASE_URL}/api/auth/login`, trimmedValues);
            message.success(res.data.msg);
            localStorage.setItem('token', res.data.token);

            // 根據角色導航到不同頁面（假設後端返回 user 對象包含 role）
            const userRole = res.data.user?.role || 'user';
            if (userRole === 'admin') {
                navigate('/admin');
            } else {
                navigate('/');
            }
        } catch (err) {
            const errorMsg = err.response?.data?.msg || '登入失敗，請稍後重試';
            logger.error('Login error:', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
            });
            message.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <Spin spinning={loading} tip="正在登入...">
                <Card
                    
                >
                    <Form
                        form={form}
                        onFinish={handleSubmit}
                        layout="vertical"
                        initialValues={{
                            character_name: '',
                            password: '',
                        }}
                    >
                        <Form.Item
                            name="character_name"
                            label="角色名稱"
                            rules={[
                                { required: true, message: '請輸入角色名稱！' },
                                {
                                    pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
                                    message: '角色名稱只能包含字母、數字、下劃線和中文！'
                                },
                            ]}
                        >
                            <Input placeholder="請輸入角色名稱" />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            label="密碼"
                            rules={[
                                { required: true, message: '請輸入密碼！' },
                                { min: 3, message: '密碼長度至少為 3 個字符！' },
                            ]}
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
                        {/* 顯示客戶端 IP */}
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: '10px' }}>
                            您目前的 IP 為 {clientIp}
                        </Text>
                    </Form>
                </Card>
            </Spin>

            <style jsx global>{`
                .login-container {
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    padding: 1px;
                    margin-top: 50px;
                }
                .login-card {
                    width: 100%;
                    max-width: 400px;
                    border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    animation: fadeIn 0.5s ease-in-out;
                }
                .ant-form-item {
                    margin-bottom: 16px;
                }
                .ant-form-item-label > label {
                    color: #595959;
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
                    transform: scale(1.05);
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
                        margin-top: 20px;
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