import React, { useState, useEffect } from 'react';
import { Table, Button, message, Modal, Form, Select, Tag } from 'antd';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;

const ApproveApplications = () => {
    const [applications, setApplications] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/applications', {
                headers: { 'x-auth-token': token },
            });
            setApplications(res.data);
        } catch (err) {
            message.error('載入申請列表失敗');
        }
    };

    const showModal = (application) => {
        setSelectedApplication(application);
        form.setFieldsValue({ status: application.status });
        setIsModalVisible(true);
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            const token = localStorage.getItem('token');
            const { status } = values;
            const final_recipient = selectedApplication.user_id.character_name; // 自動填充為申請人

            // 更新 Application 狀態
            await axios.put(
                `http://localhost:5000/api/applications/${selectedApplication._id}`,
                { status },
                { headers: { 'x-auth-token': token } }
            );

            // 同時更新 BossKill 記錄
            await axios.put(
                `http://localhost:5000/api/boss-kills/${selectedApplication.kill_id._id}`,
                {
                    final_recipient,
                    status: status === 'assigned' ? 'assigned' : 'pending', // 同步狀態
                },
                { headers: { 'x-auth-token': token } }
            );

            message.success('申請狀態和擊殺記錄更新成功');
            setIsModalVisible(false);
            fetchApplications();
        } catch (err) {
            message.error('更新失敗: ' + err.message);
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const getStatusDisplay = (status) => {
        switch (status) {
            case 'pending':
                return <Tag color="blue">待分配</Tag>;
            case 'assigned':
                return <Tag color="green">已分配</Tag>;
            case 'approved':
            case 'rejected':
                return <Tag color="gray">{status}</Tag>; // 保留兼容性，但不常用
            default:
                return status;
        }
    };

    const columns = [
        {
            title: '申請人',
            dataIndex: 'user_id',
            key: 'user_id',
            render: (user) => user.character_name,
        },
        {
            title: '擊殺記錄',
            dataIndex: 'kill_id',
            key: 'kill_id',
            render: (kill) => `${kill.boss_name} - ${moment(kill.kill_time).format('YYYY-MM-DD HH:mm')}`,
        },
        {
            title: '物品名稱',
            dataIndex: 'item_name',
            key: 'item_name',
        },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            render: (status) => getStatusDisplay(status),
        },
        {
            title: '最終獲得者',
            dataIndex: 'kill_id',
            key: 'final_recipient',
            render: (kill) => kill.final_recipient || '未分配',
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                record.status === 'pending' ? (
                    <Button type="link" onClick={() => showModal(record)}>
                        分配/更新
                    </Button>
                ) : null
            ),
        },
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '50px auto' }}>
            <h2>批准申請物品</h2>
            <Table
                dataSource={applications}
                columns={columns}
                rowKey="_id"
                bordered
                pagination={{ pageSize: 10 }}
            />
            <Modal
                title="更新申請狀態"
                visible={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
                okButtonProps={{ disabled: !selectedApplication || selectedApplication.status !== 'pending' }}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="status"
                        label="狀態"
                        rules={[{ required: true, message: '請選擇狀態！' }]}
                    >
                        <Select placeholder="選擇狀態" disabled={selectedApplication?.status !== 'pending'}>
                            <Option value="pending">待分配</Option>
                            <Option value="assigned">已分配</Option>
                        </Select>
                    </Form.Item>
                    {/* 自動填充 final_recipient，無需選擇 */}
                </Form>
            </Modal>
        </div>
    );
};

export default ApproveApplications;