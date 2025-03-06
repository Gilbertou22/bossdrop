import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message } from 'antd';
import axios from 'axios';

const ManageBosses = () => {
    const [bosses, setBosses] = useState([]);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingBoss, setEditingBoss] = useState(null);

    useEffect(() => {
        fetchBosses();
    }, []);

    const fetchBosses = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/bosses');
            setBosses(res.data);
        } catch (err) {
            message.error(err.response?.data?.msg || '載入首領失敗');
        }
    };

    const handleCreateOrUpdate = async values => {
        const token = localStorage.getItem('token');
        try {
            if (editingBoss) {
                await axios.put(`http://localhost:5000/api/bosses/${editingBoss._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('首領更新成功');
            } else {
                await axios.post('http://localhost:5000/api/bosses', values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('首領創建成功');
            }
            fetchBosses();
            setVisible(false);
            form.resetFields();
            setEditingBoss(null);
        } catch (err) {
            message.error(err.response?.data?.msg || '操作失敗');
        }
    };

    const handleDelete = async id => {
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://localhost:5000/api/bosses/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('首領刪除成功');
            fetchBosses();
        } catch (err) {
            message.error(err.response?.data?.msg || '刪除失敗');
        }
    };

    const columns = [
        { title: '名稱', dataIndex: 'name', key: 'name' },
        { title: '描述', dataIndex: 'description', key: 'description' },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <>
                    <Button onClick={() => { setEditingBoss(record); setVisible(true); form.setFieldsValue(record); }}>編輯</Button>
                    <Button danger onClick={() => handleDelete(record._id)} style={{ marginLeft: 8 }}>刪除</Button>
                </>
            ),
        },
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '50px auto' }}>
            <h2>首領管理</h2>
            <Button type="primary" onClick={() => setVisible(true)} style={{ marginBottom: 16 }}>
                新增首領
            </Button>
            <Table dataSource={bosses} columns={columns} rowKey="_id" />
            <Modal
                title={editingBoss ? '編輯首領' : '新增首領'}
                visible={visible}
                onCancel={() => { setVisible(false); setEditingBoss(null); form.resetFields(); }}
                footer={null}
            >
                <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                    <Form.Item name="name" label="名稱" rules={[{ required: true, message: '請輸入首領名稱！' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <Input.TextArea />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">提交</Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageBosses;