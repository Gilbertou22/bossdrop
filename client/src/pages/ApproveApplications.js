import React, { useState, useEffect } from 'react';
import { Table, Button, message, Popconfirm, Card, Spin, Row, Col, Alert, Tag } from 'antd';
import axios from 'axios';
import moment from 'moment';

const BASE_URL = 'http://localhost:5000';

const ApproveApplications = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            message.error('請先登入！');
            return;
        }
        fetchApplications();
    }, [token]);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/applications`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched applications:', res.data);
            // 過濾僅顯示 pending 狀態的申請
            const pendingApplications = res.data.filter(app => app.status === 'pending');
            setApplications(pendingApplications);
        } catch (err) {
            console.error('Fetch applications error:', err.response?.data || err);
            message.error('載入申請列表失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id, status, finalRecipient = null) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let updateMsg = '';
            let bossKillUpdate = {};

            // 更新 Application 狀態
            if (status === 'approved') {
                await axios.put(
                    `${BASE_URL}/api/applications/${id}/approve`,
                    {},
                    { headers: { 'x-auth-token': token } }
                );
                updateMsg = '已審批';
                bossKillUpdate = {
                    final_recipient: finalRecipient,
                    status: 'assigned',
                };
            } else if (status === 'rejected') {
                await axios.put(
                    `${BASE_URL}/api/applications/${id}/reject`,
                    {},
                    { headers: { 'x-auth-token': token } }
                );
                updateMsg = '已拒絕';
            }

            // 同步更新 BossKill（僅在批准時）
            if (status === 'approved') {
                const application = applications.find(app => app._id === id);
                const bossKillId = application?.kill_id?._id;
                if (bossKillId) {
                    await axios.put(
                        `${BASE_URL}/api/boss-kills/${bossKillId}`,
                        bossKillUpdate,
                        { headers: { 'x-auth-token': token } }
                    );
                }
            }

            message.success(`申請 ${updateMsg}成功`);
            fetchApplications(); // 刷新列表
        } catch (err) {
            console.error('Update status error:', err.response?.data || err);
            message.error(`更新失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getStatusTag = (status) => {
        switch (status) {
            case 'pending':
                return <Tag color="blue">待分配</Tag>;
            case 'approved':
                return <Tag color="green">已審批</Tag>;
            case 'rejected':
                return <Tag color="red">已拒絕</Tag>;
            default:
                return <Tag>{status}</Tag>;
        }
    };

    const columns = [
        {
            title: '申請人',
            dataIndex: 'user_id',
            key: 'user_id',
            render: (user) => user?.character_name || '未知',
            responsive: ['md'], // 手機隱藏
        },
        {
            title: '擊殺記錄',
            dataIndex: 'kill_id',
            key: 'kill_id',
            render: (kill) => `${kill?.boss_name || '未知'} - ${moment(kill?.kill_time).format('YYYY-MM-DD HH:mm') || '無時間'}`,
            responsive: ['md'], // 手機隱藏
        },
        {
            title: '物品名稱',
            dataIndex: 'item_name',
            key: 'item_name',
            responsive: ['sm'], // 手機顯示
        },
        {
            title: '申請時間',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
            responsive: ['md'], // 手機隱藏
        },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            render: getStatusTag,
            responsive: ['sm'], // 手機顯示
        },
        {
            title: '最終獲得者',
            dataIndex: 'kill_id',
            key: 'final_recipient',
            render: (kill) => kill?.final_recipient || '未分配',
            responsive: ['md'], // 手機隱藏
        },
        {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
                record.status === 'pending' ? (
                    <Row gutter={[8, 8]} justify="center">
                        <Col xs={12} sm={10} md={10}>
                            <Popconfirm
                                title="確認批准此申請？"
                                onConfirm={() => handleUpdateStatus(record._id, 'approved', record.user_id.character_name)}
                                okText="是"
                                cancelText="否"
                            >
                                <Button
                                    type="primary"
                                    size="large"
                                    block
                                    style={{ marginBottom: 8 }}
                                >
                                    批准
                                </Button>
                            </Popconfirm>
                        </Col>
                        <Col xs={12} sm={10} md={10}>
                            <Popconfirm
                                title="確認拒絕此申請？"
                                onConfirm={() => handleUpdateStatus(record._id, 'rejected')}
                                okText="是"
                                cancelText="否"
                            >
                                <Button
                                    type="danger"
                                    size="large"
                                    block
                                >
                                    拒絕
                                </Button>
                            </Popconfirm>
                        </Col>
                    </Row>
                ) : null
            ),
            responsive: ['sm'], // 手機顯示
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>批准申請物品</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <Spin spinning={loading} size="large">
                    {applications.length === 0 && !loading ? (
                        <Alert
                            message="無待審核申請"
                            description="目前沒有待審核的申請記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <Table
                            dataSource={applications}
                            columns={columns}
                            rowKey="_id"
                            bordered
                            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
                            scroll={{ x: 'max-content' }}
                        />
                    )}
                </Spin>
            </Card>
        </div>
    );
};

export default ApproveApplications;