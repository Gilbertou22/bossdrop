import React, { useState } from 'react';
import { Form, Input, InputNumber, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // 添加導航功能

const Register = () => {
    const [fileList, setFileList] = useState([]);
    const [form] = Form.useForm();
    const navigate = useNavigate(); // 初始化 navigate

    const onFinish = async (values) => {
        const formData = new FormData();
        formData.append('world_name', values.world_name);
        formData.append('character_name', values.character_name);
        formData.append('discord_id', values.discord_id || '');
        formData.append('raid_level', values.raid_level || 0);
        formData.append('password', values.password);
        if (fileList.length > 0) formData.append('screenshot', fileList[0].originFileObj);

        try {
            const res = await axios.post('http://localhost:5000/api/users/register', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            message.success('註冊成功，等待審核！ID: ' + res.data.user_id);
            // 延遲 1 秒後重定向到登入頁面
            setTimeout(() => {
                navigate('/login');
            }, 1000);
            form.resetFields();
            setFileList([]);
        } catch (err) {
            const errorMsg = err.response?.data?.msg || err.message || '註冊失敗，請稍後再試';
            message.error(errorMsg);
        }
    };

    const uploadProps = {
        onChange: ({ fileList }) => setFileList(fileList.slice(-1)),
        beforeUpload: () => false,
        fileList,
    };

    return (
        <div style={{ maxWidth: 400, margin: '50px auto' }}>
            <h2>用戶註冊</h2>
            <Form form={form} name="register" onFinish={onFinish}>
                <Form.Item name="world_name" rules={[{ required: true, message: '請輸入世界名稱！' }]}>
                    <Input placeholder="世界名稱" autoComplete="off" />
                </Form.Item>
                <Form.Item name="character_name" rules={[{ required: true, message: '請輸入角色名稱！' }]}>
                    <Input placeholder="角色名稱" autoComplete="off" />
                </Form.Item>
                <Form.Item name="discord_id">
                    <Input placeholder="Discord ID" autoComplete="off" />
                </Form.Item>
                <Form.Item name="raid_level">
                    <InputNumber min={0} placeholder="討伐等級" style={{ width: '100%' }} autoComplete="off" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, message: '請輸入密碼！' }]}>
                    <Input.Password placeholder="密碼" autoComplete="off" />
                </Form.Item>
                <Form.Item name="screenshot">
                    <Upload {...uploadProps}>
                        <Button icon={<UploadOutlined />}>上傳截圖</Button>
                    </Upload>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block>
                        提交
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default Register;