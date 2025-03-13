import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Spin, Alert, Pagination, Row, Col, Popconfirm, Tag, Card } from 'antd';
import { SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

const BASE_URL = 'http://localhost:5000';

const ManageBosses = () => {
    const [bosses, setBosses] = useState([]);
    const [filteredBosses, setFilteredBosses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingBoss, setEditingBoss] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({ search: '', difficulty: 'all' });
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    useEffect(() => {
        fetchBosses();
    }, []);

    const fetchBosses = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/bosses`, {
                params: {
                    search: filters.search || undefined,
                    difficulty: filters.difficulty === 'all' ? undefined : filters.difficulty,
                },
            });
            setBosses(res.data);
            setFilteredBosses(res.data);
        } catch (err) {
            message.error(err.response?.data?.msg || '載入首領失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchBosses();
    };

    const handleCreateOrUpdate = async (values) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            if (editingBoss) {
                await axios.put(`${BASE_URL}/api/bosses/${editingBoss._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('首領更新成功');
            } else {
                await axios.post(`${BASE_URL}/api/bosses`, values, {
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
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/bosses/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('首領刪除成功');
            fetchBosses();
        } catch (err) {
            message.error(err.response?.data?.msg || '刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        const token = localStorage.getItem('token');
        if (selectedRowKeys.length === 0) {
            message.warning('請至少選擇一個首領進行刪除');
            return;
        }
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/bosses/batch-delete`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success('批量刪除成功');
            fetchBosses();
            setSelectedRowKeys([]);
        } catch (err) {
            message.error(err.response?.data?.msg || '批量刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => {
            setSelectedRowKeys(selectedKeys);
        },
    };

    const columns = [
        { title: '名稱', dataIndex: 'name', key: 'name', width: 150 },
        { title: '描述', dataIndex: 'description', key: 'description', width: 200 },
        {
            title: '難度',
            dataIndex: 'difficulty',
            key: 'difficulty',
            render: (difficulty) => (
                <Tag color={difficulty === 'easy' ? 'green' : difficulty === 'medium' ? 'blue' : 'red'}>
                    {difficulty}
                </Tag>
            ),
            width: 120,
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Row gutter={[8, 8]} justify="center">
                    <Col>
                        <Button
                            onClick={() => {
                                setEditingBoss(record);
                                setVisible(true);
                                form.setFieldsValue(record);
                            }}
                            disabled={loading}
                        >
                            編輯
                        </Button>
                    </Col>
                    <Col>
                        <Popconfirm
                            title="確認刪除此首領？"
                            onConfirm={() => handleDelete(record._id)}
                            okText="是"
                            cancelText="否"
                            disabled={loading}
                        >
                            <Button danger disabled={loading}>
                                刪除
                            </Button>
                        </Popconfirm>
                    </Col>
                </Row>
            ),
            width: 150,
        },
    ];

    const paginatedBosses = filteredBosses.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>首領管理</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <Input.Search
                        placeholder="搜索首領名稱或描述"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        onSearch={handleSearch}
                        style={{ width: 200 }}
                        enterButton={<SearchOutlined />}
                    />
                    <Select
                        value={filters.difficulty}
                        onChange={(value) => setFilters(prev => ({ ...prev, difficulty: value }))}
                        style={{ width: 200 }}
                        onSelect={handleSearch}
                    >
                        <Option value="all">全部難度</Option>
                        <Option value="easy">簡單</Option>
                        <Option value="medium">中等</Option>
                        <Option value="hard">困難</Option>
                    </Select>
                    <Button
                        type="primary"
                        onClick={() => setVisible(true)}
                        style={{ marginLeft: 'auto' }}
                        disabled={loading}
                    >
                        新增首領
                    </Button>
                    <Popconfirm
                        title="確認批量刪除選中首領？"
                        onConfirm={handleBatchDelete}
                        okText="是"
                        cancelText="否"
                        disabled={loading || selectedRowKeys.length === 0}
                    >
                        <Button
                            type="danger"
                            icon={<DeleteOutlined />}
                            disabled={loading || selectedRowKeys.length === 0}
                        >
                            批量刪除
                        </Button>
                    </Popconfirm>
                </div>
                <Spin spinning={loading} size="large">
                    {filteredBosses.length === 0 && !loading ? (
                        <Alert
                            message="無首領"
                            description="目前沒有符合條件的首領記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <>
                            <Table
                                rowSelection={rowSelection}
                                dataSource={paginatedBosses}
                                columns={columns}
                                rowKey="_id"
                                bordered
                                pagination={false}
                                scroll={{ x: 'max-content' }}
                            />
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={filteredBosses.length}
                                onChange={setCurrentPage}
                                onShowSizeChange={(current, size) => {
                                    setCurrentPage(1);
                                    setPageSize(size);
                                }}
                                style={{ marginTop: '16px', textAlign: 'right' }}
                                showSizeChanger
                                pageSizeOptions={['10', '20', '50']}
                            />
                        </>
                    )}
                </Spin>
            </Card>
            <Modal
                title={editingBoss ? '編輯首領' : '新增首領'}
                open={visible}
                onCancel={() => {
                    setVisible(false);
                    setEditingBoss(null);
                    form.resetFields();
                }}
                footer={null}
            >
                <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                    <Form.Item
                        name="name"
                        label="名稱"
                        rules={[
                            { required: true, message: '請輸入首領名稱！' },
                            { min: 2, message: '名稱至少需要 2 個字符' },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="描述" rules={[{ max: 500, message: '描述不得超過 500 個字符' }]}>
                        <Input.TextArea />
                    </Form.Item>
                    <Form.Item
                        name="difficulty"
                        label="難度"
                        rules={[{ required: true, message: '請選擇首領難度！' }]}
                    >
                        <Select>
                            <Option value="easy">簡單</Option>
                            <Option value="medium">中等</Option>
                            <Option value="hard">困難</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            提交
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageBosses;