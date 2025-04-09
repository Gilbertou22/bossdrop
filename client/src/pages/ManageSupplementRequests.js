import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Input, Select, message, Image, Pagination, Tooltip, Card, Alert, Spin, Tag } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import statusTag from '../utils/statusTag';
import logger from '../utils/logger'; // 引入前端日誌工具

const { Option } = Select;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const ManageSupplementRequests = () => {
    const [requests, setRequests] = useState([]);
    const [visible, setVisible] = useState(false);
    const [actionType, setActionType] = useState('');
    const [requestId, setRequestId] = useState('');
    const [comment, setComment] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const token = localStorage.getItem('token');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!token) {
            message.error('請先登入以管理補登申請！');
            return;
        }
        fetchRequests();
    }, [statusFilter, currentPage, pageSize, token]);

    const fetchRequests = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/attendee-requests?status=${statusFilter}`, {
                headers: { 'x-auth-token': token },
            });
            setRequests(res.data);
        } catch (err) {
            console.error('Fetch attendee requests error:', err);
            message.error('載入補登申請失敗');
        }
    };

    const handleApprove = (id) => {
        setActionType('approve');
        setRequestId(id);
        setVisible(true);
    };

    const handleReject = (id) => {
        setActionType('reject');
        setRequestId(id);
        setVisible(true);
    };

    const handleConfirm = async () => {
        if (actionType === 'reject' && !comment.trim()) {
            message.error('請提供拒絕原因！');
            return;
        }
        try {
            const res = await axios.put(
                `${BASE_URL}/api/attendee-requests/${requestId}`,
                {
                    status: actionType === 'approve' ? 'approved' : 'rejected',
                    comment: actionType === 'reject' ? comment : undefined,
                },
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg || '補登申請更新成功');
            fetchRequests();
            setVisible(false);
            setComment('');
        } catch (err) {
            console.error('Update request error:', err);
            message.error('更新補登申請失敗');
        }
    };

    const handleCancel = () => {
        setVisible(false);
        setComment('');
    };

    const columns = [
        {
            title: '首領名稱',
            dataIndex: ['kill_id', 'boss_name'],
            key: 'boss_name',
            render: (text, record) => record.kill_id?.boss_name || '未知',
        },
        {
            title: '擊殺時間',
            dataIndex: ['kill_id', 'kill_time'],
            key: 'kill_time',
            render: (time) => time ? moment(time).format('YYYY-MM-DD HH:mm') : '無時間',
        },
        {
            title: '申請者角色',
            dataIndex: 'character_name',
            key: 'character_name',
        },
        {
            title: '證明圖片',
            dataIndex: 'proof_image',
            key: 'proof_image',
            render: (imagePath) => (
                imagePath ? (
                    <Image
                        src={`${BASE_URL}/${imagePath.replace('./', '')}`}
                        alt="證明圖片"
                        width={100}
                        preview={{
                            mask: '點擊預覽',
                        }}
                    />
                ) : '無圖片'
            ),
        },
        {
            title: '原因',
            dataIndex: 'reason',
            key: 'reason',
            render: (text) => (
                <Tooltip title={text}>
                    <div style={{ width: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {text || '無'}
                    </div>
                </Tooltip>
            ),
        },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            render: (status) => statusTag(status), // 使用模組化函數
        },
        {
            title: '操作',
            key: 'actions',
            render: (record) => {
                if (record.status === 'pending') {
                    return (
                        <>
                            <Button
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={() => handleApprove(record._id)}
                                style={{ marginRight: 8 }}
                            >
                                批准
                            </Button>
                            <Button
                                type="danger"
                                icon={<CloseOutlined />}
                                onClick={() => handleReject(record._id)}
                            >
                                拒絕
                            </Button>
                        </>
                    );
                }
                return;
            },
        },
    ];

    const paginatedRequests = requests.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>管理補登申請</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ width: 200 }}
                        placeholder="選擇狀態"
                    >
                        <Option value="pending">待處理</Option>
                        <Option value="approved">已批准</Option>
                        <Option value="rejected">已拒絕</Option>
                        <Option value="all">全部</Option>
                    </Select>
                    <Pagination
                        current={currentPage}
                        pageSize={pageSize}
                        total={requests.length}
                        onChange={setCurrentPage}
                        onShowSizeChange={(current, size) => {
                            setCurrentPage(1);
                            setPageSize(size);
                        }}
                        style={{ marginLeft: 'auto' }}
                        showSizeChanger
                        pageSizeOptions={['10', '20', '50']}
                    />
                </div>
                <Spin spinning={loading} size="large">
                    {requests.length === 0 && !loading ? (
                        <Alert
                            message="無補登申請"
                            description="目前沒有符合條件的補登申請記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <Table
                            columns={columns}
                            dataSource={paginatedRequests}
                            rowKey="_id"
                            bordered
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                        />
                    )}
                </Spin>
            </Card>
            <Modal
                title={actionType === 'approve' ? '批准補登申請' : '拒絕補登申請'}
                visible={visible}
                onOk={handleConfirm}
                onCancel={handleCancel}
                okText="確認"
                cancelText="取消"
            >
                {actionType === 'reject' && (
                    <Input.TextArea
                        placeholder="請提供拒絕原因"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={4}
                        style={{ marginBottom: '16px' }}
                    />
                )}
                {actionType === 'approve' && (
                    <p>確認批准此補登申請？申請者將被添加到參與者列表。</p>
                )}
            </Modal>
        </div>
    );
};

export default ManageSupplementRequests;