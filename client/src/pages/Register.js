import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Upload, Button, message, Modal } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger'; // 引入前端日誌工具

const Register = () => {
    const [fileList, setFileList] = useState([]);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [registerResponse, setRegisterResponse] = useState(null);
    const BASE_URL = 'http://localhost:5000';

    // 調試信息
    useEffect(() => {
        console.log('Register page mounted');
        return () => console.log('Register page unmounted');
    }, []);

    const onFinish = async (values) => {
        const formData = new FormData();
        formData.append('world_name', values.world_name);
        formData.append('character_name', values.character_name);
        formData.append('discord_id', values.discord_id || '');
        formData.append('raid_level', values.raid_level || 0);
        formData.append('password', values.password);
        if (fileList.length > 0) {
            formData.append('screenshot', fileList[0].originFileObj);
        }

        try {
            console.log('Submitting registration with data:', values); // 調試信息
            const res = await axios.post(`${BASE_URL}/api/users/register`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            console.log('Registration response:', res.data); // 調試信息
            setRegisterResponse(res.data);
            setIsModalVisible(true); // 顯示模態窗口
            console.log('Modal set to visible'); // 調試信息
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
                console.log('Updated token in localStorage:', res.data.token);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.msg || err.message || '註冊失敗，請稍後再試';
            message.error(errorMsg);
            console.error('Register error:', err.response?.data || err);
        }
    };

    const handleModalOk = () => {
        setIsModalVisible(false);
        console.log('Modal closed, navigating to /login'); // 調試信息
        window.location.href = '/login'; // 硬刷新導航
        form.resetFields();
        setFileList([]);
        console.log('Navigation executed'); // 調試信息
    };

    const uploadProps = {
        onChange: ({ fileList: newFileList }) => setFileList(newFileList.slice(-1)),
        beforeUpload: () => false,
        fileList,
        maxCount: 1,
    };

    return (
        <div style={{ maxWidth: 400, margin: '50px auto' }}>
            <h2>用戶註冊</h2>
            <Form form={form} name="register" onFinish={onFinish} layout="vertical">
                <Form.Item
                    name="world_name"
                    label="世界名稱"
                    rules={[{ required: true, message: '請輸入世界名稱！' }]}
                >
                    <Input placeholder="世界名稱" autoComplete="off" />
                </Form.Item>
                <Form.Item
                    name="character_name"
                    label="角色名稱"
                    rules={[{ required: true, message: '請輸入角色名稱！' }]}
                >
                    <Input placeholder="角色名稱" autoComplete="off" />
                </Form.Item>
                <Form.Item name="discord_id" label="Discord ID">
                    <Input placeholder="Discord ID" autoComplete="off" />
                </Form.Item>
                <Form.Item name="raid_level" label="討伐等級">
                    <InputNumber min={0} placeholder="討伐等級" style={{ width: '100%' }} autoComplete="off" />
                </Form.Item>
                <Form.Item
                    name="password"
                    label="密碼"
                    rules={[{ required: true, message: '請輸入密碼！' }]}
                >
                    <Input.Password placeholder="密碼" autoComplete="off" />
                </Form.Item>
                <Form.Item name="screenshot" label="截圖">
                    <Upload {...uploadProps}>
                        <Button icon={<UploadOutlined />}>上傳截圖（僅限1張）</Button>
                    </Upload>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block>
                        提交
                    </Button>
                </Form.Item>
            </Form>

            <Modal
                title="註冊成功"
                visible={isModalVisible}
                onOk={handleModalOk}
                onCancel={handleModalOk}
                footer={[
                    <Button key="ok" type="primary" onClick={handleModalOk}>
                        確認
                    </Button>,
                ]}
                afterClose={() => console.log('Modal closed')} // 調試信息
            >
                <p>註冊成功，等待審核！ID: {registerResponse?.user_id}</p>
            </Modal>
        </div>
    );
};

export default Register;