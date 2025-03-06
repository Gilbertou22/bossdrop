import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message } from 'antd';
import axios from 'axios';

const { Option } = Select;

const ManageItems = () => {
    const [items, setItems] = useState([]);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingItem, setEditingItem] = useState(null);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/items');
            setItems(res.data);
        } catch (err) {
            message.error(err.response?.data?.msg || '載入物品失敗');
        }
    };

    const handleCreateOrUpdate = async values => {
        const token = localStorage.getItem('token');
        try {
            if (editingItem) {
                await axios.put(`http://localhost:5000/api/items/${editingItem._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('物品更新成功');
            } else {
                await axios.post('http://localhost:5000/api/items', values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('物品創建成功');
            }
            fetchItems();
            setVisible(false);
            form.resetFields();
            setEditingItem(null);
        } catch (err) {
            message.error(err.response?.data?.msg || '操作失敗');
        }
    };

    const handleDelete = async id => {
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://localhost:5000/api/items/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('物品刪除成功');
            fetchItems();
        } catch (err) {
            message.error(err.response?.data?.msg || '刪除失敗');
        }
    };

    const columns = [
        { title: '名稱', dataIndex: 'name', key: 'name' },
        { title: '類型', dataIndex: 'type', key: 'type' },
        { title: '描述', dataIndex: 'description', key: 'description' },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <>
                    <Button onClick={() => { setEditingItem(record); setVisible(true); form.setFieldsValue(record); }}>編輯</Button>
                    <Button danger onClick={() => handleDelete(record._id)} style={{ marginLeft: 8 }}>刪除</Button>
                </>
            ),
        },
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '50px auto' }}>
            <h2>物品管理</h2>
            <Button type="primary" onClick={() => setVisible(true)} style={{ marginBottom: 16 }}>
                新增物品
            </Button>
            <Table dataSource={items} columns={columns} rowKey="_id" />
            <Modal
                title={editingItem ? '編輯物品' : '新增物品'}
                visible={visible}
                onCancel={() => { setVisible(false); setEditingItem(null); form.resetFields(); }}
                footer={null}
            >
                <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                    <Form.Item name="name" label="名稱" rules={[{ required: true, message: '請輸入物品名稱！' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="type" label="類型" rules={[{ required: true, message: '請選擇物品類型！' }]}>
                        <Select>
                            <Option value="equipment">裝備</Option>
                            <Option value="skill">技能</Option>
                        </Select>
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

export default ManageItems;